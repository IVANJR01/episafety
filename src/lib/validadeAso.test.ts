import { describe, expect, it } from "vitest";
import {
  validadeDoAso, dispensaDemissional, janelaDispensaDemissional,
} from "./validadeAso";

/**
 * A regra de validade do ASO, conferida contra o texto da NR-07 (2022).
 *
 * O que havia antes: o formulário abria em "1 ano" para qualquer tipo de
 * exame, e o catálogo tinha um "ASO" de 12 meses e um "ASO - DEMISSIONAL"
 * de 2 meses. Nenhum desses números está na norma.
 */

describe("periodicidade do exame clínico — 7.5.8, II", () => {
  it("exposto a risco do PGR: um ano", () => {
    const v = validadeDoAso("periodico", true);
    expect(v.meses).toBe(12);
    expect(v.base).toContain("7.5.8");
  });

  it("sem risco identificado: dois anos", () => {
    /* Era o caso que o "1 ano" fixo cobrava a mais, todo ano. */
    expect(validadeDoAso("periodico", false).meses).toBe(24);
  });

  it("admissional, retorno e mudança de risco seguem o mesmo relógio", () => {
    for (const t of ["admissional", "retorno", "mudanca_risco"] as const) {
      expect(validadeDoAso(t, true).meses, t).toBe(12);
      expect(validadeDoAso(t, false).meses, t).toBe(24);
    }
  });
});

describe("demissional — 7.5.11", () => {
  it("não vence", () => {
    /*
     * Dar validade ao demissional faz o sistema cobrar documento de quem
     * não trabalha mais ali. O cadastro tinha ele com 2 meses.
     */
    const v = validadeDoAso("demissional", true);
    expect(v.meses, "o demissional ganhou prazo de vencimento").toBeNull();
    expect(validadeDoAso("demissional", false).meses).toBeNull();
  });

  it("a janela de dispensa é 135 ou 90 dias, pelo grau de risco", () => {
    expect(janelaDispensaDemissional(1)).toBe(135);
    expect(janelaDispensaDemissional(2)).toBe(135);
    expect(janelaDispensaDemissional(3)).toBe(90);
    expect(janelaDispensaDemissional(4)).toBe(90);
  });

  it("sem grau de risco cadastrado, não chuta a janela", () => {
    expect(janelaDispensaDemissional(null)).toBeNull();
    expect(janelaDispensaDemissional(undefined)).toBeNull();
  });

  it("exame recente dispensa o demissional", () => {
    const r = dispensaDemissional("2026-06-01", "2026-09-01", 1); // 92 dias
    expect(r.dispensado).toBe(true);
    expect(r.diasDesdeUltimoExame).toBe(92);
    expect(r.janelaDias).toBe(135);
  });

  it("o mesmo exame NÃO dispensa numa empresa de grau 3", () => {
    /* 92 dias cabe em 135 e não cabe em 90: é o grau de risco que decide. */
    const r = dispensaDemissional("2026-06-01", "2026-09-01", 3);
    expect(r.dispensado).toBe(false);
    expect(r.janelaDias).toBe(90);
  });

  it("exatamente no limite, não dispensa", () => {
    /* A norma diz "há MENOS de 135 dias". O empate fica do lado do exame. */
    expect(dispensaDemissional("2026-01-01", "2026-05-16", 1).diasDesdeUltimoExame).toBe(135);
    expect(dispensaDemissional("2026-01-01", "2026-05-16", 1).dispensado).toBe(false);
    expect(dispensaDemissional("2026-01-01", "2026-05-15", 1).dispensado).toBe(true);
  });

  it("sem exame anterior, o demissional é obrigatório", () => {
    const r = dispensaDemissional(null, "2026-09-01", 1);
    expect(r.dispensado).toBe(false);
    expect(r.motivo).toContain("obrigatório");
  });

  it("sem grau de risco, não dispensa e diz o que falta", () => {
    const r = dispensaDemissional("2026-08-25", "2026-09-01", null);
    expect(r.dispensado, "dispensou sem saber qual é a janela").toBe(false);
    expect(r.motivo).toContain("Grau de risco");
  });

  it("não estoura com data inválida", () => {
    expect(dispensaDemissional("não é data", "2026-09-01", 1).dispensado).toBe(false);
  });
});
