import { describe, expect, it } from "vitest";
import { renderPcmsoPdf } from "./pcmsoPdf";

/**
 * Exigências da NR-07 conferidas no documento gerado.
 *
 * A norma diz o que o PCMSO precisa conter. Duas dessas exigências não
 * existiam no documento, e uma terceira ele contradizia:
 *
 *   7.5.4 "c" — "critérios de interpretação e planejamento das condutas
 *               relacionadas aos achados dos exames médicos": não havia
 *               seção nenhuma.
 *   7.5.4 "e" — relatório analítico do programa (c/c 7.6.2): o sistema
 *               calculava as estatísticas e guardava o texto do médico, e
 *               nada disso chegava ao PDF.
 * A periodicidade do exame clínico (7.5.8, II) é decidida no carregador, e
 * por isso é conferida em pcmsoEspelhaPgr.test.ts: aqui a ficha chega pronta,
 * e um teste que monta a própria resposta não prova regra nenhuma.
 */

function textoDo(pdf: { output: (t: "arraybuffer") => ArrayBuffer }): string[] {
  const bruto = Buffer.from(pdf.output("arraybuffer")).toString("latin1");
  return [...bruto.matchAll(/\((?:\\.|[^\\)])*\) Tj/g)]
    .map((m) => m[0].slice(1, -4).replace(/\\([()\\])/g, "$1"));
}

const SEM = [{
  agente: "Ausência de Fator de Risco", fonte: "Não se aplica", danos: "Não se aplica",
  meioPropagacao: "Não se aplica", formaExposicao: "Não se aplica",
}];

const COM_RISCO = [{
  agente: "Movimentos repetitivos", fonte: "Máquina de costura",
  danos: "LER/DORT", meioPropagacao: "Não se aplica", formaExposicao: "Habitual",
}];

function contexto(opcoes: {
  comRisco?: boolean;
  relatorio?: string;
  estatisticas?: Partial<Record<string, number>>;
} = {}) {
  const base = {
    total: 0, aptos: 0, restricoes: 0, inaptos: 0,
    admissional: 0, periodico: 0, demissional: 0, retorno: 0, mudanca: 0,
  };
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
      riscosErgonomicos: opcoes.comRisco ? COM_RISCO : SEM,
      riscosAcidentes: SEM,
      exames: [{
        codigo: "0295", nome: "Avaliação Clínica Ocupacional", adm: "Sim",
        periodico: opcoes.comRisco ? "Anual" : "Bienal",
        rt: "Sim", mdf: "*", dem: "Sim",
      }],
    }],
    quadroLaboral: [], atividadesLista: [], cronograma: [],
    relatorioAnaliticoTexto: opcoes.relatorio ?? "",
    estatisticasAsos: { ...base, ...(opcoes.estatisticas || {}) },
  } as never;
}

describe("7.5.4 'c' — critérios de interpretação e condutas", () => {
  it("o documento tem a seção", async () => {
    const texto = textoDo(await renderPcmsoPdf(contexto())).join(" | ");
    expect(texto, "a seção exigida pelo 7.5.4 'c' não existe no documento")
      .toContain("Critérios de Interpretação e Condutas".toUpperCase());
  }, 60_000);

  it("descreve a conduta de cada tipo de achado", async () => {
    const texto = textoDo(await renderPcmsoPdf(contexto())).join(" ");
    for (const conduta of [
      "parâmetros de normalidade",
      "sem relação com o trabalho",
      "suspeita de relação com o trabalho",
      "Comunicação de Acidente de Trabalho",
      "retorno gradativo",
    ]) {
      expect(texto, `faltou a conduta "${conduta}"`).toContain(conduta);
    }
  }, 60_000);

  it("diz que a interpretação clínica é do médico, não do sistema", async () => {
    /*
     * A seção descreve o PROCESSO do programa. Critério clínico de aptidão é
     * do médico coordenador, e o documento não pode dar a entender o
     * contrário.
     */
    const texto = textoDo(await renderPcmsoPdf(contexto())).join(" ");
    expect(texto).toContain("atribuição exclusiva do Médico Coordenador");
    expect(texto).toContain("prontuário médico individual");
  }, 60_000);
});

describe("7.5.4 'e' c/c 7.6.2 — relatório analítico", () => {
  it("o documento tem a seção, com os números da alínea 'a'", async () => {
    const pdf = await renderPcmsoPdf(contexto({
      estatisticas: { total: 12, admissional: 5, periodico: 4, demissional: 3 },
    }));
    const texto = textoDo(pdf).join(" ");
    expect(texto, "a seção exigida pelo 7.5.4 'e' não existe")
      .toContain("RELATÓRIO ANALÍTICO DO PROGRAMA");
    expect(texto).toContain("Exames clínicos ocupacionais realizados: 12");
    expect(texto).toContain("admissionais: 5");
  }, 60_000);

  it("o texto do médico entra inteiro quando existe", async () => {
    const analise = "Nenhum resultado anormal no período, sem CAT emitida.";
    const texto = textoDo(await renderPcmsoPdf(contexto({ relatorio: analise }))).join(" ");
    expect(texto).toContain("Nenhum resultado anormal no período");
  }, 60_000);

  it("sem o texto do médico, diz o que falta — não finge que está pronto", async () => {
    const texto = textoDo(await renderPcmsoPdf(contexto())).join(" ");
    expect(texto).toContain("não registrada até a emissão deste documento");
    /* E nomeia as alíneas que dependem do prontuário. */
    expect(texto).toContain("dependem dos dados dos prontuários médicos");
  }, 60_000);
});
