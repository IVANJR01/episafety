import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { gerarDocumentoBuffer, DadosDocumento } from "./gerarDocx";
import { DOCUMENTOS_SST } from "./docsSst";

/*
 * As regras que não podem mudar, conferidas no documento pronto — não no
 * código que o escreve. É a diferença entre "acho que está certo" e "abri o
 * arquivo e está certo".
 */
const PACOTE = path.resolve(__dirname, "../../../ferramentas/documentos");
const DADOS: DadosDocumento = JSON.parse(
  fs.readFileSync(path.join(PACOTE, "exemplo/dados_exemplo.json"), "utf8"),
);

async function documentoXml(sigla: string, dados: DadosDocumento | null) {
  const zip = await JSZip.loadAsync(await gerarDocumentoBuffer(sigla, dados));
  return zip.file("word/document.xml")!.async("string");
}

/** O texto visível, sem as marcações XML. */
const soTexto = (xml: string) => xml.replace(/<[^>]+>/g, "");

const SIGLAS = DOCUMENTOS_SST.map((d) => d.sigla);

describe("regra 1 — GES, nunca GHE", () => {
  it.each(SIGLAS)("%s não mostra a palavra GHE em lugar nenhum", async (sigla) => {
    expect(soTexto(await documentoXml(sigla, DADOS))).not.toMatch(/GHE/);
  }, 30_000);

  it("o PGR identifica cada grupo como GES", async () => {
    expect(soTexto(await documentoXml("PGR", DADOS))).toContain("GES 3.1");
  }, 30_000);
});

describe("regra 2 — nível e classificação são calculados", () => {
  /*
   * A primeira versão deste teste procurava `fill="FFFF00"` seguido de
   * "MODERADO" em qualquer lugar do XML — e passava mesmo com a faixa do
   * MODERADO estreitada para 9..11, porque casava com a LEGENDA, não com a
   * linha do inventário. Agora o teste monta um inventário de uma linha só e
   * confere dentro da linha (<w:tr>) daquele perigo.
   */
  const umaLinha = (probabilidade: number, severidade: number): DadosDocumento => ({
    empresa: DADOS.empresa,
    inventario: [
      {
        ambiente: "Ambiente", setor: "SETOR", ghe: "9.9", funcao: "Função", processo: "Processo",
        agente: "Físico", perigo: "PERIGO-DE-TESTE", fonte: "Fonte", lesoes: "Lesões",
        limite: "-", intensidade: "-", exposicao: "Permanente", tecnica: "-", medidas: "-",
        epi: "-", atenuacao: "-", probabilidade, severidade,
      },
    ],
    plano: [],
  });

  /** A linha da tabela onde está aquele perigo. */
  async function linhaDoPerigo(dados: DadosDocumento) {
    const xml = await documentoXml("PGR", dados);
    const linha = xml.split("<w:tr").find((tr) => soTexto(tr).includes("PERIGO-DE-TESTE"));
    expect(linha, "a linha do inventário não foi encontrada").toBeTruthy();
    return linha!;
  }

  it("P=4 e S=3 saem como 12 MODERADO, na célula amarela FFFF00", async () => {
    const linha = await linhaDoPerigo(umaLinha(4, 3));
    const texto = soTexto(linha);
    expect(texto).toContain("12");
    expect(texto).toContain("MODERADO");
    expect(linha).toContain('w:fill="FFFF00"');
    /* E não pode ter sido classificada em outra faixa. */
    expect(texto).not.toContain("SUBSTANCIAL");
    expect(texto).not.toContain("TOLERÁVEL");
  }, 30_000);

  it.each([
    [1, 1, 1, "TRIVIAL", "00B0F0"],
    [1, 3, 3, "TRIVIAL", "00B0F0"],
    [2, 2, 4, "TOLERÁVEL", "92D050"],
    [4, 2, 8, "TOLERÁVEL", "92D050"],
    [3, 3, 9, "MODERADO", "FFFF00"],
    [4, 3, 12, "MODERADO", "FFFF00"],
    [5, 3, 15, "SUBSTANCIAL", "FFC000"],
    [4, 4, 16, "INTOLERÁVEL", "C00000"],
    [5, 5, 25, "INTOLERÁVEL", "C00000"],
  ])(
    "P=%i x S=%i dá nível %i, %s, cor %s",
    async (prob, sev, nivelEsperado, classe, cor) => {
      const linha = await linhaDoPerigo(umaLinha(prob as number, sev as number));
      expect(soTexto(linha)).toContain(String(nivelEsperado));
      expect(soTexto(linha)).toContain(classe as string);
      expect(linha).toContain(`w:fill="${cor}"`);
    },
    30_000,
  );

  it("o nível nunca é digitado: vem sempre de P x S", async () => {
    /* Mesmo recebendo um "nivel" falso no dado de entrada, o documento calcula. */
    const comNivelFalso = umaLinha(4, 3) as DadosDocumento & { inventario: Record<string, unknown>[] };
    comNivelFalso.inventario[0].nivel = 999;
    comNivelFalso.inventario[0].classificacao = "TRIVIAL";
    const linha = await linhaDoPerigo(comNivelFalso as DadosDocumento);
    expect(soTexto(linha)).not.toContain("999");
    expect(soTexto(linha)).toContain("MODERADO");
  }, 30_000);

  it("a legenda das cinco faixas usa as cores oficiais", async () => {
    const xml = await documentoXml("PGR", DADOS);
    for (const [cor, nome] of [
      ["00B0F0", "TRIVIAL"], ["92D050", "TOLERÁVEL"], ["FFFF00", "MODERADO"],
      ["FFC000", "SUBSTANCIAL"], ["C00000", "INTOLERÁVEL"],
    ] as const) {
      expect(xml, `faixa ${nome}`).toContain(`w:fill="${cor}"`);
    }
  }, 30_000);
});

