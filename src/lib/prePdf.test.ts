import { describe, expect, it } from "vitest";
import { faltasDoCenario, render, type PreCenario, type PreContext } from "./prePdf";

function textoDoPdf(pdf: { internal: { pages: string[][] } }): string {
  return pdf.internal.pages
    .filter(Boolean)
    .map((pagina) => (pagina.join("\n").match(/\((?:\\.|[^\\()])*\)/g) ?? [])
      .map((t) => t.slice(1, -1)).join(" "))
    .join("\n");
}

const cenario = (extra: Partial<PreCenario> = {}): PreCenario => ({
  id: "c1", nome: "Princípio de incêndio na marcenaria", tipo: "incendio",
  descricao: "Ignição de serragem acumulada junto à serra.",
  grande_magnitude: false,
  procedimento_resposta: "Acionar o alarme e usar o extintor de pó químico.",
  primeiros_socorros: "Brigadista aplica resfriamento e aciona o SAMU.",
  encaminhamento_acidentados: "Remoção pelo SAMU até o hospital municipal.",
  abandono_ponto_encontro: "Saída pelos portões 1 e 2; ponto de encontro no pátio.",
  meios_recursos: "Extintores ABC, mangotinho e maca.",
  responsaveis: "Brigada de incêndio",
  periodicidade_simulado: "Semestral",
  ultimo_simulado: "2026-03-10",
  proximo_simulado: "2026-09-10",
  ...extra,
});

function contexto(cenarios: PreCenario[]): PreContext {
  return {
    pgrId: "d2840596-aaaa-bbbb-cccc-ddddeeeeffff",
    status: "vigente",
    dataEmissao: "2026-07-01",
    respTecNome: "JOSÉ IVAN HOLANDA DE MELO JUNIOR",
    respTecRegistro: "CREA-CE 123456/D",
    empresaNome: "LEONARDO A. DE ARAUJO LTDA",
    empresaCnpj: "51.213.683/0001-04",
    unidadeNome: null,
    codigoDocumento: "PGR v1",
    logoDataUrl: null,
    cenarios,
  };
}

const gerar = async (cenarios: PreCenario[]) => textoDoPdf(
  await render(contexto(cenarios), { qrUrl: "https://safetysolucoes.com/pgr/validar/x?doc=pre", comMarca: false }) as unknown as { internal: { pages: string[][] } },
);

describe("faltasDoCenario", () => {
  it("cobra o que o item 1.5.6.2 da NR-01 exige", () => {
    expect(faltasDoCenario(cenario())).toEqual([]);
    expect(faltasDoCenario(cenario({ primeiros_socorros: null })))
      .toEqual(["primeiros socorros"]);
    // Espaço em branco não é procedimento preenchido.
    expect(faltasDoCenario(cenario({ abandono_ponto_encontro: "   " })))
      .toEqual(["abandono"]);
  });
});

describe("PDF do PRE", () => {
  it("é documento próprio, com capa e base normativa", async () => {
    const texto = await gerar([cenario()]);
    expect(texto).toContain("PRE");
    expect(texto).toContain("Plano de Preparação para Emergências");
    expect(texto).toContain("LEONARDO A. DE ARAUJO LTDA");
    expect(texto).toContain("Objeto e Base Normativa");
    // A razão de existir separado precisa estar escrita no documento.
    expect(texto).toContain("sem integrar o PGR");
  });

  it("imprime o procedimento e o simulado de cada cenário", async () => {
    const texto = await gerar([cenario()]);
    expect(texto).toContain("Princípio de incêndio na marcenaria");
    expect(texto).toContain("Acionar o alarme e usar o extintor de pó químico.");
    expect(texto).toContain("Exercícios Simulados");
    expect(texto).toContain("10/03/2026");
  });

  it("campo vazio não vira procedimento definido como travessão", async () => {
    // Os três jeitos de um campo estar vazio: ausente, string vazia e o que o
    // formulário mais produz — espaços deixados por quem apagou o texto.
    const texto = await gerar([cenario({
      comunicacao: null, licoes_aprendidas: "", medidas_prevencao: "   \n ",
    })]);
    expect(texto).not.toContain("Comunicação e acionamento externo");
    expect(texto).not.toContain("Lições aprendidas");
    expect(texto).not.toContain("Medidas de prevenção");
  });

  it("lista as faltas do 1.5.6.2 numa conferência ao fim", async () => {
    const completo = await gerar([cenario()]);
    expect(completo).not.toContain("Pendências de Preenchimento");

    const faltando = await gerar([cenario({ primeiros_socorros: null, meios_recursos: null })]);
    expect(faltando).toContain("Pendências de Preenchimento");
    expect(faltando).toContain("primeiros socorros, meios e recursos");
  });

  it("sem cenário registrado, diz isso em vez de sair em branco", async () => {
    const texto = await gerar([]);
    expect(texto).toContain("Nenhum cenário de emergência registrado.");
    expect(texto).not.toContain("Exercícios Simulados");
  });
});
