import { describe, expect, it } from "vitest";
import {
  rotuloExameAso, ROTULO_EXAME_ASO, idsDeAsoNasVersoes, rotulosDosAsos,
} from "./tipoExameAso";

/**
 * O ASO tem um tipo de documento só; o que separa os exames é o rótulo.
 * Ele aparece na lista do módulo e no histórico do dossiê, e precisa ser
 * o mesmo nos dois — por isso mora aqui.
 */
describe("rótulo do tipo de exame", () => {
  it("nomeia os cinco exames da NR-07", () => {
    expect(rotuloExameAso("admissional")).toBe("Admissional");
    expect(rotuloExameAso("periodico")).toBe("Periódico");
    expect(rotuloExameAso("retorno")).toBe("Retorno ao Trabalho");
    expect(rotuloExameAso("mudanca_risco")).toBe("Mudança de Risco");
    expect(rotuloExameAso("demissional")).toBe("Demissional");
  });

  it("sem tipo, não inventa rótulo", () => {
    expect(rotuloExameAso(null)).toBeNull();
    expect(rotuloExameAso("")).toBeNull();
  });

  it("tipo novo aparece como veio, em vez de sumir", () => {
    /* Rótulo faltando é melhor que versão sem identificação nenhuma. */
    expect(rotuloExameAso("sazonal")).toBe("sazonal");
  });

  it("a tabela cobre exatamente os exames do módulo", () => {
    expect(Object.keys(ROTULO_EXAME_ASO).sort()).toEqual(
      ["admissional", "demissional", "mudanca_risco", "periodico", "retorno"],
    );
  });
});

describe("rotular as versões do histórico", () => {
  const VERSOES = [
    { origem_tabela: "asos", origem_id: "a1" },
    { origem_tabela: "asos", origem_id: "a2" },
    { origem_tabela: "asos", origem_id: "a1" },
    { origem_tabela: "controle_treinamentos", origem_id: "t1" },
    { origem_tabela: null, origem_id: null },
  ];

  it("pega só os ids de ASO, sem repetir", () => {
    expect(idsDeAsoNasVersoes(VERSOES).sort()).toEqual(["a1", "a2"]);
  });

  it("não leva o id de um treinamento para a tabela de ASO", () => {
    /*
     * Comprovante de treinamento também tem origem_id. Consultar a tabela
     * de ASO com ele rotula documento errado se os ids baterem.
     */
    expect(idsDeAsoNasVersoes(VERSOES)).not.toContain("t1");
  });

  it("monta o mapa de rótulos", () => {
    const m = rotulosDosAsos([
      { id: "a1", tipo_exame: "admissional" },
      { id: "a2", tipo_exame: "demissional" },
    ]);
    expect(m.get("a1")).toBe("Admissional");
    expect(m.get("a2")).toBe("Demissional");
  });

  it("ASO sem tipo de exame não entra no mapa", () => {
    expect(rotulosDosAsos([{ id: "a1", tipo_exame: null }]).size).toBe(0);
  });

  it("lista vazia não estoura", () => {
    expect(idsDeAsoNasVersoes([])).toEqual([]);
    expect(rotulosDosAsos([]).size).toBe(0);
  });
});