describe("regra 5 — campo sem valor vira {{CAMPO}} e não quebra", () => {
  it("empresa sem CNPJ nem telefone gera o documento com os marcadores", async () => {
    const semAlgunsCampos: DadosDocumento = {
      ...DADOS,
      empresa: { ...DADOS.empresa, CNPJ: "", TELEFONE: undefined },
    };
    const xml = await documentoXml("PGR", semAlgunsCampos);
    const texto = soTexto(xml);
    expect(texto).toContain("{{CNPJ}}");
    expect(texto).toContain("{{TELEFONE}}");
    /* O que tem valor continua saindo como valor. */
    expect(texto).toContain("EMPRESA EXEMPLO LTDA");
    expect(texto).not.toContain("{{RAZAO_SOCIAL}}");
  }, 30_000);

  it("sem dado nenhum sai o modelo em branco, inteiro", async () => {
    const texto = soTexto(await documentoXml("PGR", null));
    expect(texto).toContain("{{RAZAO_SOCIAL}}");
    expect(texto).toContain("{{GES}}");
    /* E as seções da norma continuam lá. */
    expect(texto).toContain("Inventário de Riscos Ocupacionais");
    expect(texto).toContain("Plano de Ação");
  }, 30_000);
});

describe("regra 3 — o PGR tem só o que a NR-01 exige", () => {
  it("não traz introdução nem objetivos genéricos", () => {
    const pgr = DOCUMENTOS_SST.find((d) => d.sigla === "PGR")!;
    const titulos = pgr.secoes.map((s) => s.t);
    expect(titulos).not.toContain("Introdução");
    expect(titulos).not.toContain("Objetivos");
    expect(titulos).toEqual(["Inventário de Riscos Ocupacionais", "Plano de Ação", "Revisão do PGR"]);
  });
});

describe("regra 4 — mesma capa em todos", () => {
  it("todo documento abre com a moldura e a tabela da empresa", async () => {
    for (const sigla of SIGLAS) {
      const xml = await documentoXml(sigla, DADOS);
      expect(xml, `${sigla} sem moldura`).toContain("w:pgBorders");
      expect(soTexto(xml), `${sigla} sem bloco da empresa`).toContain("Responsável Técnico");
    }
  }, 60_000);
});
