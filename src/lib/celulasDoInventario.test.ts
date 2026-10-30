import { describe, expect, it } from "vitest";
import {
  textoDaCelula, notaDeRisco, codigoDoGes, grupoDoRisco, classeDaPlanilha,
  semColunasGeradas, tipoDeExposicao,
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

describe("a classificação escrita na planilha", () => {
  it("vira o apelido que o banco guarda", () => {
    /*
     * O banco guarda "toleravel"/"moderado" em minúsculas e sem acento.
     * Gravar "TOLERÁVEL" cru deixaria dois valores para a mesma classe,
     * e as contagens por classe parariam de fechar.
     */
    expect(classeDaPlanilha("TOLERÁVEL")).toBe("toleravel");
    expect(classeDaPlanilha("Moderado")).toBe("moderado");
    expect(classeDaPlanilha("TRIVIAL")).toBe("trivial");
    expect(classeDaPlanilha("SUBSTANCIAL")).toBe("substancial");
    expect(classeDaPlanilha("INTOLERÁVEL")).toBe("intoleravel");
  });

  it("palavra de outra consultoria também é reconhecida", () => {
    expect(classeDaPlanilha("RISCO CRÍTICO")).toBe("intoleravel");
  });

  it("o que não é classe devolve null, para quem chama calcular", () => {
    /* Gravar algo que ninguém reconhece é pior que calcular pela matriz. */
    expect(classeDaPlanilha("")).toBeNull();
    expect(classeDaPlanilha("N.A")).toBeNull();
    expect(classeDaPlanilha("ver com o engenheiro")).toBeNull();
  });
});

describe("o que não pode ir no insert", () => {
  it("tira nivel_risco, que o banco calcula sozinho", () => {
    /*
     * Era o que derrubava a importação no fim: "cannot insert a
     * non-DEFAULT value into column nivel_risco", depois de ler o
     * arquivo inteiro certo.
     */
    const pronto = semColunasGeradas({
      perigo_descricao: "Ruído", probabilidade: 3, severidade: 4, nivel_risco: 12,
    });
    expect("nivel_risco" in pronto, "o nível foi junto e o banco recusa tudo").toBe(false);
  });

  it("não leva mais nada junto", () => {
    const pronto = semColunasGeradas({
      perigo_descricao: "Ruído", probabilidade: 3, severidade: 4, nivel_risco: 12,
    });
    expect(pronto).toEqual({ perigo_descricao: "Ruído", probabilidade: 3, severidade: 4 });
  });

  it("item que já vem sem o campo passa inteiro", () => {
    expect(semColunasGeradas({ a: 1 })).toEqual({ a: 1 });
  });
});

describe("os valores que o banco aceita", () => {
  it("o grupo sai sempre da lista do enum", () => {
    /*
     * `grupo` é lista fechada no Postgres. Um valor fora dela derruba a
     * gravação inteira do inventário.
     */
    const aceitos = [
      "fisico", "quimico", "biologico", "ergonomico",
      "acidente", "psicossocial", "outro",
    ];
    const textos = [
      "Físico", "Químico", "Biológico", "Ergonômico", "Acidentes",
      "Psicossocial", "Mecânico", "", "qualquer coisa", "N.A",
    ];
    for (const t of textos) {
      expect(aceitos, `"${t}" saiu fora da lista do banco`).toContain(grupoDoRisco(t));
    }
  });
});

describe("o tipo de exposição", () => {
  it("traduz o que a planilha escreve para o que o banco aceita", () => {
    /*
     * A coluna é uma lista fechada no Postgres. Mandar "Intermitente"
     * cru derrubava a gravação INTEIRA do inventário com "invalid input
     * value for enum" — o PGR era criado e nenhum risco entrava.
     */
    expect(tipoDeExposicao("Intermitente")).toBe("intermitente");
    expect(tipoDeExposicao("Permanente")).toBe("continua");
    expect(tipoDeExposicao("Contínua")).toBe("continua");
    expect(tipoDeExposicao("Habitual e Permanente")).toBe("continua");
    expect(tipoDeExposicao("Eventual")).toBe("eventual");
    expect(tipoDeExposicao("Ocasional")).toBe("eventual");
  });

  it("'N.A' vira 'não se aplica'", () => {
    expect(tipoDeExposicao("N.A")).toBe("nao_aplicavel");
    expect(tipoDeExposicao("Não se aplica")).toBe("nao_aplicavel");
  });

  it("palavra que não é nenhuma das quatro devolve null", () => {
    /* Escolher uma por chute descreveria errado a exposição de alguém. */
    expect(tipoDeExposicao("8 horas por dia")).toBeNull();
    expect(tipoDeExposicao("")).toBeNull();
  });

  it("devolve só valores da lista do banco", () => {
    const aceitos = ["continua", "intermitente", "eventual", "nao_aplicavel"];
    for (const texto of ["Intermitente", "Permanente", "Eventual", "N.A", "qualquer"]) {
      const v = tipoDeExposicao(texto);
      if (v !== null) expect(aceitos, `"${texto}" saiu fora da lista`).toContain(v);
    }
  });
});
