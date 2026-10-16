import { describe, expect, it } from "vitest";

describe("ordenação estrita por GES no PCMSO (NR-07 articulado com PGR)", () => {
  const extrairNumGes = (cod?: string | null): number => {
    if (!cod) return 9999;
    const num = String(cod).replace(/\D/g, "");
    return num ? parseInt(num, 10) : 9999;
  };

  it("extrai corretamente números de GES com diferentes formatações", () => {
    expect(extrairNumGes("01")).toBe(1);
    expect(extrairNumGes("02")).toBe(2);
    expect(extrairNumGes("GES 03")).toBe(3);
    expect(extrairNumGes("13")).toBe(13);
    expect(extrairNumGes(null)).toBe(9999);
  });

  it("ordena os 13 GES numericamente do 01 ao 13", () => {
    const ghes = [
      { codigo: "12", setor: "COZINHA" },
      { codigo: "08", setor: "CORTE" },
      { codigo: "01", setor: "PCP" },
      { codigo: "02", setor: "ESCRITÓRIO" },
      { codigo: "13", setor: "LIMPEZA" },
      { codigo: "03", setor: "CORMECIAL" },
      { codigo: "07", setor: "COSTURA" },
      { codigo: "04", setor: "LOJA" },
      { codigo: "05", setor: "MARKETING" },
      { codigo: "06", setor: "ATELIER" },
      { codigo: "09", setor: "SEPARAÇÃO" },
      { codigo: "10", setor: "EMBALAGEM / EXPEDIÇÃO" },
      { codigo: "11", setor: "ALMOXARIDADO" },
    ];

    const ordenados = [...ghes].sort((a, b) => {
      const na = extrairNumGes(a.codigo);
      const nb = extrairNumGes(b.codigo);
      if (na !== nb) return na - nb;
      return String(a.codigo).localeCompare(String(b.codigo));
    });

    expect(ordenados.map((g) => g.setor)).toEqual([
      "PCP",
      "ESCRITÓRIO",
      "CORMECIAL",
      "LOJA",
      "MARKETING",
      "ATELIER",
      "COSTURA",
      "CORTE",
      "SEPARAÇÃO",
      "EMBALAGEM / EXPEDIÇÃO",
      "ALMOXARIDADO",
      "COZINHA",
      "LIMPEZA",
    ]);

    expect(ordenados[0].setor).toBe("PCP");
    expect(ordenados[1].setor).toBe("ESCRITÓRIO");
    expect(ordenados[2].setor).toBe("CORMECIAL");
    expect(ordenados[12].setor).toBe("LIMPEZA");
  });
});
