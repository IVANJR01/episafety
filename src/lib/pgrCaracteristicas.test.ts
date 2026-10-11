import { describe, expect, it } from "vitest";
import { caracteristicasNaoRepetidas, normalizar, ambientesSemRepeticao } from "./pgrCaracteristicas";

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

describe("ambientesSemRepeticao", () => {
  const amb = (nome: string, descricao = "") => ({ nome, descricao });

  it("junta o mesmo ambiente cadastrado duas vezes", () => {
    const r = ambientesSemRepeticao([amb("CORTE", "aaa"), amb("CORTE", "bbbb")]);
    expect(r).toHaveLength(1);
  });

  it("junta a cópia com o original", () => {
    expect(ambientesSemRepeticao([amb("SEPARAÇÃO"), amb("SEPARAÇÃO (Cópia)")])).toHaveLength(1);
    expect(ambientesSemRepeticao([amb("ESCRITORIO"), amb("ESCRITÓRIO")])).toHaveLength(1);
    expect(ambientesSemRepeticao([amb("Loja"), amb("LOJA ")])).toHaveLength(1);
  });

  it("fica com a descrição mais completa", () => {
    const r = ambientesSemRepeticao([
      amb("COZINHA", "Pé-direito: 3m"),
      amb("COZINHA", "Pé-direito: 3 m · Piso cerâmico · Ventilação natural e forçada"),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].descricao).toContain("Ventilação natural e forçada");
  });

  it("NÃO junta erros de digitação diferentes — isso é decisão de quem conhece a empresa", () => {
    const r = ambientesSemRepeticao([amb("ALMOXARIDADO"), amb("ALMOXARIFADDO")]);
    expect(r).toHaveLength(2);
  });

  it("não junta ambientes de verdade diferentes", () => {
    const r = ambientesSemRepeticao([amb("COSTURA"), amb("CORTE"), amb("COZINHA")]);
    expect(r).toHaveLength(3);
  });

  it("preserva a ordem do cadastro — o documento não reordena sozinho", () => {
    const r = ambientesSemRepeticao([amb("ZELADORIA"), amb("ATELIER"), amb("ZELADORIA")]);
    expect(r.map((a) => a.nome)).toEqual(["ZELADORIA", "ATELIER"]);
  });

  it("ambiente sem nome sai como veio, sem ser comparado", () => {
    const r = ambientesSemRepeticao([amb("", "um"), amb("", "outro"), amb("CORTE")]);
    expect(r).toHaveLength(3);
  });
});
