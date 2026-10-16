import { describe, expect, it } from "vitest";
import { temRiscoIdentificado, temRuido, periodicidadeEmTexto } from "./examesDoGes";
import { examesSugeridos, examesSugeridosCompletos } from "./matrizSaudeDoGes";

/**
 * O que os riscos decidem, e a lista de exames que agora é uma só.
 *
 * O documento do PCMSO montava a lista pela NR-07 a partir dos riscos; o
 * Portal de ASO lia só a Matriz de Saúde. Com a Matriz vazia — e ela tem
 * uma linha em todo o banco —, o PCMSO saía com a lista cheia e o ASO do
 * mesmo colaborador saía sem exame nenhum.
 */

const SEM = ["Ausência de Fator de Risco"];
/** Textos viram riscos do GES, como vêm do inventário do PGR. */
const riscos = (textos: string[]) =>
  textos.map((t) => ({ grupo: "fisico", descricao: t }));
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
    const nomes = examesSugeridosCompletos(riscos(COM_RUIDO)).map((e) => e.nome);
    expect(nomes.some((n) => n.includes("Audiometria"))).toBe(true);
  });

  it("não entra quando não há", () => {
    expect(temRuido(SEM_RUIDO)).toBe(false);
    const nomes = examesSugeridosCompletos(riscos(SEM_RUIDO)).map((e) => e.nome);
    expect(nomes.some((n) => n.includes("Audiometria")),
      "mandou fazer audiometria em quem não tem ruído").toBe(false);
  });

  it("'ruido' sem acento também conta", () => {
    expect(temRuido(["RUIDO OCUPACIONAL"])).toBe(true);
  });
});

describe("o exame clínico existe sempre", () => {
  it("mesmo sem risco nenhum — NR-07, 7.5.6", () => {
    expect(examesSugeridosCompletos([])[0].codigo).toBe("0295");
    expect(examesSugeridosCompletos(riscos(SEM))[0].codigo).toBe("0295");
  });
});

describe("exames de cada tipo de ASO", () => {
  it("o clínico entra em todos os tipos", () => {
    for (const t of ["admissional", "periodico", "retorno", "demissional"]) {
      expect(examesSugeridos(riscos(COM_RUIDO), t).map((e) => e.codigo), t)
        .toContain("0295");
    }
  });

  it("tipo desconhecido não devolve lista vazia", () => {
    /* ASO sem exame nenhum é o defeito que se está corrigindo. */
    expect(examesSugeridos(riscos(COM_RUIDO), "sazonal").length).toBeGreaterThan(0);
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
