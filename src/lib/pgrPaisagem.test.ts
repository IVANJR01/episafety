import { describe, expect, it } from "vitest";
import { render, type PgrPdfContext } from "./pgrPdf";

/*
 * O inventário e o plano de ação são impressos em página DEITADA, como no
 * Word e na planilha. É o que permite as quinze colunas do inventário caberem.
 *
 * Dois erros desta mudança saíram desenhados e valem um teste cada: a última
 * coluna passando da borda do papel (as larguras somavam mais do que a página
 * tem), e a página de assinatura herdando a orientação deitada da anterior.
 */
const item = {
  id: "i1", ges_id: "g1", ghe_id: "g1", grupo: "fisico", perigo_descricao: "Ruído",
  fonte_geradora: "Máquinas", lesoes: "PAIR", limite_tolerancia: "85 dB(A)",
  intensidade: "88 dB(A)", tipo_exposicao: "continua", tecnica_utilizada: "NHO-01",
  controles_existentes: ["Enclausuramento"], epi: "Protetor auricular", atenuacao: "NRRsf 17",
  avaliacao_tipo: "quantitativa", probabilidade: 4, severidade: 3, classificacao: "moderado",
  trabalhadores_expostos: 5, setor: "PRODUÇÃO", descricao_ambiente: "Galpão",
  processo: "Corte", funcoes_snapshot: ["Operador"],
};

const CTX: PgrPdfContext = {
  doc: { id: "d1", empresa_id: "e1", unidade_id: null, versao: 1, status: "vigente",
    data_emissao: "2026-03-15" } as never,
  empresaNome: "EMPRESA", empresaCnpj: "1", unidadeNome: null,
  inventario: [item] as never,
  acoes: [{ id: "a1", inventario_item_id: "i1", what: "Enclausurar", why: "Ruído alto",
    how: "Cabine", where_local: "Produção", how_much: 1000, prioridade: 5,
    meses_execucao: [3], who: "SESMT", status: "pendente", classe_risco: "moderado",
    forma_acompanhamento: "Medição", indicador: "< 85 dB" }] as never,
  evidencias: [], revisoes: [], assinaturas: [],
  ghes: { g1: "01" }, textos: {}, unidades: [], responsaveis: [],
  ambientes: [], processos: [], setores: [], gesDetalhes: [], funcoes: [], atividades: [],
};

/** As dimensões de cada página, em milímetros. */
async function paginas() {
  const pdf = await render(CTX, { qrUrl: "https://x/validar", pdfVersao: 1, comMarca: false });
  const total = pdf.getNumberOfPages();
  const dims: { largura: number; altura: number }[] = [];
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);
    dims.push({
      largura: pdf.internal.pageSize.getWidth(),
      altura: pdf.internal.pageSize.getHeight(),
    });
  }
  return dims;
}

describe("orientação das páginas", () => {
  it("o inventário e o plano saem deitados", async () => {
    const dims = await paginas();
    const deitadas = dims.filter((d) => d.largura > d.altura);
    expect(deitadas.length, "nenhuma página deitada").toBeGreaterThanOrEqual(2);
  }, 30_000);

  it("a capa e a assinatura continuam em pé", async () => {
    const dims = await paginas();
    expect(dims[0].largura, "a capa saiu deitada").toBeLessThan(dims[0].altura);
    const ultima = dims[dims.length - 1];
    /* Sem dizer "portrait", a página da assinatura herdava o deitado. */
    expect(ultima.largura, "a assinatura saiu deitada").toBeLessThan(ultima.altura);
  }, 30_000);
});

describe("nada é desenhado fora do papel", () => {
  it("toda coluna do inventário começa dentro da borda", async () => {
    const pdf = await render(CTX, { qrUrl: "https://x/validar", pdfVersao: 1, comMarca: false });
    const bruto = Buffer.from(pdf.output("arraybuffer")).toString("latin1");
    /*
     * Em pontos: 287 mm de borda direita = 813,5 pt. Nenhum texto pode
     * começar depois disso — a última coluna saía cortada pela metade.
     */
    const LIMITE_PT = 813.6;
    for (const bloco of bruto.split("BT").slice(1)) {
      const corpo = bloco.split("ET")[0];
      for (const m of corpo.matchAll(/(-?[\d.]+) (-?[\d.]+) Td/g)) {
        expect(Number(m[1]), `texto começando em ${m[1]} pt, fora do papel`).toBeLessThan(LIMITE_PT);
      }
    }
  }, 30_000);
});
