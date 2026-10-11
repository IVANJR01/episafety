import { describe, expect, it } from "vitest";
import { render, type PgrPdfContext } from "./pgrPdf";

/**
 * O PGR só imprime o que a NR-01 exige.
 *
 * Base: item 1.5.7.1 ("o PGR deve conter, no mínimo, inventário de riscos e
 * plano de ação"), 1.5.7.3.2 (conteúdo mínimo do inventário: caracterização
 * dos processos e ambientes, caracterização das atividades, grupos expostos,
 * avaliação e critérios) e 1.5.7.2 (documentos datados e assinados).
 *
 * O conteúdo das letras "a", "b" e "e" — ambientes, atividades e grupos
 * expostos — vive DENTRO do inventário, no cabeçalho de cada GES. É onde a
 * norma o pede e é como a planilha e o documento em Word da SafetySoluções
 * sempre fizeram. Havia quatro seções separadas para isso; num PGR real elas
 * ocupavam 8 das 14 páginas e descreviam cada ambiente longe dos riscos que
 * acontecem nele.
 *
 * O que saiu do documento tem motivo declarado:
 * — Preparação e Resposta a Emergências: o FAQ GRO/PGR do MTE, pergunta 59,
 *   diz que a documentação dos procedimentos de emergência fica na empresa
 *   "sem integrar o PGR";
 * — Quadro de EPIs, Referências, Definições, Abrangência, Resumo quantitativo,
 *   Monitoramento e os apêndices: nenhum item da norma os pede.
 */
function textoDoPdf(pdf: { internal: { pages: string[][] } }): string {
  return pdf.internal.pages
    .filter(Boolean)
    .map((pagina) => (pagina.join("\n").match(/\((?:\\.|[^\\()])*\)/g) ?? [])
      .map((t) => t.slice(1, -1)).join(" "))
    .join("\n");
}

function contexto(): PgrPdfContext {
  return {
    doc: {
      id: "d2840596-aaaa-bbbb-cccc-ddddeeeeffff", versao: 1, status: "rascunho",
      data_emissao: "2026-07-01", data_vigencia_inicio: "2026-07-01", data_vigencia_fim: "2028-06-30",
      resp_tec_nome: "JOSÉ IVAN HOLANDA DE MELO JUNIOR", resp_tec_registro: "CREA-CE 123456/D",
    },
    empresaNome: "LEONARDO A. DE ARAUJO LTDA",
    empresaCnpj: "51.213.683/0001-04",
    emissorNome: "3M CURSOS E TREINAMENTOS",
    emissorLinhas: [], emissorLogoDataUrl: null,
    unidadeNome: null, codigoDocumento: "PGR-2026-D2840596",
    inventario: [{
      id: "i1", ghe_id: "g1", grupo: "fisico", perigo_descricao: "Ruído contínuo",
      fonte_geradora: "Serra circular", severidade: 3, probabilidade: 3,
      classificacao: "moderado", trabalhadores_expostos: 4, controles_existentes: "Protetor auricular",
      /* Letras "a", "b" e "e" do 1.5.7.3.2 — vêm no cabeçalho do GES. */
      descricao_ambiente: "Galpão de produção com piso cimentado e ventilação natural",
      processo: "Corte e aparelhamento de madeira", setor: "Produção",
      funcoes_snapshot: ["Marceneiro", "Auxiliar de marcenaria"],
    }] as any,
    acoes: [{
      id: "a1", descricao: "Enclausurar a serra", status: "pendente", prazo: "2026-12-01",
      what: "Enclausurar", why: "Ruído acima do limite", who: "Manutenção",
      where_local: "Marcenaria", how: "Cabine acústica", how_much: 12000,
      classe_risco: "moderado",
    }] as any,
    evidencias: [], revisoes: [], assinaturas: [],
    ghes: { g1: "Marcenaria" }, textos: {}, unidades: [], responsaveis: [],
    ambientes: [{ id: "am1", nome: "Galpão de produção" }],
    processos: [{ id: "p1", nome: "Corte de madeira", setor_id: "s1" }],
    setores: [{ id: "s1", nome: "Produção" }],
    gesDetalhes: [{ id: "g1", nome: "Marcenaria" }],
    funcoes: [{ id: "f1", nome: "Marceneiro", setor_id: "s1" }],
    atividades: [],
    logoDataUrl: null,
  } as unknown as PgrPdfContext;
}

