import { describe, expect, it } from "vitest";
import { render, numeroDaRevisao, type PgrPdfContext } from "./pgrPdf";

/**
 * Os trechos desenhados NA CAPA — página 1, e só ela.
 *
 * Varrer o arquivo inteiro não serve para testar a capa: o nome da empresa
 * também é impresso no cabeçalho das páginas seguintes e na seção de
 * identificação. Um teste assim passa mesmo com a capa quebrada, e foi o
 * que aconteceu: sabotar a quebra do nome não derrubou nada até esta função
 * passar a olhar só a primeira página.
 */
function trechosDaCapa(pdf: { internal: { pages: string[][] } }): string[] {
  const pagina = (pdf.internal.pages[1] || []).join("\n");
  return (pagina.match(/\((?:\\.|[^\\()])*\)/g) ?? []).map((p) => p.slice(1, -1));
}

function contexto(extra: Partial<PgrPdfContext> = {}): PgrPdfContext {
  return {
    doc: {
      id: "d2840596-aaaa-bbbb-cccc-ddddeeeeffff", versao: 1, status: "rascunho",
      data_emissao: "2026-07-01", data_vigencia_inicio: "2026-07-01", data_vigencia_fim: "2028-06-30",
      resp_tec_nome: "JOSÉ IVAN HOLANDA DE MELO JUNIOR", resp_tec_registro: "CREA-CE 123456/D",
    },
    empresaNome: "LEONARDO A. DE ARAUJO LTDA",
    empresaCnpj: "51.213.683/0001-04",
    empresaEndereco: "Rua Gilberto Gomes de Menezes, 145 - Centro - Alto Santo/CE",
    empresaContato: "(88) 99999-0000  |  contato@empresa.com.br",
    unidadeNome: null,
    codigoDocumento: "PGR-2026-D2840596",
    inventario: [], acoes: [], evidencias: [], revisoes: [], assinaturas: [],
    ghes: {}, textos: {}, quadroEpis: [], unidades: [], responsaveis: [], cenarios: [],
    ambientes: [], processos: [], setores: [], gesDetalhes: [], funcoes: [], atividades: [],
    logoDataUrl: null,
    ...extra,
  } as PgrPdfContext;
}

async function capa(extra: Partial<PgrPdfContext> = {}): Promise<string[]> {
  const pdf = await render(contexto(extra), {
    qrUrl: "https://safetysolucoes.com/pgr/validar/x", pdfVersao: 1, comMarca: true,
  });
  return trechosDaCapa(pdf as unknown as { internal: { pages: string[][] } });
}

describe("numeroDaRevisao", () => {
  it("sem revisão registrada é a 00, a da elaboração", () => {
    expect(numeroDaRevisao([])).toBe("00");
    expect(numeroDaRevisao(null)).toBe("00");
    expect(numeroDaRevisao(undefined)).toBe("00");
  });

  it("acompanha o número de revisões", () => {
    expect(numeroDaRevisao([{ created_at: "x" }])).toBe("01");
    expect(numeroDaRevisao(Array(12).fill({ created_at: "x" }))).toBe("12");
  });

  it("usa sempre duas casas, como a norma imprime", () => {
    for (let n = 0; n < 10; n++) {
      expect(numeroDaRevisao(Array(n).fill({ created_at: "x" }))).toHaveLength(2);
    }
  });
});

describe("capa do PGR", () => {
  it("traz o número de revisão no alto", async () => {
    expect(await capa()).toContain("REV. 00");
  });

  it("traz o título e os dois subtítulos", async () => {
    const t = await capa();
    expect(t).toContain("PGR");
    expect(t).toContain("Programa de Gerenciamento de Riscos");
    expect(t).toContain("Inventário de Riscos e Plano de Ação");
  });

  it("identifica a empresa coberta pelo documento", async () => {
    const t = await capa();
    expect(t).toContain("LEONARDO A. DE ARAUJO LTDA");
    expect(t).toContain("CNPJ: 51.213.683/0001-04");
  });

  it("imprime endereço e contato no rodapé timbrado", async () => {
    const t = await capa();
    expect(t.some((s) => s.includes("Alto Santo/CE"))).toBe(true);
    expect(t.some((s) => s.includes("contato@empresa.com.br"))).toBe(true);
  });

  it("mantém o aviso legal, agora como nota e não como tarja", async () => {
    // O aviso continua sendo verdade e precisa estar escrito. O que saiu foi
    // a caixa amarela no meio da capa, não o texto.
    const t = await capa();
    expect(t.some((s) => s.includes("Assinatura ICP-Brasil não implementada"))).toBe(true);
    expect(t).not.toContain("AVISO LEGAL");
  });

  it("não quebra sem endereço nem contato cadastrados", async () => {
    // Filial costuma ter só nome e CNPJ.
    const t = await capa({ empresaEndereco: null, empresaContato: null });
    expect(t).toContain("LEONARDO A. DE ARAUJO LTDA");
    expect(t).toContain("REV. 00");
  });

  it("não estoura com nome de empresa muito longo", async () => {
    const nome = "COMPANHIA BRASILEIRA DE SERVICOS INTEGRADOS DE ENGENHARIA E MANUTENCAO INDUSTRIAL LTDA";
    const t = await capa({ empresaNome: nome });

    // O nome aparece duas vezes na capa, e com papéis diferentes: inteiro no
    // rodapé timbrado, quebrado em linhas no título. Somar os dois daria o
    // nome em dobro, então são separados aqui — e é o título que precisa ser
    // conferido, porque é lá que a quebra pode perder pedaço.
    const inteiro = t.filter((s) => s.trim() === nome);
    const linhasDoTitulo = t.filter((s) => s.trim() !== nome && nome.includes(s.trim()) && s.trim().length > 3);

    expect(inteiro.length).toBeGreaterThan(0);
    expect(linhasDoTitulo.length).toBeGreaterThan(1);
    expect(linhasDoTitulo.join(" ").replace(/\s+/g, " ").trim()).toBe(nome);
    expect(t).toContain("Emitido em: 01/07/2026");
  });
});
