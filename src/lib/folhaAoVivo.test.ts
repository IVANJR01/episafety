import { describe, it, expect } from "vitest";
import {
  acompanharFolha, SEM_FOLHA, decidirCaptura, progressoDaCaptura, videoBastaComoFoto, QUADROS_PARADOS,
  type EstadoDaFolha, type Ponto,
} from "./folhaAoVivo";

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

function simular(quadros: (Ponto[] | null)[]) {
  let estado: EstadoDaFolha = SEM_FOLHA;
  let gatilho = { armado: true };
  return quadros.map((q) => {
    const r = acompanharFolha(estado, q, LADO);
    estado = r.estado;
    const d = decidirCaptura(gatilho, estado, r.mostrar);
    gatilho = d.gatilho;
    return d.fotografar;
  });
}
const parada = (n: number) => Array.from({ length: n }, () => folha());

describe("captura automática", () => {
  it("fotografa sozinha quando a folha fica parada", () => {
    const f = simular(parada(QUADROS_PARADOS + 1));
    expect(f.lastIndexOf(true)).toBe(QUADROS_PARADOS);
    expect(f.filter(Boolean)).toHaveLength(1);
  });

  it("não fotografa com a mão tremendo", () => {
    const tremendo = Array.from({ length: 12 }, (_, i) => folha(i % 2 ? 40 : 0));
    expect(simular(tremendo).some(Boolean)).toBe(false);
  });

  it("não fotografa a mesma página de novo enquanto ela continua ali", () => {
    expect(simular(parada(20)).filter(Boolean)).toHaveLength(1);
  });

  it("fotografa a próxima página depois que a anterior sai da frente", () => {
    const f = simular([...parada(6), null, null, null, ...parada(6)]);
    expect(f.filter(Boolean)).toHaveLength(2);
  });

  it("fotografa a próxima página se ela for posta em outro lugar", () => {
    const f = simular([...parada(6), ...Array.from({ length: 6 }, () => folha(300))]);
    expect(f.filter(Boolean)).toHaveLength(2);
  });

  it("o anel enche conforme a folha fica parada", () => {
    let estado: EstadoDaFolha = SEM_FOLHA;
    const p: number[] = [];
    for (const q of parada(QUADROS_PARADOS + 2)) { estado = acompanharFolha(estado, q, LADO).estado; p.push(progressoDaCaptura(estado)); }
    expect(p[0]).toBe(0);
    expect(p[p.length - 1]).toBe(1);
    expect(p).toEqual([...p].sort((a, b) => a - b));
  });
});

describe("videoBastaComoFoto", () => {
  it("vídeo 4K basta; Full HD não", () => {
    expect(videoBastaComoFoto(3840, 2160)).toBe(true);
    expect(videoBastaComoFoto(2160, 3840)).toBe(true);
    expect(videoBastaComoFoto(1920, 1080)).toBe(false);
  });
});
