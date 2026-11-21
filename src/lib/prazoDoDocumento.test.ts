import { describe, it, expect } from "vitest";
import { PRAZOS, vencimento, prazoDaData } from "./prazoDoDocumento";

const p = (v: string) => PRAZOS.find((x) => x.valor === v)!;

describe("vencimento", () => {
  it("soma dias", () => {
    expect(vencimento("2026-11-21", p("90d"))).toBe("2027-02-19");
    expect(vencimento("2026-11-21", p("30d"))).toBe("2026-12-21");
  });
  it("soma meses e anos", () => {
    expect(vencimento("2026-11-21", p("6m"))).toBe("2027-05-21");
    expect(vencimento("2026-11-21", p("12m"))).toBe("2027-11-21");
    expect(vencimento("2026-11-21", p("24m"))).toBe("2028-11-21");
  });
  it("dia que não existe no mês final cai no último dia do mês", () => {
    expect(vencimento("2026-08-31", p("6m"))).toBe("2027-02-28");
    expect(vencimento("2027-02-29".replace("29", "28"), p("12m"))).toBe("2028-02-28");
    expect(vencimento("2028-02-29", p("12m"))).toBe("2029-02-28");
  });
  it("sem data de emissão não calcula", () => {
    expect(vencimento("", p("12m"))).toBeNull();
  });
});

describe("prazoDaData", () => {
  it("reconhece o atalho que gerou a data", () => {
    expect(prazoDaData("2026-11-21", "2027-11-21")).toBe("12m");
  });
  it("data digitada à mão não corresponde a atalho", () => {
    expect(prazoDaData("2026-11-21", "2027-01-05")).toBe("");
  });
});
