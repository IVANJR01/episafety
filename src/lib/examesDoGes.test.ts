import { describe, expect, it } from "vitest";
import {
  examesNormativosDoGes, examesDoTipoDeExame, temRiscoIdentificado,
  temRuido, periodicidadeEmTexto,
} from "./examesDoGes";

/**
 * A lista de exames do GES, que agora é uma só.
 *
 * O documento do PCMSO montava a lista pela NR-07 a partir dos riscos; o
 * Portal de ASO lia só a Matriz de Saúde. Com a Matriz vazia — e ela tem
 * uma linha em todo o banco —, o PCMSO saía com a lista cheia e o ASO do
 * mesmo colaborador saía sem exame nenhum.
 */

const SEM = ["Ausência de Fator de Risco"];
const COM_RUIDO = ["Ruído contínuo", "Movimentos repetitivos"];
const SEM_RUIDO = ["Movimentos repetitivos"];

describe("risco identificado no PGR", () => {
  it("'Ausência de Fator de Risco' não é risco", () => {
    expect(temRiscoIdentificado(SEM)).toBe(false);
    expect(temRiscoIdentificado([])).toBe(false);
    expect(temRiscoIdentificado([""])).toBe(false);
  });

  it("qualquer agente real é risco", () => {
    expect(temRiscoIdentificado(SEM_RUIDO)).toBe(true);
  });

  it("acento e caixa não escondem a ausência", () => {
    expect(temRiscoIdentificado(["AUSENCIA DE FATOR DE RISCO"])).toBe(false);
  });
});

describe("audiometria — NR-07, Anexo II", () => {
  it("entra quando há ruído", () => {
    expect(temRuido(COM_RUIDO)).toBe(true);
    const nomes = examesNormativosDoGes(COM_RUIDO).map((e) => e.nome);
    expect(nomes.some((n) => n.includes("Audiometria"))).toBe(true);
  });

  it("não entra quando não há", () => {
    expect(temRuido(SEM_RUIDO)).toBe(false);
    const nomes = examesNormativosDoGes(SEM_RUIDO).map((e) => e.nome);
    expect(nomes.some((n) => n.includes("Audiometria")),
      "mandou fazer audiometria em quem não tem ruído").toBe(false);
  });

  it("'ruido' sem acento também conta", () => {
    expect(temRuido(["RUIDO OCUPACIONAL"])).toBe(true);
  });
});

describe("periodicidade do exame clínico — 7.5.8, II", () => {
  it("exposto a risco: anual", () => {
    expect(examesNormativosDoGes(SEM_RUIDO)[0].periodicidadeMeses).toBe(12);
  });

  it("sem risco identificado: bienal", () => {
    expect(examesNormativosDoGes(SEM)[0].periodicidadeMeses).toBe(24);
  });

  it("o exame clínico existe sempre, com ou sem risco", () => {
    /* 7.5.6: todo ASO tem exame clínico. */
    expect(examesNormativosDoGes(SEM).length).toBeGreaterThan(0);
    expect(examesNormativosDoGes([])[0].codigo).toBe("0295");
  });
});

describe("exames de cada tipo de ASO", () => {
  const lista = examesNormativosDoGes(COM_RUIDO);

  it("o clínico entra em todos os tipos", () => {
    for (const t of ["admissional", "periodico", "retorno", "demissional"]) {
      expect(examesDoTipoDeExame(lista, t).map((e) => e.codigo), t).toContain("0295");
    }
  });

  it("mudança de risco leva o clínico e a audiometria", () => {
    const m = examesDoTipoDeExame(lista, "mudanca_risco").map((e) => e.codigo);
    expect(m).toContain("0295");
    expect(m).toContain("0935");
  });

  it("tipo desconhecido não devolve lista vazia", () => {
    /* ASO sem exame nenhum é o defeito que se está corrigindo. */
    expect(examesDoTipoDeExame(lista, "sazonal").length).toBeGreaterThan(0);
  });
});

describe("periodicidade em texto, como o PCMSO escreve", () => {
  it("traduz os prazos", () => {
    expect(periodicidadeEmTexto(12)).toBe("Anual");
    expect(periodicidadeEmTexto(24)).toBe("Bienal");
    expect(periodicidadeEmTexto(6)).toBe("Semestral");
    expect(periodicidadeEmTexto(null)).toBe("—");
  });
});
