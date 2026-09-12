import { describe, expect, it } from "vitest";
import { calcularValidade, diasEntre, descricaoDaValidade } from "./arquivoDigital";

describe("calcularValidade — prazo em dias", () => {
  it("conta dias corridos a partir da emissão", () => {
    expect(calcularValidade("2026-03-15", null, 90)).toBe("2026-06-13");
    expect(calcularValidade("2026-03-15", null, 120)).toBe("2026-07-13");
  });

  it("dias tem precedência sobre meses", () => {
    // O banco impede os dois preenchidos, mas se chegarem juntos a regra
    // precisa ser uma só — senão o vencimento dependeria da ordem de leitura.
    expect(calcularValidade("2026-01-01", 12, 90)).toBe(calcularValidade("2026-01-01", null, 90));
  });

  it("90 dias não é a mesma coisa que 3 meses", () => {
    // É por isso que a coluna nova existe, e por isso os valores antigos não
    // foram convertidos: a diferença aparece como documento vencido
    // circulando como vigente.
    expect(calcularValidade("2026-12-01", null, 90)).toBe("2027-03-01");
    expect(calcularValidade("2026-12-01", 3, null)).toBe("2027-03-01");
    // Em ano bissexto elas se separam:
    expect(calcularValidade("2027-12-01", null, 90)).toBe("2028-02-29");
    expect(calcularValidade("2027-12-01", 3, null)).toBe("2028-03-01");
  });

  it("atravessa a virada do ano", () => {
    expect(calcularValidade("2026-11-20", null, 60)).toBe("2027-01-19");
  });

  it("sem prazo nenhum é permanente", () => {
    expect(calcularValidade("2026-03-15", null, null)).toBeNull();
  });

  it("não estoura com data inválida", () => {
    expect(calcularValidade("nao e data", null, 90)).toBeNull();
  });
});

describe("calcularValidade — prazo em meses continua igual", () => {
  it("mantém o dia do mês", () => {
    expect(calcularValidade("2026-03-15", 12)).toBe("2027-03-15");
  });

  it("não transborda para o mês seguinte", () => {
    // 31/01 + 1 mês não pode virar 03/03: o documento apareceria vigente
    // por dias a mais do que vale.
    expect(calcularValidade("2026-01-31", 1)).toBe("2026-02-28");
  });
});

describe("diasEntre", () => {
  it("conta dias inteiros", () => {
    expect(diasEntre("2026-03-15", "2026-06-13")).toBe(90);
  });

  it("atravessa horário de verão sem perder o dia", () => {
    expect(diasEntre("2026-10-01", "2026-11-30")).toBe(60);
  });
});

describe("descricaoDaValidade", () => {
  it("descreve a regra do tipo em meses", () => {
    expect(descricaoDaValidade({ validade_meses: 12 })).toBe("Validade 12 meses");
  });

  it("descreve a regra do tipo em dias", () => {
    expect(descricaoDaValidade({ validade_dias: 90 })).toBe("Validade 90 dias");
  });

  it("chama de permanente o tipo sem prazo", () => {
    expect(descricaoDaValidade({})).toBe("Permanente");
  });

  it("não acrescenta nada quando o documento segue a regra", () => {
    expect(descricaoDaValidade(
      { validade_meses: 12 },
      { data_emissao: "2026-03-15", data_validade: "2027-03-15" },
    )).toBe("Validade 12 meses");
  });

  it("avisa quando aquele documento tem prazo próprio", () => {
    // É o caso que motivou tudo: ASO de 90 dias aparecendo sob um tipo de
    // 12 meses, com a linha de cima dizendo outra coisa que a data.
    expect(descricaoDaValidade(
      { validade_meses: 12 },
      { data_emissao: "2026-03-15", data_validade: "2026-06-13" },
    )).toBe("Validade 12 meses · este: 90 dias");
  });

  it("usa singular para um dia", () => {
    expect(descricaoDaValidade(
      { validade_meses: 12 },
      { data_emissao: "2026-03-15", data_validade: "2026-03-16" },
    )).toBe("Validade 12 meses · este: 1 dia");
  });

  it("ignora documento sem emissão ou sem vencimento", () => {
    expect(descricaoDaValidade({ validade_meses: 12 }, { data_validade: "2026-06-13" })).toBe("Validade 12 meses");
    expect(descricaoDaValidade({ validade_meses: 12 }, { data_emissao: "2026-03-15" })).toBe("Validade 12 meses");
    expect(descricaoDaValidade({ validade_meses: 12 }, null)).toBe("Validade 12 meses");
  });

  it("não anuncia prazo negativo de documento com datas invertidas", () => {
    expect(descricaoDaValidade(
      { validade_meses: 12 },
      { data_emissao: "2026-06-13", data_validade: "2026-03-15" },
    )).toBe("Validade 12 meses");
  });
});
