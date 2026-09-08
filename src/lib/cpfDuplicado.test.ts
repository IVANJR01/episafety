import { describe, it, expect } from "vitest";
import { apenasDigitos, acharCpfJaCadastrado, avisoDeCpfRepetido } from "./cpfDuplicado";

/* O caso que originou isto: LUANDSON ALVES BEZERRA, CPF 119.047.523-57,
   cadastrado três vezes na mesma empresa. */
const JA_CADASTRADO = [
  { id: "a", nome: "LUANDSON ALVES BEZERRA", cpf: "119.047.523-57",
    cargo: "AUX DE BORDADO", data_admissao: "2025-02-18" },
  { id: "b", nome: "MARIA DA SILVA", cpf: "98765432100", cargo: "COSTUREIRA" },
];

describe("acharCpfJaCadastrado", () => {
  it("acha mesmo com pontuação diferente — é o mesmo CPF", () => {
    expect(acharCpfJaCadastrado("11904752357", JA_CADASTRADO)?.id).toBe("a");
    expect(acharCpfJaCadastrado("119.047.523-57", JA_CADASTRADO)?.id).toBe("a");
    expect(acharCpfJaCadastrado("119 047 523 57", JA_CADASTRADO)?.id).toBe("a");
  });

  it("CPF novo não acusa nada", () => {
    expect(acharCpfJaCadastrado("11122233344", JA_CADASTRADO)).toBeNull();
  });

  it("não acusa enquanto a pessoa ainda está digitando", () => {
    /*
     * O caso que faz isto valer: existe no banco um cadastro antigo com CPF
     * incompleto ("119"). Sem exigir os 11 dígitos, no instante em que a pessoa
     * digitasse o terceiro número o sistema acusaria duplicidade com aquele
     * registro sujo e travaria o cadastro no meio da digitação.
     */
    const comCadastroSujo = [...JA_CADASTRADO, { id: "sujo", nome: "CPF INCOMPLETO", cpf: "119" }];
    for (const meio of ["1", "119", "1190475", "1190475235"]) {
      expect(acharCpfJaCadastrado(meio, comCadastroSujo), meio).toBeNull();
    }
    // Já o CPF inteiro continua sendo reconhecido.
    expect(acharCpfJaCadastrado("11904752357", comCadastroSujo)?.id).toBe("a");
  });

  it("editar o próprio registro não é duplicidade", () => {
    // Sem isto, salvar uma edição acusaria conflito com o próprio funcionário.
    expect(acharCpfJaCadastrado("119.047.523-57", JA_CADASTRADO, "a")).toBeNull();
    expect(acharCpfJaCadastrado("119.047.523-57", JA_CADASTRADO, "b")?.id).toBe("a");
  });

  it("CPF vazio ou lista vazia não quebra", () => {
    expect(acharCpfJaCadastrado("", JA_CADASTRADO)).toBeNull();
    expect(acharCpfJaCadastrado(null, JA_CADASTRADO)).toBeNull();
    expect(acharCpfJaCadastrado("11904752357", [])).toBeNull();
  });

  it("ignora cadastro sem CPF em vez de casar com ele", () => {
    const lista = [{ id: "x", nome: "SEM CPF", cpf: null }, { id: "y", nome: "VAZIO", cpf: "" }];
    expect(acharCpfJaCadastrado("11904752357", lista)).toBeNull();
  });
});

describe("apenasDigitos", () => {
  it("tira pontuação", () => {
    expect(apenasDigitos("119.047.523-57")).toBe("11904752357");
    expect(apenasDigitos(null)).toBe("");
  });
});

describe("avisoDeCpfRepetido", () => {
  it("diz quem já está cadastrado, para dar o que fazer", () => {
    expect(avisoDeCpfRepetido(JA_CADASTRADO[0]))
      .toBe("Já existe: LUANDSON ALVES BEZERRA · AUX DE BORDADO · admitido em 18/02/2025");
  });

  it("funciona com cadastro incompleto", () => {
    expect(avisoDeCpfRepetido({ id: "z", nome: "FULANO", cpf: "1" })).toBe("Já existe: FULANO");
  });
});
