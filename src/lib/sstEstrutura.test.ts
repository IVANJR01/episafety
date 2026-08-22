import { describe, it, expect } from "vitest";
import {
  criterioAgrupamentoSugerido, criterioDoGrupo, ehCriterioEscritoPeloSistema,
} from "./sstEstrutura";

/**
 * O campo "Descrição curta da exposição" saiu do cadastro do grupo de
 * exposição. Ele pedia à mão uma frase que o sistema já sabia montar — setor e
 * funções estavam logo abaixo, no mesmo formulário — e o texto digitado virava
 * uma cópia que envelhecia: mover uma função de um grupo para outro não mexia
 * na frase guardada, e era ela que ia para o PGR.
 *
 * O risco de tirar o campo é o oposto: o PDF do PGR imprime
 * "não declarado — pendente de justificativa técnica" quando o critério falta.
 * Por isso o texto passou a ser montado na hora de usar.
 */

describe("criterioDoGrupo", () => {
  const funcoes = [{ nome: "Analista de PCP" }, { nome: "Cronometrista" }];

  it("monta o texto do cadastro quando não há nada guardado", () => {
    expect(criterioDoGrupo({ setorNome: "PCP", funcoes })).toBe(
      "Trabalhadores do setor PCP nas funções Analista de PCP e Cronometrista, " +
      "sujeitos às mesmas condições de exposição.",
    );
  });

  it("REGENERA o texto que o próprio sistema tinha escrito — é o que impede o PGR de sair velho", () => {
    // Cenário real: o grupo tinha só o Analista; o Cronometrista foi movido
    // para cá depois. O texto guardado continuava falando do grupo antigo.
    const guardado = "Trabalhadores do setor PCP nas funções Analista de PCP, sujeitos às mesmas condições de exposição.";
    expect(criterioDoGrupo({ armazenado: guardado, setorNome: "PCP", funcoes }))
      .toContain("Cronometrista");
  });

  it("regenera também o texto que a tela de Setores grava ao criar o grupo", () => {
    const guardado = "Agrupamento por setor: todos os trabalhadores de PCP atuam no mesmo ambiente e estão sujeitos às mesmas condições de exposição.";
    expect(criterioDoGrupo({ armazenado: guardado, setorNome: "PCP", funcoes }))
      .toContain("nas funções Analista de PCP e Cronometrista");
  });

  it("PRESERVA o que uma pessoa escreveu — tirar o campo não pode apagar texto humano", () => {
    // Este é o teste que impede a limpeza de virar perda de trabalho alheio.
    const humano = "Exposição a ruído contínuo de 85 dB(A) por 6h/dia junto às máquinas de corte.";
    expect(criterioDoGrupo({ armazenado: humano, setorNome: "PCP", funcoes })).toBe(humano);
  });

  it("grupo sem setor mantém o texto humano em vez de esvaziar", () => {
    const humano = "Equipe de manutenção móvel, exposta às mesmas condições em todas as unidades.";
    expect(criterioDoGrupo({ armazenado: humano, funcoes })).toBe(humano);
  });

  it("sem setor e sem texto guardado, devolve vazio em vez de inventar", () => {
    expect(criterioDoGrupo({ funcoes })).toBe("");
    expect(criterioDoGrupo({})).toBe("");
  });

  it("setor sem função nenhuma ainda produz frase utilizável", () => {
    expect(criterioDoGrupo({ setorNome: "MARKETING", funcoes: [] }))
      .toBe("Trabalhadores do setor MARKETING, sujeitos às mesmas condições de exposição.");
  });

  it('"N.A" guardado conta como vazio, não como texto de gente', () => {
    expect(criterioDoGrupo({ armazenado: "N.A", setorNome: "PCP", funcoes }))
      .toContain("Trabalhadores do setor PCP");
  });
});

describe("ehCriterioEscritoPeloSistema", () => {
  it("reconhece os dois formatos que o sistema gera", () => {
    expect(ehCriterioEscritoPeloSistema(criterioAgrupamentoSugerido("PCP", [{ nome: "X" }]))).toBe(true);
    expect(ehCriterioEscritoPeloSistema("Agrupamento por setor: todos os trabalhadores de X...")).toBe(true);
  });

  it("texto de gente não é confundido com texto de máquina", () => {
    expect(ehCriterioEscritoPeloSistema("Exposição a ruído contínuo junto às máquinas.")).toBe(false);
    expect(ehCriterioEscritoPeloSistema("")).toBe(false);
    expect(ehCriterioEscritoPeloSistema(null)).toBe(false);
  });
});

describe("criterioAgrupamentoSugerido: função repetida", () => {
  it("não lista a mesma função duas vezes — no PGR isso é erro visível", () => {
    // A base real tem funções duplicadas no cadastro; o grupo 01 tem
    // "Ajudante de Confecção" duas vezes ligado ao mesmo grupo.
    const texto = criterioAgrupamentoSugerido("PCP", [
      { nome: "Ajudante de Confecção" },
      { nome: "Ajudante de Confecção" },
      { nome: "Analista de PCP" },
    ]);
    expect(texto).toBe(
      "Trabalhadores do setor PCP nas funções Ajudante de Confecção e Analista de PCP, " +
      "sujeitos às mesmas condições de exposição.",
    );
  });
});
