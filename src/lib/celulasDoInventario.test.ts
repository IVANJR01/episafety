import { describe, expect, it } from "vitest";
import {
  textoDaCelula, notaDeRisco, codigoDoGes, grupoDoRisco,
} from "./celulasDoInventario";

/**
 * Casos tirados da planilha real do cliente — "Inventário de Risco e
 * Plano de Ação", 20 colunas, 66 riscos, 22 setores.
 */

describe("'N.A' não é conteúdo", () => {
  it("vira vazio", () => {
    /* Gravado como texto, sai no documento: "Limite de Exposição: N.A". */
    expect(textoDaCelula("N.A")).toBeNull();
    expect(textoDaCelula("n.a")).toBeNull();
    expect(textoDaCelula("-")).toBeNull();
    expect(textoDaCelula("")).toBeNull();
  });

  it("texto de verdade passa inteiro", () => {
    expect(textoDaCelula("  Intermitente ")).toBe("Intermitente");
    expect(textoDaCelula("Avaliação Qualitativa")).toBe("Avaliação Qualitativa");
  });
});

describe("a nota de risco", () => {
  it("aceita o '1.0' que o Excel grava", () => {
    expect(notaDeRisco("1.0")).toBe(1);
    expect(notaDeRisco("4,0")).toBe(4);
    expect(notaDeRisco(3)).toBe(3);
  });

  it("texto não vira nota", () => {
    /*
     * A nota decide a classificação, e a classificação decide a
     * prioridade das ações.
     */
    expect(notaDeRisco("Intermitente")).toBeNull();
    expect(notaDeRisco("Avaliação Qualitativa")).toBeNull();
  });

  it("fora de 1 a 5 não é nota", () => {
    expect(notaDeRisco("0")).toBeNull();
    expect(notaDeRisco("9")).toBeNull();
    expect(notaDeRisco("")).toBeNull();
  });
});

describe("o código do GES", () => {
  it("'1.0' do Excel vira '01'", () => {
    expect(codigoDoGes("1.0")).toBe("01");
    expect(codigoDoGes("10.0")).toBe("10");
  });

  it("'3.1' é subgrupo e não vira '03'", () => {
    /* Esta planilha tem 3.1, 10.1, 12.4, 14.1 — são grupos próprios. */
    expect(codigoDoGes("3.1")).toBe("3.1");
    expect(codigoDoGes("12.4")).toBe("12.4");
  });

  it("vazio continua vazio", () => {
    expect(codigoDoGes("")).toBe("");
    expect(codigoDoGes(null)).toBe("");
  });
});

describe("o grupo do risco", () => {
  it("reconhece os cinco da NR-01", () => {
    expect(grupoDoRisco("Ergonômico")).toBe("ergonomico");
    expect(grupoDoRisco("Acidentes")).toBe("acidente");
    expect(grupoDoRisco("Químico")).toBe("quimico");
    expect(grupoDoRisco("Biológico")).toBe("biologico");
    expect(grupoDoRisco("Físico")).toBe("fisico");
  });

  it("psicossocial tem grupo próprio", () => {
    /* Caía em "outro" e sumia do agrupamento por tipo de risco. */
    expect(grupoDoRisco("Psicossocial")).toBe("psicossocial");
  });

  it("o que não se reconhece vira 'outro', sem chutar", () => {
    expect(grupoDoRisco("Agente desconhecido")).toBe("outro");
    expect(grupoDoRisco("")).toBe("outro");
  });
});
