import { describe, expect, it } from "vitest";
import { renderPcmsoPdf } from "./pcmsoPdf";

/**
 * O cronograma impresso diz MÊS e ano, não dia.
 *
 * O campo pedia dia/mês/ano e o documento imprimia 20/05/2026 — um dia
 * que ninguém combinou. O cronograma do PCMSO planeja o ano.
 */

function textoDo(pdf: { output: (t: "arraybuffer") => ArrayBuffer }): string {
  const bruto = Buffer.from(pdf.output("arraybuffer")).toString("latin1");
  return [...bruto.matchAll(/\((?:\\.|[^\\)])*\) Tj/g)]
    .map((m) => m[0].slice(1, -4).replace(/\\([()\\])/g, "$1"))
    .join(" | ");
}

const SEM = [{
  agente: "Ausência de Fator de Risco", fonte: "Não se aplica", danos: "Não se aplica",
  meioPropagacao: "Não se aplica", formaExposicao: "Não se aplica",
}];

function contexto(cronograma: unknown[]) {
  return {
    pcmso: {
      id: "p1", versao: 1, status: "vigente", data_emissao: "2026-06-30",
      data_vigencia_inicio: "2026-06-30", data_vigencia_fim: "2027-06-30",
    },
    empresa: { id: "e1", nome: "EMPRESA TESTE", cnpj: "1", grau_risco: 1 },
    emissor: { nome: "SAFETY" },
    medicoCoordenador: { nome: "Roger", crm: "6353", uf: "CE" },
    medicosExaminadores: [], ambientes: [], cargos: [],
    fichasExame: [{
      numero: "01", setor: "COSTURA", funcoes: ["COSTUREIRA"],
      riscosFisicos: SEM, riscosQuimicos: SEM, riscosBiologicos: SEM,
      riscosErgonomicos: SEM, riscosAcidentes: SEM,
      exames: [{ codigo: "0295", nome: "Avaliação Clínica Ocupacional",
        adm: "Sim", periodico: "Anual", rt: "Sim", mdf: "*", dem: "Sim" }],
    }],
    quadroLaboral: [], atividadesLista: [], cronograma,
    relatorioAnaliticoTexto: "",
    estatisticasAsos: {
      total: 0, aptos: 0, restricoes: 0, inaptos: 0,
      admissional: 0, periodico: 0, demissional: 0, retorno: 0, mudanca: 0,
    },
  } as never;
}

describe("prazo das ações do cronograma", () => {
  it("sai o mês por extenso, e não o dia", async () => {
    const texto = textoDo(await renderPcmsoPdf(contexto([
      { acao: "Campanha de vacinação", responsavel: "SESMT", data_planejada: "2026-05-01" },
    ])));
    expect(texto).toContain("Maio/2026");
    expect(texto, "o documento afirmou um dia que ninguém combinou")
      .not.toContain("01/05/2026");
  }, 60_000);

  it("ação gravada com dia no meio do mês também sai só com o mês", async () => {
    /* As ações cadastradas antes desta mudança têm dia qualquer. */
    const texto = textoDo(await renderPcmsoPdf(contexto([
      { acao: "Treinamento de ergonomia", responsavel: "SESMT", data_planejada: "2026-08-23" },
    ])));
    expect(texto).toContain("Agosto/2026");
    expect(texto).not.toContain("23/08/2026");
  }, 60_000);

  it("sem data, o prazo sai em palavras", async () => {
    const texto = textoDo(await renderPcmsoPdf(contexto([
      { acao: "Revisão do PCMSO", responsavel: "Médico Coordenador", data_planejada: null },
    ])));
    expect(texto).toContain("Durante o ano");
  }, 60_000);
});
