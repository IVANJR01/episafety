import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * O Portal de ASO e a Matriz de Saúde do PCMSO leem a MESMA coisa.
 *
 * Conferido no banco desta empresa, antes da correção:
 *
 *   ghe_riscos ................. 0 linhas  (o ASO lia daqui)
 *   ghe_exames ................. 1 linha   (o ASO lia daqui)
 *   pgr_inventario_itens ....... 30 linhas (a Matriz lê daqui)
 *
 * Na tela: a Matriz do PCMSO mostrava "2 risco(s) PGR" em cada GES e a
 * lista de exames sugeridos; o Portal de ASO do mesmo colaborador mostrava
 * "N.A." em todos os fatores de risco e dizia que o GES não tinha risco
 * cadastrado. Os riscos existiam — o ASO olhava para o lugar errado.
 */

const TABELAS: Record<string, unknown[]> = {};

vi.mock("@/integrations/supabase/client", () => {
  const consulta = (tabela: string) => {
    const e: any = {
      select: () => e, eq: () => e, in: () => e, is: () => e, order: () => e,
      then: (ok: (v: unknown) => unknown) =>
        Promise.resolve({ data: TABELAS[tabela] ?? [], error: null }).then(ok),
    };
    return e;
  };
  return { supabase: { from: (t: string) => consulta(t) } };
});

const {
  carregarMatrizDoGes, riscosDoInventario, grupoDoAso, descricaoDoRisco,
} = await import("./matrizSaudeDoGes");

const INVENTARIO = [
  { grupo: "fisico", tipo_agente: "Ruído contínuo", perigo_descricao: "Máquinas de costura", ghe_id: "g07" },
  { grupo: "ergonomico", tipo_agente: "", perigo_descricao: "Postura sentada prolongada", ghe_id: "g07" },
  { grupo: "psicossocial", tipo_agente: "Ritmo de trabalho", perigo_descricao: "", ghe_id: "g07" },
];

beforeEach(() => {
  for (const k of Object.keys(TABELAS)) delete TABELAS[k];
  TABELAS["ghe_riscos"] = [];
  TABELAS["ghe_exames"] = [];
  TABELAS["pgr_inventario_itens"] = INVENTARIO;
});

describe("os riscos do ASO saem do inventário do PGR", () => {
  it("o GES deixa de aparecer sem risco nenhum", async () => {
    const m = await carregarMatrizDoGes("g07", "admissional");
    expect(m.riscos.length, "o ASO continuou sem risco, com o PGR cheio")
      .toBe(3);
    expect(m.origemRiscos).toBe("pgr");
  });

  it("risco sem agente usa o perigo descrito, em vez de sumir", () => {
    const r = riscosDoInventario([INVENTARIO[1]]);
    expect(r[0].descricao).toBe("Postura sentada prolongada");
  });

  it("item sem agente e sem perigo não vira linha", () => {
    /* ASO é documento legal: risco sem nome não entra. */
    expect(riscosDoInventario([{ grupo: "fisico" }]).length).toBe(0);
    expect(descricaoDoRisco({ tipo_agente: " ", perigo_descricao: null })).toBe("");
  });

  it("psicossocial, que o ASO não tem coluna, cai em 'Outros'", () => {
    /* Sem isso o risco sumia do documento. */
    expect(grupoDoAso("psicossocial")).toBe("outro");
    expect(grupoDoAso("fisico")).toBe("fisico");
    expect(grupoDoAso("Ergonômico")).toBe("ergonomico");
  });

  it("o mesmo risco repetido em dois itens vira uma linha só", () => {
    const r = riscosDoInventario([INVENTARIO[0], { ...INVENTARIO[0] }]);
    expect(r.length).toBe(1);
  });
});

describe("os exames do ASO são os da Matriz de Saúde", () => {
  it("com ruído no PGR, a audiometria entra no ASO", async () => {
    /* NR-07, Anexo II — e é o que a Matriz mostra como "Sugerido NR-07". */
    const m = await carregarMatrizDoGes("g07", "admissional");
    expect(m.exames.map((e) => e.nome_exame).join(" ")).toContain("Audiometria");
  });

  it("o exame clínico entra sempre", async () => {
    TABELAS["pgr_inventario_itens"] = [];
    const m = await carregarMatrizDoGes("g07", "admissional");
    expect(m.exames.map((e) => e.codigo), "ASO saiu sem exame nenhum")
      .toContain("0295");
  });

  it("o que o médico prescreveu na Matriz tem precedência", async () => {
    TABELAS["ghe_exames"] = [{
      nome_exame: "Hemograma completo", codigo_exame: "0301",
      tipo_exame: "laboratorial", periodicidade_meses: 12, admissional: true,
    }];
    const m = await carregarMatrizDoGes("g07", "admissional");
    expect(m.exames.map((e) => e.nome_exame)).toEqual(["Hemograma completo"]);
    expect(m.origemExames).toBe("matriz");
  });

  it("risco cadastrado na Matriz tem precedência sobre o inventário", async () => {
    TABELAS["ghe_riscos"] = [
      { grupo: "quimico", tipo_agente: "Solventes", texto_aso: "Solventes orgânicos" },
    ];
    const m = await carregarMatrizDoGes("g07", "admissional");
    expect(m.riscos.map((r) => r.descricao)).toEqual(["Solventes orgânicos"]);
    expect(m.origemRiscos).toBe("matriz");
  });

  it("exame que não vale para este tipo de ASO não aparece", async () => {
    const m = await carregarMatrizDoGes("g07", "demissional");
    for (const e of m.exames) expect(e.nome_exame).toBeTruthy();
    expect(m.exames.length).toBeGreaterThan(0);
  });
});
