import { describe, expect, it } from "vitest";
import { formatDataDeIso } from "./gerarFichaEPI";

describe("formatDataDeIso — data da coluna Entrega", () => {
  it("devolve só a data, sem hora", () => {
    const saida = formatDataDeIso("2026-09-08T14:07:27.000Z");
    expect(saida).toBe("08/09/2026");
    expect(saida).not.toMatch(/\d{2}:\d{2}/);
  });

  it("não deixa a hora vazar grudada no ano", () => {
    // A armadilha: `formatDate` corta a string em "-", e num ISO completo o
    // terceiro pedaço é "08T14:07:27.000Z". Usá-la aqui imprimiria
    // "08T14:07:27.000Z/09/2026" dentro da célula.
    expect(formatDataDeIso("2026-09-08T14:07:27.000Z")).not.toContain("T");
    expect(formatDataDeIso("2026-09-08T14:07:27.000Z")).not.toContain("Z");
  });

  it("aceita data pura, sem parte de hora", () => {
    expect(formatDataDeIso("2026-02-18")).toBe("18/02/2026");
  });

  it("não estoura com entrada vazia ou inválida", () => {
    expect(formatDataDeIso("")).toBe("—");
    expect(formatDataDeIso("nao e data")).toBe("nao e data");
  });

  it("vira o dia na meia-noite de quem lê, não na de Greenwich", () => {
    // Ancorado na meia-noite LOCAL: fixar instantes em UTC faria o teste
    // passar aqui e falhar numa máquina em horário de Brasília, onde
    // 2026-09-09T00:00Z ainda é dia 8.
    const meiaNoite = new Date(2026, 8, 9, 0, 0, 0);
    const umSegundoAntes = new Date(meiaNoite.getTime() - 1000);
    expect(formatDataDeIso(umSegundoAntes.toISOString())).toBe("08/09/2026");
    expect(formatDataDeIso(meiaNoite.toISOString())).toBe("09/09/2026");
  });
});
