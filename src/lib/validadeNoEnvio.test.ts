import { describe, expect, it } from "vitest";
import { calcularValidade, validadeDoCampo } from "./arquivoDigital";

/**
 * O vencimento de uma versão enviada pelo dossiê.
 *
 * `publicarVersao` decide assim: `dataValidade` informada vence tudo;
 * `undefined` manda calcular pelo prazo do tipo; `null` grava "sem
 * vencimento".
 *
 * A tela mandava `null` quando o campo ficava vazio, embora o texto
 * embaixo dele prometesse "deixe vazio para o sistema usar o padrão do
 * tipo". O padrão nunca se aplicava. Três ASOs desta empresa ficaram sem
 * data de vencimento por isso.
 *
 * Esta é a regra que a tela precisa respeitar, escrita aqui porque é dela
 * que sai o número gravado.
 */

/** O mesmo que `publicarVersao` faz com os três campos. */
function vencimentoDaVersao(p: {
  dataEmissao: string;
  validadeMeses?: number | null;
  validadeDias?: number | null;
  dataValidade?: string | null;
}) {
  return p.dataValidade !== undefined
    ? p.dataValidade
    : calcularValidade(p.dataEmissao, p.validadeMeses, p.validadeDias);
}

describe("o que o campo Validade vira", () => {
  it("vazio é 'usa o padrão do tipo', e não 'sem vencimento'", () => {
    /* Era aqui que a tela errava: mandava null e o padrão sumia. */
    expect(validadeDoCampo(""), "vazio virou 'sem vencimento'").toBeUndefined();
    expect(validadeDoCampo("   ")).toBeUndefined();
    expect(validadeDoCampo(null)).toBeUndefined();
    expect(validadeDoCampo(undefined)).toBeUndefined();
  });

  it("data informada passa adiante", () => {
    expect(validadeDoCampo("2026-04-10")).toBe("2026-04-10");
  });
});

describe("vencimento da versão enviada", () => {
  it("campo preenchido manda, mesmo contra o prazo do tipo", () => {
    expect(vencimentoDaVersao({
      dataEmissao: "2026-01-10", validadeMeses: 12, dataValidade: "2026-04-10",
    })).toBe("2026-04-10");
  });

  it("campo vazio usa o prazo do tipo", () => {
    expect(vencimentoDaVersao({
      dataEmissao: "2026-01-10", validadeMeses: 12, dataValidade: validadeDoCampo(""),
    })).toBe("2027-01-10");
    expect(vencimentoDaVersao({
      dataEmissao: "2026-01-10", validadeMeses: 12, dataValidade: null,
    }), "null apagou o prazo do tipo").toBeNull();
  });

  it("tipo sem prazo e campo vazio: documento permanente", () => {
    expect(vencimentoDaVersao({ dataEmissao: "2026-01-10" })).toBeNull();
  });

  it("tipo sem prazo e data informada: vence na data informada", () => {
    /*
     * É o caso do ASO depois da unificação: o tipo não tem prazo, porque
     * o prazo é do exame — 90 dias, um ano, dois anos.
     */
    expect(vencimentoDaVersao({
      dataEmissao: "2026-01-10", dataValidade: "2026-04-10",
    })).toBe("2026-04-10");
  });

  it("prazo em dias do tipo continua tendo precedência sobre meses", () => {
    expect(vencimentoDaVersao({
      dataEmissao: "2026-01-10", validadeMeses: 12, validadeDias: 90,
    })).toBe(calcularValidade("2026-01-10", null, 90));
  });
});
