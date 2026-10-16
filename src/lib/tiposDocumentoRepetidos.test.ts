import { describe, expect, it } from "vitest";
import { tiposRepetidos, chaveDoTipo } from "./tiposDocumentoRepetidos";

/* Os dois "ASO - Atestado de Saúde Ocupacional" que apareciam na busca. */
const CATALOGO = { id: "c1", nome: "ASO - Atestado de Saúde Ocupacional", empresa_id: null };
const DA_EMPRESA = { id: "e1", nome: "ASO - Atestado de Saúde Ocupacional", empresa_id: "emp" };

describe("tipo repetido", () => {
  it("marca o tipo da empresa que repete o do catálogo", () => {
    const r = tiposRepetidos([CATALOGO, DA_EMPRESA]);
    expect(r.has("e1")).toBe(true);
  });

  it("não marca o tipo do catálogo", () => {
    /* Ele é o original; marcar os dois não diz qual sobra. */
    expect(tiposRepetidos([CATALOGO, DA_EMPRESA]).has("c1")).toBe(false);
  });

  it("nome parecido mas diferente não é repetição", () => {
    const outro = { id: "e2", nome: "ASO - DEMISSIONAL", empresa_id: "emp" };
    expect(tiposRepetidos([CATALOGO, outro]).has("e2")).toBe(false);
  });

  it("acento, caixa e pontuação não escondem a repetição", () => {
    const quase = { id: "e3", nome: "aso  atestado de saude ocupacional", empresa_id: "emp" };
    expect(tiposRepetidos([CATALOGO, quase]).has("e3")).toBe(true);
  });

  it("sem tipo do catálogo, nada é marcado", () => {
    expect(tiposRepetidos([DA_EMPRESA]).size).toBe(0);
  });

  it("chaveDoTipo normaliza", () => {
    expect(chaveDoTipo("ASO - Atestado de Saúde Ocupacional"))
      .toBe("aso atestado de saude ocupacional");
  });
});
