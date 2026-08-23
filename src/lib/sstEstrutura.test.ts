import { describe, it, expect } from "vitest";
import {
  criterioAgrupamentoSugerido, criterioDoGrupo, ehCriterioEscritoPeloSistema, setoresDoGrupo, nomeDoGrupo,
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

/**
 * "O GES é Grupo de Exposição Similar; quem são o grupo são as funções."
 *
 * Por isso o setor deixou de ser apontado à parte, numa aba própria: cada
 * função já pertence a um setor, e é de lá que ele sai. Havia dois lugares
 * guardando a mesma coisa — e eles podiam discordar.
 *
 * A armadilha: 10 dos 13 grupos desta base não têm nenhuma função ainda
 * (nasceram junto com o setor). Derivar sem reserva tiraria o setor de todos
 * eles de uma vez, e o PGR sairia com "não declarado" em cada um.
 */
describe("setoresDoGrupo", () => {
  it("tira o setor de quem está no grupo", () => {
    expect(setoresDoGrupo([
      { setorNome: "PCP" }, { setorNome: "PCP" }, { setorNome: "PCP" },
    ])).toEqual(["PCP"]);
  });

  it("grupo que atravessa setores devolve todos — é o motivo do GES existir", () => {
    expect(setoresDoGrupo([{ setorNome: "PCP" }, { setorNome: "COMERCIAL" }]))
      .toEqual(["PCP", "COMERCIAL"]);
  });

  it("grupo AINDA SEM função cai no vínculo antigo — sem isso, 10 grupos perdiam o setor", () => {
    expect(setoresDoGrupo([], "LOJA")).toEqual(["LOJA"]);
    expect(setoresDoGrupo(undefined, "COZINHA")).toEqual(["COZINHA"]);
  });

  it("tendo função, a função manda — o vínculo antigo não sobrepõe", () => {
    // Se a função foi movida de setor, quem vale é o setor de hoje.
    expect(setoresDoGrupo([{ setorNome: "COSTURA" }], "LOJA")).toEqual(["COSTURA"]);
  });

  it("sem função e sem reserva, devolve vazio em vez de inventar", () => {
    expect(setoresDoGrupo([], null)).toEqual([]);
    expect(setoresDoGrupo()).toEqual([]);
  });

  it("função sem setor não vira setor em branco", () => {
    expect(setoresDoGrupo([{ setorNome: null }, { setorNome: "  " }], "LOJA")).toEqual(["LOJA"]);
  });
});

describe("criterioAgrupamentoSugerido com vários setores", () => {
  it("diz 'dos setores' no plural, sem esconder nenhum", () => {
    expect(criterioAgrupamentoSugerido(["PCP", "COMERCIAL"], [{ nome: "Ajudante" }]))
      .toBe("Trabalhadores dos setores PCP e COMERCIAL nas funções Ajudante, " +
            "sujeitos às mesmas condições de exposição.");
  });

  it("um setor só continua no singular", () => {
    expect(criterioAgrupamentoSugerido(["PCP"], [{ nome: "Ajudante" }]))
      .toBe("Trabalhadores do setor PCP nas funções Ajudante, sujeitos às mesmas condições de exposição.");
  });

  it("o texto no plural continua sendo reconhecido como escrito pelo sistema", () => {
    // Senão ele nunca seria remontado e voltaria a envelhecer.
    const texto = criterioAgrupamentoSugerido(["PCP", "COMERCIAL"], [{ nome: "Ajudante" }]);
    expect(ehCriterioEscritoPeloSistema(texto)).toBe(true);
  });
});

/**
 * "Cada grupo já tem a numeração 01, 02, 03 — essa numeração de roxo. Não dá
 * para adicionar o nome automático?"
 *
 * Os grupos se chamavam pelo próprio código, e o cartão já mostra esse código
 * num crachá ao lado: o nome repetia o crachá e não dizia de quem era o grupo.
 */
describe("nomeDoGrupo", () => {
  it("nome igual ao código vira o nome do setor", () => {
    expect(nomeDoGrupo({ armazenado: "01", codigo: "01", setores: ["COSTURA"] })).toBe("COSTURA");
  });

  it("nome vazio também", () => {
    expect(nomeDoGrupo({ armazenado: "", codigo: "07", setores: ["COSTURA"] })).toBe("COSTURA");
    expect(nomeDoGrupo({ codigo: "07", setores: ["COSTURA"] })).toBe("COSTURA");
  });

  it("dois grupos do mesmo setor têm o mesmo nome e crachás diferentes", () => {
    // É como se fala deles: "COSTURA 01" e "COSTURA 02".
    expect(nomeDoGrupo({ armazenado: "01", codigo: "01", setores: ["COSTURA"] })).toBe("COSTURA");
    expect(nomeDoGrupo({ armazenado: "02", codigo: "02", setores: ["COSTURA"] })).toBe("COSTURA");
  });

  it("grupo que atravessa setores junta os dois nomes", () => {
    expect(nomeDoGrupo({ armazenado: "04", codigo: "04", setores: ["LOJA", "ESCRITÓRIO"] }))
      .toBe("LOJA e ESCRITÓRIO");
  });

  it("PRESERVA nome escrito por gente — é o caso do grupo com nome próprio", () => {
    // Este é o teste que impede a automação de apagar trabalho de alguém.
    expect(nomeDoGrupo({
      armazenado: "Equipe de manutenção móvel", codigo: "05", setores: ["PCP"],
    })).toBe("Equipe de manutenção móvel");
  });

  it("sem setor, mantém o código em vez de ficar sem nome", () => {
    expect(nomeDoGrupo({ armazenado: "09", codigo: "09", setores: [] })).toBe("09");
    expect(nomeDoGrupo({ armazenado: "", codigo: "09" })).toBe("09");
  });

  it('"1" e "01" são o mesmo código escrito de dois jeitos', () => {
    // O código é gravado com zero à esquerda; nomes antigos nem sempre.
    expect(nomeDoGrupo({ armazenado: "1", codigo: "01", setores: ["PCP"] })).toBe("PCP");
  });
});
