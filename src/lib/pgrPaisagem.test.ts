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

describe("a tabela tem grade", () => {
  /*
   * Sem linha vertical, quinze colunas de texto quebrado viram uma sopa: o
   * texto de uma célula terminava exatamente onde começava o da próxima e
   * não havia como saber onde uma coluna acabava. Saiu impresso assim.
   */
  async function desenhos() {
    const pdf = await render(CTX, { qrUrl: "https://x/validar", pdfVersao: 1, comMarca: false });
    const bruto = Buffer.from(pdf.output("arraybuffer")).toString("latin1");
    const linhas: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (const m of bruto.matchAll(
      /(-?[\d.]+) (-?[\d.]+) m\s+(-?[\d.]+) (-?[\d.]+) l/g,
    )) {
      linhas.push({ x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4] });
    }
    return { bruto, linhas };
  }

  it("desenha linhas verticais entre as colunas", async () => {
    const { linhas } = await desenhos();
    const verticais = linhas.filter((l) => Math.abs(l.x1 - l.x2) < 0.01 && Math.abs(l.y1 - l.y2) > 1);
    /* Dezesseis separadores por linha do inventário, mais os do plano. */
    expect(verticais.length, "a tabela saiu sem grade").toBeGreaterThan(30);
  }, 30_000);

  /*
   * Os retângulos pintados, com a cor e a largura de cada um.
   *
   * A primeira versão destes dois testes só procurava a COR azul-marinho no
   * arquivo — e passava com o defeito de volta, porque o mesmo azul é usado
   * no cabeçalho da tabela, na célula do cronograma e no título da seção. O
   * que distingue um do outro é a largura: o cabeçalho atravessa a página, a
   * célula de um mês tem uns 16 pontos.
   */
  async function retangulos() {
    const pdf = await render(CTX, { qrUrl: "https://x/validar", pdfVersao: 1, comMarca: false });
    const bruto = Buffer.from(pdf.output("arraybuffer")).toString("latin1");
    const achados: { cor: string; largura: number }[] = [];
    let cor = "";
    for (const m of bruto.matchAll(
      /([\d.]+ [\d.]+ [\d.]+) rg|(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) re\s+f/g,
    )) {
      if (m[1]) cor = m[1];
      else achados.push({ cor, largura: Math.abs(Number(m[4])) });
    }
    return achados;
  }

  const NAVY_TABELA = "0.06 0.16 0.27";

  it("o cabeçalho da tabela é a faixa azul-marinho que atravessa a página", async () => {
    const rects = await retangulos();
    /* 277 mm = 785 pt: só o cabeçalho tem essa largura. */
    const faixas = rects.filter((r) => r.cor === NAVY_TABELA && r.largura > 700);
    expect(faixas.length, "o cabeçalho não saiu escuro").toBeGreaterThanOrEqual(2);
  }, 30_000);

  it("pinta o mês previsto no cronograma, não só um X solto", async () => {
    const rects = await retangulos();
    /* A célula de um mês tem 3,8 mm + o vão = por volta de 16 pt. */
    const meses = rects.filter((r) => r.cor === NAVY_TABELA && r.largura > 8 && r.largura < 25);
    expect(meses.length, "o mês do cronograma saiu sem pintura").toBeGreaterThan(0);
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

  it("nenhuma célula pintada passa da moldura da tabela", async () => {
    /*
     * A célula da classificação era pintada "a largura do texto mais 1,5 mm
     * de cada lado" — um palpite que, na última coluna, pintava por cima da
     * linha direita da grade e para fora dela.
     */
    const pdf = await render(CTX, { qrUrl: "https://x/validar", pdfVersao: 1, comMarca: false });
    const bruto = Buffer.from(pdf.output("arraybuffer")).toString("latin1");
    const LIMITE_PT = 813.6;
    for (const m of bruto.matchAll(
      /(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) re\s+f/g,
    )) {
      const x = Number(m[1]);
      const largura = Number(m[3]);
      /* A faixa do topo da capa cobre a página inteira de propósito. */
      if (x <= 0) continue;
      expect(x + largura, `retângulo terminando em ${x + largura} pt, fora da moldura`)
        .toBeLessThanOrEqual(LIMITE_PT + 0.5);
    }
  }, 30_000);
});
