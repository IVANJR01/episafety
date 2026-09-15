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
function trechosDaPagina(pdf: { internal: { pages: string[][] } }, n: number): string[] {
  const pagina = (pdf.internal.pages[n] || []).join("\n");
  return (pagina.match(/\((?:\\.|[^\\()])*\)/g) ?? []).map((p) => p.slice(1, -1));
}

const trechosDaCapa = (pdf: { internal: { pages: string[][] } }) => trechosDaPagina(pdf, 1);
const trechosDaCapa2 = trechosDaPagina;

function contexto(extra: Partial<PgrPdfContext> = {}): PgrPdfContext {
  return {
    doc: {
      id: "d2840596-aaaa-bbbb-cccc-ddddeeeeffff", versao: 1, status: "rascunho",
      data_emissao: "2026-07-01", data_vigencia_inicio: "2026-07-01", data_vigencia_fim: "2028-06-30",
      resp_tec_nome: "JOSÉ IVAN HOLANDA DE MELO JUNIOR", resp_tec_registro: "CREA-CE 123456/D",
    },
    empresaNome: "LEONARDO A. DE ARAUJO LTDA",
    empresaCnpj: "51.213.683/0001-04",
    emissorNome: "3M CURSOS E TREINAMENTOS",
    emissorLinhas: [
      "Segurança e Saúde Ocupacional",
      "Rua Gilberto Gomes de Menezes, 145 - Centro - Potiretama/CE",
      "CNPJ 51.489.453/0001-64  |  contato@3m.com.br",
    ],
    emissorLogoDataUrl: null,
    unidadeNome: null,
    codigoDocumento: "PGR-2026-D2840596",
    inventario: [], acoes: [], evidencias: [], revisoes: [], assinaturas: [],
    ghes: {}, textos: {}, unidades: [], responsaveis: [],
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

  it("fecha a capa com a identificação da empresa, e nada mais", async () => {
    // A capa é capa: QR, hash, numeração e nota de assinatura são aparato de
    // documento técnico e moram no miolo. Aqui eles disputavam espaço com a
    // identificação e faziam a primeira página parecer a última.
    const t = await capa();
    expect(t).toContain("LEONARDO A. DE ARAUJO LTDA");
    expect(t.some((s) => s.includes("QR Code de validação"))).toBe(false);
    expect(t.some((s) => s.includes("Assinatura ICP-Brasil"))).toBe(false);
    expect(t.some((s) => s.includes("Página 1/"))).toBe(false);
    expect(t.some((s) => s.includes("3M CURSOS"))).toBe(false);
  });

  it("mantém o QR e a nota de assinatura no miolo", async () => {
    // Sair da capa não é sumir do documento: a validação e o aviso continuam
    // no rodapé de todas as outras páginas.
    const pdf = await render(contexto(), {
      qrUrl: "https://safetysolucoes.com/pgr/validar/x", pdfVersao: 1, comMarca: true,
    });
    const p2 = trechosDaCapa2(pdf as any, 2);
    expect(p2.some((s) => s.includes("Validação interna"))).toBe(true);
    expect(p2.some((s) => s.includes("assinatura ICP-Brasil não aplicada"))).toBe(true);
    // A numeração de página saiu do meio da frase e virou campo próprio.
    expect(p2.some((s) => s.includes("Página 2 de"))).toBe(true);
  });

  it("sai inteira sem emissor cadastrado", async () => {
    const t = await capa({ emissorNome: null, emissorLinhas: [], emissorLogoDataUrl: null });
    expect(t).toContain("LEONARDO A. DE ARAUJO LTDA");
    expect(t).toContain("REV. 00");
  });

  it("não estoura com nome de empresa muito longo", async () => {
    const nome = "COMPANHIA BRASILEIRA DE SERVICOS INTEGRADOS DE ENGENHARIA E MANUTENCAO INDUSTRIAL LTDA";
    const t = await capa({ empresaNome: nome });

    // Quebrado em linhas no título, o nome sai em pedaços. O que não pode é
    // sumir pedaço: as linhas emendadas têm que dar o nome inteiro de volta.
    const linhasDoTitulo = t.filter((s) => nome.includes(s.trim()) && s.trim().length > 3);

    expect(linhasDoTitulo.length).toBeGreaterThan(1);
    expect(linhasDoTitulo.join(" ").replace(/\s+/g, " ").trim()).toBe(nome);
    expect(t).toContain("Emitido em: 01/07/2026");
  });
});
