import { describe, expect, it } from "vitest";
import { caracteristicasNaoRepetidas, normalizar } from "./pgrCaracteristicas";

describe("normalizar", () => {
  it("tira acento, caixa e pontuação", () => {
    expect(normalizar("Ventilação: Natural e/ou forçada")).toBe("ventilacao natural e ou forcada");
  });
});

describe("caracteristicasNaoRepetidas", () => {
  const campos: Array<[string, unknown]> = [
    ["Tipo", "interno"],
    ["Pé-direito", "3 m"],
    ["Piso", "Cerâmico"],
    ["Ventilação", "Natural e forçada"],
    ["Trabalhadores", 12],
  ];

  it("some com o campo que a descrição já diz, mesmo escrito diferente", () => {
    const desc = "Pé-direito: 3 m · Piso cerâmico · Ventilação natural e forçada. Ambiente interno destinado à costura.";
    expect(caracteristicasNaoRepetidas(campos, desc)).toEqual(["Trabalhadores: 12"]);
  });

  it("mantém tudo quando não há descrição", () => {
    expect(caracteristicasNaoRepetidas(campos, null)).toHaveLength(5);
    expect(caracteristicasNaoRepetidas(campos, "")).toHaveLength(5);
  });

  it("ignora campo vazio", () => {
    expect(caracteristicasNaoRepetidas([["Piso", ""], ["Teto", null], ["Tipo", "interno"]], "")).toEqual([
      "Tipo: interno",
    ]);
  });

  it("não deixa valor curto sumir por coincidência", () => {
    // "3" está em "30 trabalhadores", mas o pé-direito não foi dito.
    const soNumero: Array<[string, unknown]> = [["Pé-direito", "3"]];
    expect(caracteristicasNaoRepetidas(soNumero, "Ambiente com 30 trabalhadores")).toEqual(["Pé-direito: 3"]);
  });

  it("descrição que cobre tudo só deixa o que é curto demais para comparar", () => {
    const desc = "interno, 3 m de pé-direito, piso cerâmico, ventilação natural e forçada, 12 trabalhadores";
    // "12" tem menos de três caracteres e fica: some dentro de "120" ou de
    // qualquer data, e sumir por coincidência é pior do que repetir.
    expect(caracteristicasNaoRepetidas(campos, desc)).toEqual(["Trabalhadores: 12"]);
  });
});
