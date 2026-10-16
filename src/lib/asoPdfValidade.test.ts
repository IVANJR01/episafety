import { describe, expect, it } from "vitest";
import { inferValidadeTipo } from "./asoPdf";

/**
 * O quadrinho de validade que o PDF do ASO marca.
 *
 * Havia aqui a terceira cópia da regra de validade, e ela dizia
 * "demissional = 90 dias; demais = 1 ano". As duas metades estavam
 * erradas (NR-07, 7.5.11 e 7.5.8, II), e o papel — que é o que vai à
 * fiscalização — divergia do que estava gravado no registro.
 */

describe("validade impressa no ASO", () => {
  it("demissional não marca prazo nenhum", () => {
    /* O demissional encerra o vínculo; marcar 90 dias é afirmar o que a
       norma não diz. */
    expect(inferValidadeTipo({ tipo_exame: "demissional", validade_tipo: "90dias" })).toBeNull();
  });

  it("imprime o que foi gravado no registro", () => {
    expect(inferValidadeTipo({ tipo_exame: "periodico", validade_tipo: "2anos" })).toBe("2anos");
    expect(inferValidadeTipo({ tipo_exame: "periodico", validade_tipo: "1ano" })).toBe("1ano");
    expect(inferValidadeTipo({ tipo_exame: "admissional", validade_tipo: "6meses" })).toBe("6meses");
  });

  it("não transforma bienal em anual", () => {
    /* Era isso que o "demais => 1 ano" fazia com quem não tem risco. */
    expect(inferValidadeTipo({ tipo_exame: "periodico", validade_tipo: "2anos" })).not.toBe("1ano");
  });

  it("sem validade_tipo, deduz das datas gravadas", () => {
    expect(inferValidadeTipo({
      tipo_exame: "periodico", data_emissao: "2026-01-01", data_vencimento: "2028-01-01",
    })).toBe("2anos");
    expect(inferValidadeTipo({
      tipo_exame: "periodico", data_emissao: "2026-01-01", data_vencimento: "2027-01-01",
    })).toBe("1ano");
  });

  it("ASO gravado como 'não vence' não marca quadrinho", () => {
    expect(inferValidadeTipo({ tipo_exame: "periodico", validade_tipo: "nao_vence" })).toBeNull();
  });

  it("sem nada, não inventa prazo", () => {
    expect(inferValidadeTipo({ tipo_exame: "periodico" })).toBeNull();
  });
});