const gerar = async () => textoDoPdf(await render(contexto(), {
  qrUrl: "https://safetysolucoes.com/pgr/validar/x", pdfVersao: 1, comMarca: true,
}) as unknown as { internal: { pages: string[][] } });

describe("seções do PGR", () => {
  it("imprime o que a NR-01 exige", async () => {
    const texto = await gerar();
    [
      "Controle de Revisões",                       // 1.5.7.3.3.1 — histórico
      "Identificação da Empresa e do Estabelecimento", // 1.5.3.1 — por estabelecimento
      "Metodologia de Avaliação",                   // 1.5.7.3.2 "f"
      "Inventário de Riscos Ocupacionais",          // 1.5.7.1 "a"
      "Plano de Ação",                              // 1.5.7.1 "b"
      "Assinaturas",                                // 1.5.7.2
    ].forEach((secao) => expect(texto, `faltou "${secao}"`).toContain(secao));
  });

  it("traz ambientes, atividades e grupos expostos dentro do inventário", async () => {
    /*
     * Estas três letras do 1.5.7.3.2 tinham uma seção inteira cada. O teste
     * antigo cobrava o TÍTULO da seção; este cobra a informação, que é o que
     * a norma de fato exige — e não deixa o conteúdo sumir se alguém mexer no
     * formato de novo.
     */
    const texto = await gerar();
    expect(texto, 'letra "e" — grupo de trabalhadores exposto').toContain("GES: Marcenaria");
    expect(texto, 'letra "e" — setor').toContain("Setor: Produção");
    expect(texto, 'letra "e" — funções').toContain("Marceneiro");
    expect(texto, 'letra "a" — ambiente').toContain("Galpão de produção");
    expect(texto, 'letra "b" — atividades').toContain("Corte e aparelhamento de madeira");
  });

  it("não imprime seção que a norma não pede", async () => {
    const texto = await gerar();
    [
      "Preparação e Resposta a Emergências",
      "Quadro Sinóptico de Utilização de EPIs",
      "Elaboração e Habilidade Técnica",
      "Abrangência",
      "Referências",
      "Definições",
      "Resumo quantitativo dos riscos",
      "Monitoramento e Revisão",
      "Apêndice A",
      "Apêndice B",
      /* Quatro seções que repetiam, longe dos riscos, o que agora abre cada
         GES dentro do inventário. */
      "Caracterização dos Ambientes de Trabalho",
      "Processos de Trabalho",
      "Setores e Grupos de Exposição Semelhante",
      "Funções e Atividades",
    ].forEach((secao) => expect(texto, `"${secao}" voltou ao documento`).not.toContain(secao));
  });
});

describe("defeitos que já saíram impressos", () => {
  it("não imprime a barra-n literal no inventário", async () => {
    const texto = await gerar();
    // `join("\\n")` em TypeScript é barra invertida + n: o PDF saiu com
    // "01\n0 expostos\nSem setor" escrito assim, em vez de quebrar linha.
    expect(texto).not.toContain("\\n");
  });

  it("usa os rótulos do 5W2H em português", async () => {
    const texto = await gerar();
    ["Why:", "Who:", "Where:", "When:", "How much:"].forEach((ingles) =>
      expect(texto, `"${ingles}" voltou ao plano de ação`).not.toContain(ingles));
  });

  it("numera as seções, para o documento poder ser citado", async () => {
    const texto = await gerar();
    expect(texto).toContain("1. Controle de Revisões");
    expect(texto).toContain("Inventário de Riscos Ocupacionais");
  });
});
