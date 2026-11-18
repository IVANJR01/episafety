import { describe, it, expect } from "vitest";
import { decisaoDaFila } from "./filaOffline";

const INSERCAO = { type: "insert" as const, payload: { id: "11111111-1111-4111-8111-111111111111" } };

describe("subir a fila offline", () => {
  it("sem erro, concluída", () => {
    expect(decisaoDaFila(INSERCAO, null)).toBe("concluida");
  });

  it("entrega que já está no servidor é concluída, não fica falhando para sempre", () => {
    /* O servidor gravou, a resposta se perdeu, a fila tentou de novo. */
    expect(decisaoDaFila(INSERCAO, { code: "23505" })).toBe("concluida");
  });

  it("outro erro qualquer continua para tentar de novo", () => {
    expect(decisaoDaFila(INSERCAO, { code: "42501" })).toBe("tentar_de_novo");
    expect(decisaoDaFila(INSERCAO, { code: null })).toBe("tentar_de_novo");
  });

  it("repetição sem id próprio não é dada por concluída", () => {
    /* Sem id, o 23505 pode ser OUTRA linha (código duplicado, por exemplo). */
    expect(decisaoDaFila({ type: "insert", payload: {} }, { code: "23505" })).toBe("tentar_de_novo");
  });

  it("repetição numa atualização não é dada por concluída", () => {
    expect(decisaoDaFila({ type: "update", payload: { id: "x" } }, { code: "23505" })).toBe("tentar_de_novo");
  });
});
