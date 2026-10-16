import { describe, expect, it } from "vitest";
import { mesParaData, dataParaMes, mesCurto, mesExtenso } from "./mesPrevisto";

/**
 * O cronograma do PCMSO planeja o ano, não o dia.
 *
 * O campo pedia dia, mês e ano. Dia nenhum é verdade nessa altura: quem
 * preenche escolhe um qualquer, e o documento sai afirmando uma data que
 * ninguém combinou.
 */

describe("o que o formulário manda para o banco", () => {
  it("o mês vira o primeiro dia dele", () => {
    expect(mesParaData("2026-05")).toBe("2026-05-01");
  });

  it("mês vazio não vira data nenhuma", () => {
    expect(mesParaData("")).toBeNull();
    expect(mesParaData(null)).toBeNull();
  });

  it("texto que não é mês não vira data", () => {
    /* Gravar "2026-13-01" faria o banco recusar a linha inteira. */
    expect(mesParaData("maio")).toBeNull();
    expect(mesParaData("2026")).toBeNull();
    expect(mesParaData("2026-05-20")).toBeNull();
  });
});

describe("o que o banco devolve para o formulário", () => {
  it("a data vira mês", () => {
    expect(dataParaMes("2026-05-01")).toBe("2026-05");
  });

  it("data antiga, gravada com dia no meio do mês, ainda abre no campo", () => {
    /* As ações cadastradas antes desta mudança têm dia qualquer. */
    expect(dataParaMes("2026-05-23")).toBe("2026-05");
  });

  it("sem data, campo vazio", () => {
    expect(dataParaMes(null)).toBe("");
    expect(dataParaMes("durante a vigência")).toBe("");
  });
});

describe("o que aparece na tela e no documento", () => {
  it("na tela, mês e ano", () => {
    expect(mesCurto("2026-05-01")).toBe("05/2026");
    expect(mesCurto("2026-12-31")).toBe("12/2026");
  });

  it("no documento, o mês por extenso", () => {
    expect(mesExtenso("2026-05-01")).toBe("Maio/2026");
    expect(mesExtenso("2026-03-10")).toBe("Março/2026");
  });

  it("sem data, nada — para quem lê não achar que há prazo", () => {
    expect(mesCurto(null)).toBe("");
    expect(mesExtenso(null)).toBe("");
    expect(mesExtenso("nao e data")).toBe("");
  });

  it("não escorrega de mês por causa de fuso", () => {
    /*
     * new Date("2026-05-01") é meia-noite UTC, que no Brasil é 30/04.
     * Formatando pelo Date, o mês previsto andava para trás.
     */
    expect(mesCurto("2026-05-01")).toBe("05/2026");
    expect(mesExtenso("2026-01-01")).toBe("Janeiro/2026");
  });
});
