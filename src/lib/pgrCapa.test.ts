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

describe("capa do PGR — a capa Simples com moldura do pacote", () => {
  /*
   * A capa é a MESMA dos seis documentos em Word: moldura na página, caixa
   * da logo, a sigla grande centralizada, a vigência e a tabela de cinco
   * linhas — Empresa, CNPJ, Endereço, Responsável Técnico e Revisão / Data.
   *
   * O PDF tinha uma capa só dele, com faixa azul-marinho e painel de
   * identificação no pé. Quem recebia o PGR em Word e o mesmo PGR em PDF
   * recebia dois documentos de cara diferente. Os testes abaixo cobravam
   * aquela capa; agora cobram esta.
   */
  it("tem a MOLDURA — é a regra que dá nome à capa", async () => {
    /*
     * "Manter a capa Simples com moldura em todos os documentos." Sem um
     * teste, apagar a moldura não quebrava nada: todos os outros continuavam
     * passando, porque todos olham texto, e a moldura é um retângulo.
     */
    const pdf = await render(contexto(), {
      qrUrl: "https://safetysolucoes.com/pgr/validar/x", pdfVersao: 1, comMarca: true,
    });
    const pagina1 = ((pdf as never as { internal: { pages: string[][] } }).internal.pages[1] || [])
      .join("\n");
    /*
     * Um retângulo TRAÇADO (re ... S), não preenchido, do tamanho da página
     * menos as margens: 162 x 249 mm = 459 x 706 pt.
     */
    const retangulos = [...pagina1.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) (-?[\d.]+) re\s*\n?S/g)]
      .map((m) => ({ largura: Math.abs(+m[3]), altura: Math.abs(+m[4]) }));
    const moldura = retangulos.find((r) => r.largura > 440 && r.altura > 680);
    expect(moldura, "a capa saiu sem moldura").toBeTruthy();
  });

  it("traz a sigla, o nome do documento e a norma", async () => {
    const t = await capa();
    expect(t).toContain("PGR");
    expect(t).toContain("Programa de Gerenciamento de Riscos");
    expect(t).toContain("NR-01");
  });

  it("o título é CENTRALIZADO, não encostado na margem", async () => {
    /*
     * A capa antiga alinhava o título à esquerda, sob uma faixa azul-marinho.
     * Só conferir que o texto existe não distingue uma capa da outra — o
     * texto é o mesmo nas duas.
     */
    const pdf = await render(contexto(), {
      qrUrl: "https://safetysolucoes.com/pgr/validar/x", pdfVersao: 1, comMarca: true,
    });
    const pagina1 = ((pdf as never as { internal: { pages: string[][] } }).internal.pages[1] || [])
      .join("\n");
    /* O Td imediatamente antes de "(PGR) Tj" diz onde a sigla começou. */
    const antes = pagina1.slice(0, pagina1.indexOf("(PGR) Tj"));
    const td = [...antes.matchAll(/([\d.]+) ([\d.]+) Td/g)].pop();
    expect(td, "a sigla não foi desenhada").toBeTruthy();
    const x = Number(td![1]);
    /* A4 tem 595 pt: centralizada, a sigla começa perto do meio. */
    expect(x, `sigla começando em ${x} pt, encostada na margem`).toBeGreaterThan(200);
    expect(x).toBeLessThan(330);
  });

  it("traz a vigência logo abaixo da norma, como no Word", async () => {
    expect(await capa()).toContain("Vigência: 01/07/2026 a 30/06/2028");
  });

  it("não repete a identificação da empresa na capa", async () => {
    /*
     * A capa trazia uma tabela com Empresa, CNPJ, Endereço, Responsável
     * Técnico e Revisão / Data. Tudo isso já está no corpo do documento — a
     * identificação completa no item 2, a revisão no item 1 —, e na capa só
     * deixava a folha poluída. Estes rótulos não voltam.
     */
    const t = (await capa()).join(" | ");
    ["CNPJ", "Responsável Técnico", "Revisão / Data", "51.213.683/0001-04"].forEach((r) =>
      expect(t, `"${r}" voltou para a capa`).not.toContain(r));
  });

  it("não traz o bloco de revisão e versões no alto", async () => {
    /*
     * "REV. 00" e "PGR v1 · PDF v1 · Rascunho" ficavam no canto superior
     * direito. A revisão está no item 1 e as versões no bloco de validação da
     * última página; a situação de rascunho a marca d'água já grita.
     */
    const t = (await capa()).join(" | ");
    expect(t, "o bloco de revisão voltou para a capa").not.toContain("REV.");
    expect(t, "o bloco de versões voltou para a capa").not.toContain("PDF v");
  });

  it("a capa continua dizendo que documento é", async () => {
    const t = (await capa()).join(" | ");
    expect(t).toContain("PGR");
    expect(t).toContain("Programa de Gerenciamento de Riscos");
    expect(t).toContain("NR-01");
  });

  it("fecha a capa sem o aparato do sistema", async () => {
    /* QR, hash e numeração moram no miolo e na última página. */
    const t = await capa();
    expect(t.some((x) => x.includes("QR Code de validação"))).toBe(false);
    expect(t.some((x) => x.includes("Assinatura ICP-Brasil"))).toBe(false);
    expect(t.some((x) => x.includes("Página 1"))).toBe(false);
  });

  it("o cabeçalho e o rodapé do miolo são os do Word", async () => {
    const pdf = await render(contexto(), {
      qrUrl: "https://safetysolucoes.com/pgr/validar/x", pdfVersao: 1, comMarca: true,
    });
    const p3 = trechosDaCapa2(pdf as never, 3);
    /* O travessão sai em WinAnsi (byte 0x96), não como "–": compara sem ele. */
    expect(
      p3.some((x) => x.startsWith("PGR") && x.includes("Programa de Gerenciamento de Riscos")),
      "faltou o cabeçalho",
    ).toBe(true);
    expect(p3, "faltou a marca no rodapé").toContain("SafetySoluções");
    expect(p3.some((x) => x.includes("Página")), "faltou a numeração").toBe(true);
  });

  it("a validação do sistema fica reunida na última página", async () => {
    /*
     * O QR e o hash saíram do rodapé de todas as páginas: eles são do
     * sistema, não do documento, e repetidos em toda folha davam ao PGR cara
     * de protocolo interno. Sair do rodapé não é sumir — continuam impressos.
     */
    const pdf = await render(contexto(), {
      qrUrl: "https://safetysolucoes.com/pgr/validar/x", pdfVersao: 1, comMarca: true,
    });
    const total = (pdf as never as { internal: { pages: string[][] } }).internal.pages.length - 1;
    const ultima = trechosDaCapa2(pdf as never, total);
    expect(ultima.some((x) => x.includes("Validação interna"))).toBe(true);
    expect(ultima.some((x) => x.includes("assinatura ICP-Brasil não aplicada"))).toBe(true);
  });

  it("não estoura com nome de empresa muito longo", async () => {
    /*
     * O nome não sai mais na capa, mas sai no cabeçalho de todas as páginas
     * do miolo, e é lá que um nome comprido pode passar da margem.
     */
    const nome = "COMPANHIA BRASILEIRA DE SERVICOS INTEGRADOS DE ENGENHARIA E MANUTENCAO INDUSTRIAL LTDA";
    const pdf = await render({ ...contexto(), empresaNome: nome } as never, {
      qrUrl: "https://safetysolucoes.com/pgr/validar/x", pdfVersao: 1, comMarca: false,
    });
    const p3 = trechosDaCapa2(pdf as never, 3);
    const pedacos = p3.filter((x) => nome.includes(x.trim()) && x.trim().length > 3);
    expect(pedacos.length, "o nome da empresa sumiu do cabeçalho").toBeGreaterThan(0);
    expect(pedacos.join(" ").replace(/\s+/g, " ").trim()).toBe(nome);
  });
});
