import { describe, it, expect } from "vitest";
import { caixaDaTinta, escritaDeLado, deitarAssinatura, girarHorario, encaixar } from "./assinaturaDeitada";

/** Imagem branca com retângulos pretos (a "tinta"). */
function imagem(w: number, h: number, tracos: [number, number, number, number][]) {
  const px = new Uint8ClampedArray(w * h * 4).fill(255);
  for (const [x, y, tw, th] of tracos)
    for (let j = y; j < y + th; j++) for (let i = x; i < x + tw; i++) px.set([0, 0, 0, 255], (j * w + i) * 4);
  return px;
}
const preto = (px: Uint8ClampedArray, w: number, x: number, y: number) => px[(y * w + x) * 4] < 128;

describe("assinatura deitada", () => {
  it("acha a caixa da tinta", () => {
    expect(caixaDaTinta(imagem(50, 40, [[10, 5, 20, 3]]), 50, 40)).toEqual({ x: 10, y: 5, w: 20, h: 3 });
    expect(caixaDaTinta(imagem(50, 40, []), 50, 40)).toBeNull();
  });

  it("o caso do print: área em pé, assinatura escrita de lado → gira e fica larga", () => {
    // 72 x 119 como os 720 x 1193 px do celular, com o traço comprido na vertical
    const px = imagem(72, 119, [[30, 10, 8, 90]]);
    const r = deitarAssinatura(px, 72, 119);
    expect(r.girou).toBe(true);
    expect(r.w).toBeGreaterThan(r.h);
  });

  it("assinatura normal num celular em pé não gira", () => {
    const r = deitarAssinatura(imagem(72, 119, [[5, 50, 60, 10]]), 72, 119);
    expect(r.girou).toBe(false);
    expect(r.w).toBeGreaterThan(r.h);
  });

  it("área deitada nunca gira, mesmo com rubrica alta", () => {
    expect(deitarAssinatura(imagem(200, 80, [[90, 5, 10, 70]]), 200, 80).girou).toBe(false);
  });

  it("recorta o branco em volta, com folga pequena", () => {
    const r = deitarAssinatura(imagem(300, 150, [[100, 60, 100, 20]]), 300, 150);
    expect(r.w).toBeLessThan(120);
    expect(r.h).toBeLessThan(40);
  });

  it("assinatura em branco volta como estava", () => {
    const px = imagem(40, 60, []);
    expect(deitarAssinatura(px, 40, 60)).toMatchObject({ w: 40, h: 60, girou: false });
  });

  it("giro horário: o que estava à esquerda vai para cima", () => {
    // 4 x 2, ponto preto em (0, 1) — canto inferior esquerdo
    const g = girarHorario(imagem(4, 2, [[0, 1, 1, 1]]), 4, 2);
    expect([g.w, g.h]).toEqual([2, 4]);
    expect(preto(g.px, g.w, 0, 0)).toBe(true); // vai para o canto superior esquerdo
    expect(preto(g.px, g.w, 1, 0)).toBe(false);
  });

  it("encaixa sem distorcer e centraliza", () => {
    const e = encaixar(200, 100, 56, 10);
    expect(e.w / e.h).toBeCloseTo(2);
    expect(e.h).toBe(10);
    expect(e.dx).toBeCloseTo(18);
    expect(e.dy).toBe(0);
  });

  it("só conta como escrita de lado com a tinta bem mais alta que larga", () => {
    expect(escritaDeLado(72, 119, { x: 0, y: 0, w: 30, h: 35 })).toBe(false);
    expect(escritaDeLado(72, 119, { x: 0, y: 0, w: 30, h: 60 })).toBe(true);
  });
});
