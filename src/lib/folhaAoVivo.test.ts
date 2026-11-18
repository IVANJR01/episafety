import { describe, it, expect } from "vitest";
import { acompanharFolha, SEM_FOLHA, type EstadoDaFolha, type Ponto } from "./folhaAoVivo";

const folha = (dx = 0): Ponto[] => [
  { x: 100 + dx, y: 100 }, { x: 900 + dx, y: 100 }, { x: 900 + dx, y: 1200 }, { x: 100 + dx, y: 1200 },
];
const LADO = 1600;

function rodar(quadros: (Ponto[] | null)[]) {
  let estado: EstadoDaFolha = SEM_FOLHA;
  return quadros.map((q) => {
    const r = acompanharFolha(estado, q, LADO);
    estado = r.estado;
    return r.mostrar;
  });
}

describe("acompanharFolha", () => {
  it("só mostra depois de ver a folha em 2 quadros seguidos", () => {
    const m = rodar([folha(), folha(4)]);
    expect(m[0]).toBeNull();
    expect(m[1]).not.toBeNull();
  });

  it("um papel que aparece num quadro só não acende o contorno", () => {
    expect(rodar([folha(), null, null, null])).toEqual([null, null, null, null]);
  });

  it("a folha que pula de lugar recomeça a contagem", () => {
    const m = rodar([folha(), folha(4), folha(400)]);
    expect(m[1]).not.toBeNull();
    expect(m[2]).toBeNull();
  });

  it("o contorno anda metade do caminho em vez de pular", () => {
    const m = rodar([folha(), folha(20)]);
    expect(m[1]![0].x).toBe(110);
  });

  it("até 2 quadros sem achar mantêm o contorno; o terceiro apaga", () => {
    const m = rodar([folha(), folha(), null, null, null]);
    expect(m[2]).not.toBeNull();
    expect(m[3]).not.toBeNull();
    expect(m[4]).toBeNull();
  });

  it("depois de um quadro perdido, a mesma folha continua aparecendo", () => {
    const m = rodar([folha(), folha(), null, folha(2)]);
    expect(m[3]).not.toBeNull();
  });
});
