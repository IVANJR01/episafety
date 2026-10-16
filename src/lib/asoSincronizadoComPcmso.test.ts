import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * O ASO e o PCMSO enxergam a MESMA lista de exames.
 *
 * O documento do PCMSO monta a lista pela NR-07 a partir dos riscos
 * quando a Matriz de Saúde está vazia. O Portal de ASO lia só a Matriz, e
 * sem ela devolvia lista vazia: o PCMSO saía com a lista cheia e o ASO do
 * mesmo colaborador saía sem exame nenhum. Conferido no banco: a Matriz
 * tem uma linha em todo o sistema.
 *
 * Este teste roda o carregador do ASO de verdade, com o banco de mentira.
 */

const TABELAS: Record<string, unknown[]> = {};

vi.mock("@/integrations/supabase/client", () => {
  const consulta = (tabela: string) => {
    const e: any = {
      select: () => e, eq: () => e, in: () => e, is: () => e, not: () => e,
      order: () => e, limit: () => e,
      then: (ok: (v: unknown) => unknown) =>
        Promise.resolve({ data: TABELAS[tabela] ?? [], error: null }).then(ok),
    };
    return e;
  };
  return { supabase: { from: (t: string) => consulta(t) } };
});

const { loadGheRiscosExames } = await import("./asoFromGhe");
const { examesNormativosDoGes, examesDoTipoDeExame } = await import("./examesDoGes");

beforeEach(() => {
  for (const k of Object.keys(TABELAS)) delete TABELAS[k];
  TABELAS["ghe_riscos"] = [
    { grupo: "fisico", tipo_agente: "Ruído contínuo", texto_aso: "Ruído contínuo" },
    { grupo: "ergonomico", tipo_agente: "Movimentos repetitivos", texto_aso: "" },
  ];
  TABELAS["ghe_exames"] = [];
});

describe("Matriz de Saúde vazia", () => {
  it("o ASO não sai sem exame nenhum", async () => {
    const { exames } = await loadGheRiscosExames("g1", "admissional");
    expect(exames.length, "o ASO saiu sem exame nenhum").toBeGreaterThan(0);
  });

  it("sai a mesma lista que o PCMSO escreveria", async () => {
    const { riscos, exames } = await loadGheRiscosExames("g1", "admissional");
    const doPcmso = examesDoTipoDeExame(
      examesNormativosDoGes(riscos.map((r) => r.descricao)), "admissional",
    );
    expect(exames.map((e) => e.codigo)).toEqual(doPcmso.map((e) => e.codigo));
  });

  it("com ruído no GES, a audiometria entra no ASO", async () => {
    /* NR-07, Anexo II. Era o exame que mais falta num ASO de costura. */
    const { exames } = await loadGheRiscosExames("g1", "periodico");
    expect(exames.map((e) => e.nome_exame).join(" ")).toContain("Audiometria");
  });

  it("sem ruído, a audiometria não entra", async () => {
    TABELAS["ghe_riscos"] = [
      { grupo: "ergonomico", tipo_agente: "Movimentos repetitivos", texto_aso: "Movimentos repetitivos" },
    ];
    const { exames } = await loadGheRiscosExames("g1", "periodico");
    expect(exames.map((e) => e.nome_exame).join(" ")).not.toContain("Audiometria");
  });
});

describe("Matriz de Saúde preenchida", () => {
  it("o que o médico cadastrou tem precedência sobre a base normativa", async () => {
    TABELAS["ghe_exames"] = [
      { nome_exame: "Hemograma completo", codigo_exame: "0301", tipo_exame: "laboratorial",
        periodicidade_meses: 12, admissional: true, periodico: true },
    ];
    const { exames } = await loadGheRiscosExames("g1", "admissional");
    expect(exames.map((e) => e.nome_exame)).toEqual(["Hemograma completo"]);
  });

  it("exame que não vale para este tipo de ASO não aparece", async () => {
    TABELAS["ghe_exames"] = [
      { nome_exame: "Hemograma completo", codigo_exame: "0301",
        periodicidade_meses: 12, admissional: false, periodico: true },
    ];
    /*
     * Nenhum exame cadastrado serve para o admissional: aí vale a base
     * normativa, e não uma lista vazia.
     */
    const { exames } = await loadGheRiscosExames("g1", "admissional");
    expect(exames.map((e) => e.nome_exame)).not.toContain("Hemograma completo");
    expect(exames.length).toBeGreaterThan(0);
  });
});
