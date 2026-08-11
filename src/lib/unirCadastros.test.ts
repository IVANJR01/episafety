import { describe, it, expect } from "vitest";
import { unirPorId, unirPorIdENome } from "./unirCadastros";

/**
 * O caso real: a etapa 3 do PGR (hoje "Funções") mostrava "Ajudante de Confecção" três
 * vezes — PCP, COMERCIAL e uma terceira com o setor em branco, que é a mesma
 * função vinda da tabela legada.
 */
const novas = [
  { id: "n1", nome: "Ajudante de Confecção", setor: "PCP" },
  { id: "n2", nome: "Ajudante de Confecção", setor: "COMERCIAL" },
  { id: "n3", nome: "Assistente Administrativo", setor: "ESCRITÓRIO" },
];

describe("unirPorIdENome", () => {
  it("descarta a linha legada que repete um nome do Núcleo Mestre", () => {
    const legadas = [{ id: "v1", nome: "Ajudante de Confecção", setor: "" }];
    expect(unirPorIdENome(novas, legadas).map((f) => f.id)).toEqual(["n1", "n2", "n3"]);
  });

  it("mantém a mesma função em setores diferentes — isso é cadastro legítimo", () => {
    // Nenhuma das três sai: o corte é só do lado legado.
    expect(unirPorIdENome(novas, []).length).toBe(3);
  });

  it("mantém a função legada que só existe lá — senão sumiria da tela", () => {
    const legadas = [{ id: "v9", nome: "Costureira", setor: "" }];
    expect(unirPorIdENome(novas, legadas).map((f) => f.id)).toContain("v9");
  });

  it("compara sem acento, caixa e espaço sobrando", () => {
    const legadas = [{ id: "v1", nome: "  ajudante  de confeccao ", setor: "" }];
    expect(unirPorIdENome(novas, legadas).map((f) => f.id)).not.toContain("v1");
  });

  it("legado sem nome fica, em vez de sumir calado", () => {
    const legadas = [{ id: "v2", nome: "", setor: "" }];
    expect(unirPorIdENome(novas, legadas).map((f) => f.id)).toContain("v2");
  });

  it("id repetido continua valendo como o mesmo registro", () => {
    const legadas = [{ id: "n1", nome: "Outro nome", setor: "" }];
    expect(unirPorIdENome(novas, legadas).map((f) => f.id)).toEqual(["n1", "n2", "n3"]);
  });
});

describe("unirPorId", () => {
  it("não olha o nome: repetição de nome é permitida aqui", () => {
    const legadas = [{ id: "v1", nome: "Ajudante de Confecção" }];
    expect(unirPorId(novas, legadas).map((f) => f.id)).toEqual(["n1", "n2", "n3", "v1"]);
  });
});
