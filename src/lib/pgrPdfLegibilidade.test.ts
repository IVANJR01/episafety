import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { render, type PgrPdfContext } from "./pgrPdf";
import { CLASSE_TEXTO_HEX, CLASSES_ORDENADAS } from "./pgrMatriz";

/*
 * Defeitos encontrados abrindo o PDF e conferindo página por página. Todos
 * saíam impressos no documento que vai para o cliente.
 */

const item = (n: number, grupo: string, perigo: string, p: number, s: number) => ({
  id: `i${n}`, ghe_id: "g1", grupo, perigo_descricao: perigo,
  fonte_geradora: "Máquinas do setor", tipo_exposicao: "continua", avaliacao_tipo: "quantitativa",
  severidade: s, probabilidade: p,
  classificacao: ["", "trivial", "toleravel", "moderado", "substancial", "intoleravel"][
    p * s <= 3 ? 1 : p * s <= 8 ? 2 : p * s <= 12 ? 3 : p * s <= 15 ? 4 : 5],
  necessita_acao: p * s >= 9, trabalhadores_expostos: 12,
  controles_existentes: "Enclausuramento parcial", setor_id: "s1", lesoes: "PAIR",
});

const CTX: PgrPdfContext = {
  doc: { id: "d1", empresa_id: "e1", unidade_id: null, versao: 1, status: "rascunho",
    data_emissao: "2026-03-15", data_vigencia_inicio: "2026-03-15", data_vigencia_fim: "2028-03-14",
    resp_tec_nome: "Maria Souza", resp_tec_registro: "CREA 12345/CE" } as never,
  empresaNome: "EMPRESA TESTE LTDA", empresaCnpj: "11.222.333/0001-44", unidadeNome: null,
  inventario: [
    item(1, "fisico", "Ruído contínuo", 4, 3),
    item(2, "quimico", "Poeira de algodão", 3, 4),
    item(3, "psicossocial", "Sobrecarga de demandas", 5, 5),
    item(4, "ergonomico", "Postura sentada prolongada", 4, 2),
    item(5, "acidente", "Queda de materiais", 2, 3),
    item(6, "biologico", "Contato com fungos", 1, 2),
  ] as never,
  acoes: [{ id: "a1", descricao: "Enclausurar as máquinas", what: "Enclausurar as máquinas",
    why: "Reduzir o ruído", where_local: "Costura", prazo: "2026-06-30",
    how: "Serviço especializado", status: "programada", who: "Empresa",
    classe_risco: "moderado", data_conclusao: null }] as never,
  evidencias: [], revisoes: [], assinaturas: [],
  ghes: { g1: "GES 3.1 — Costura" }, textos: {},
  unidades: [{ id: "e1", nome: "EMPRESA TESTE LTDA", cnpj: "11.222.333/0001-44", cidade: "Fortaleza", uf: "CE" }] as never,
  responsaveis: [], ambientes: [], processos: [], setores: [{ id: "s1", nome: "COSTURA" }],
  gesDetalhes: [], funcoes: [], atividades: [],
};

/** O texto que o PDF realmente imprime. */
async function textoDoPdf(comMarca = false) {
  const pdf = await render(CTX, { qrUrl: "https://exemplo/validar", pdfVersao: 1, comMarca });
  return Buffer.from(pdf.output("arraybuffer")).toString("latin1");
}

/* Comentário não é documento: os blocos de explicação citam o jeito antigo. */
const FONTE = fs
  .readFileSync(path.resolve(__dirname, "pgrPdf.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("o inventário imprime o agente em português", () => {
  it("não deixa escapar o nome do enum do banco", async () => {
    const pdf = await textoDoPdf();
    /* Saía "[fisico] Ruído contínuo" — minúsculo, sem acento, entre colchetes. */
    for (const enumBruto of ["[fisico]", "[quimico]", "[biologico]", "[ergonomico]", "[psicossocial]", "[acidente]"]) {
      expect(pdf, `enum cru ${enumBruto} no documento`).not.toContain(enumBruto);
    }
  }, 30_000);

  it("usa o rótulo com acento", async () => {
    expect(FONTE).toContain("GRUPO_LABEL[i.grupo]");
  });
});

describe("a matriz sai legível", () => {
  it("o número da célula usa a cor que se lê em cima do fundo", () => {
    /*
     * Com as cores oficiais (amarelo FFFF00, verde 92D050, azul 00B0F0) o
     * branco fixo sumia: metade dos números da matriz ficava invisível.
     */
    expect(FONTE).toContain("CLASSE_TEXTO_HEX[c]");
    expect(FONTE).not.toMatch(/setTextColor\(255\);\s*b\.doc\.setFontSize\(8\);/);
  });

  it("só o Intolerável leva letra branca", () => {
    expect(CLASSE_TEXTO_HEX.intoleravel).toEqual([255, 255, 255]);
    for (const c of CLASSES_ORDENADAS.filter((x) => x !== "intoleravel")) {
      expect(CLASSE_TEXTO_HEX[c], `${c} deveria ter letra preta`).toEqual([0, 0, 0]);
    }
  });
});

describe("o plano de ação imprime português, não o banco", () => {
  it("mostra o rótulo do status, não o valor do enum", async () => {
    const pdf = await textoDoPdf();
    expect(pdf).toContain("Status: Programada");
    expect(pdf).not.toContain("Status: programada");
  }, 30_000);

  it("não imprime campo vazio como travessão", async () => {
    const pdf = await textoDoPdf();
    /* Saía "Risco: — · Prazo: 30/06/2026 · Conclusão: —" nesta mesma ação. */
    expect(pdf).toContain("Status: Programada");
    expect(pdf).not.toContain("Conclus");
  }, 30_000);

  it("mas imprime a conclusão quando ela existe", async () => {
    const comConclusao = {
      ...CTX,
      acoes: [{ ...(CTX.acoes[0] as never as Record<string, unknown>), status: "concluida", data_conclusao: "2026-05-20" }],
    } as PgrPdfContext;
    const pdf = await render(comConclusao, { qrUrl: "https://exemplo/validar", pdfVersao: 1, comMarca: false });
    const texto = Buffer.from(pdf.output("arraybuffer")).toString("latin1");
    expect(texto).toContain("Status: Conclu");
    expect(texto).toContain("20/05/2026");
  }, 30_000);

  it("não repete a medida como título e como linha do 5W2H", async () => {
    const pdf = await textoDoPdf();
    expect(pdf).not.toContain("O que ser");
  }, 30_000);
});

describe("a marca d'água não atravessa o título da capa", () => {
  it("na capa ela é horizontal; no miolo, diagonal", () => {
    const timbrado = fs
      .readFileSync(path.resolve(__dirname, "pdfTimbrado.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    /* A diagonal subia pela direita e cortava a sigla do documento. */
    expect(timbrado).toContain("if (p === 1) {");
    expect(timbrado).toContain("charSpace: ESPACO_ENTRE_LETRAS");
    expect(timbrado).toContain("105 - largura / 2");
  });
});
