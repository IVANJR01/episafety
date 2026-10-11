import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { render, type PgrPdfContext } from "./pgrPdf";

/*
 * O inventário do PDF tem de ser o MESMO do Word e da planilha.
 *
 * É a regra que o pacote existe para garantir: "o PGR e a planilha saem do
 * mesmo arquivo de dados, por isso o inventário dentro do PGR é sempre
 * idêntico à planilha". O PDF do sistema tinha cinco colunas onde o Word tem
 * quinze — faltavam limite de exposição, intensidade/concentração, tipo e
 * tempo de exposição, técnica utilizada, EPI e atenuação, que são as letras
 * "f", "g" e "h" do item 1.5.7.3.2. Não era só diferente: era incompleto.
 *
 * Este teste lê as colunas do gerador ORIGINAL (gerador/gerar.js) e cobra que
 * o PDF tenha as mesmas. Se alguém acrescentar uma coluna lá, este teste
 * falha aqui — que é exatamente o que se quer.
 */
const RAIZ = path.resolve(__dirname, "../..");
const requireCjs = createRequire(path.join(RAIZ, "ferramentas/documentos/gerador/"));

/** As colunas do inventário, lidas do código do pacote. */
function colunasDoWord(): string[] {
  const fonte = fs.readFileSync(
    path.join(RAIZ, "ferramentas/documentos/gerador/gerar.js"),
    "utf8",
  );
  const bloco = fonte.slice(fonte.indexOf("const INV_COLS"), fonte.indexOf("const fs7"));
  return [...bloco.matchAll(/\['([^']+)', '[a-z]+', \d+\]/g)].map((m) => m[1]);
}

const item = {
  id: "i1", ges_id: "g1", ghe_id: "g1", grupo: "quimico",
  perigo_descricao: "Poeira de algodão", fonte_geradora: "Processo de fiação",
  lesoes: "Bissinose; bronquite", limite_tolerancia: "1 mg/m³ (NR-15 An. 12)",
  intensidade: "1,8 mg/m³", tipo_exposicao: "continua", tempo_exposicao: "",
  tecnica_utilizada: "NHO-08 (Fundacentro)",
  controles_existentes: ["Exaustão localizada", "Limpeza por aspiração"],
  epi: "Respirador PFF2 (CA 12345)", atenuacao: "FPR 10",
  avaliacao_tipo: "quantitativa", probabilidade: 4, severidade: 3,
  classificacao: "moderado", trabalhadores_expostos: 9,
  setor: "FIAÇÃO", descricao_ambiente: "Galpão com exaustão",
  processo: "Abertura e cardagem do algodão",
  funcoes_snapshot: ["Fiandeiro"],
};

const CTX: PgrPdfContext = {
  doc: { id: "d1", empresa_id: "e1", unidade_id: null, versao: 1, status: "vigente",
    data_emissao: "2026-03-15" } as never,
  empresaNome: "EMPRESA TESTE", empresaCnpj: "1", unidadeNome: null,
  inventario: [item] as never, acoes: [], evidencias: [], revisoes: [], assinaturas: [],
  ghes: { g1: "3.1" }, textos: {}, unidades: [], responsaveis: [],
  ambientes: [], processos: [], setores: [], gesDetalhes: [], funcoes: [], atividades: [],
};

/**
 * Só o texto IMPRESSO, sem as coordenadas.
 *
 * Procurar no PDF cru não serve: "999" aparece em qualquer número como
 * 9.1999999999999993, e o teste acusava um nível inventado que não existia.
 * Aqui ficam apenas os trechos entre parênteses seguidos de Tj, que é o que
 * o leitor vê.
 */
async function pdfTexto(ctx: PgrPdfContext = CTX) {
  const pdf = await render(ctx, { qrUrl: "https://x/validar", pdfVersao: 1, comMarca: false });
  const bruto = Buffer.from(pdf.output("arraybuffer")).toString("latin1");
  /*
   * Juntos por espaço, não por quebra: o cabeçalho de coluna estreita sai
   * partido em dois pedaços ("FONTE /" e "CIRCUNSTÂNCIA"), e procurar o
   * rótulo inteiro falharia por causa da quebra, não por ele faltar.
   */
  return [...bruto.matchAll(/\((.*?)\) Tj/g)]
    .map((m) => m[1])
    .join(" ")
    .replace(/\s+/g, " ");
}

describe("o inventário do PDF x o do Word", () => {
  it("o pacote continua com as quinze colunas que conhecemos", () => {
    const cols = colunasDoWord();
    expect(cols).toHaveLength(15);
    expect(cols[0]).toBe("AGENTE");
    expect(cols[cols.length - 1]).toBe("CLASSIFICAÇÃO");
  });

  it("o PDF imprime exatamente as mesmas colunas", async () => {
    /*
     * Comparado sem os espaços: numa coluna estreita o jsPDF pode partir o
     * rótulo no meio de uma palavra, e isso é questão de largura, não de a
     * coluna existir — que é o que este teste cobra.
     */
    const semEspaco = (t: string) => t.replace(/\s+/g, "");
    const texto = semEspaco(await pdfTexto());
    for (const coluna of colunasDoWord()) {
      expect(texto, `faltou a coluna "${coluna}" no PDF`).toContain(semEspaco(coluna));
    }
  }, 30_000);

  it("e imprime o VALOR de cada uma — não só o cabeçalho", async () => {
    const texto = await pdfTexto();
    for (const [coluna, valor] of [
      ["agente", "Químico"],
      ["perigo", "Poeira de algod"],
      ["fonte", "Processo de fia"],
      ["lesões", "Bissinose"],
      ["limite", "1 mg/m"],
      ["intensidade", "1,8 mg/m"],
      ["exposição", "Permanente"],
      ["técnica", "NHO-08"],
      ["EPC", "Exaust"],
      ["EPI", "PFF2"],
      ["atenuação", "FPR 10"],
    ] as const) {
      expect(texto, `o valor da coluna ${coluna} não saiu`).toContain(valor);
    }
  }, 30_000);
});

describe("nível e classificação são calculados, nunca lidos", () => {
  it("P=4 e S=3 dão 12 MODERADO, mesmo com outro valor gravado na linha", async () => {
    const mentiroso = {
      ...CTX,
      inventario: [{ ...item, nivel_risco: 999, classificacao: "trivial" }] as never,
    } as PgrPdfContext;
    const texto = await pdfTexto(mentiroso);
    expect(texto).not.toContain("999");
    expect(texto).toContain("MODERADO");
    expect(texto).not.toContain("TRIVIAL");
    /* E pintado de amarelo oficial — isto se confere no PDF cru. */
    const pdf = await render(mentiroso, { qrUrl: "https://x/validar", pdfVersao: 1, comMarca: false });
    expect(Buffer.from(pdf.output("arraybuffer")).toString("latin1")).toContain("1. 1. 0. rg");
  }, 30_000);

  it("linha sem avaliação não inventa nível nem classe", async () => {
    const semAval = {
      ...CTX,
      inventario: [{ ...item, probabilidade: null, severidade: null, classificacao: null }] as never,
    } as PgrPdfContext;
    const texto = await pdfTexto(semAval);
    expect(texto).not.toContain("MODERADO");
    expect(texto).not.toContain("TRIVIAL");
  }, 30_000);
});
