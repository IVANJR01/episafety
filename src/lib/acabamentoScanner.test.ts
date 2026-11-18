import { describe, it, expect } from "vitest";
import { acabarPagina, dimensoesDaPagina, LADO_MAXIMO_PAGINA } from "./acabamentoScanner";

/**
 * Uma "foto" sintética do jeito que ela chega de verdade: papel sob luz
 * amarelada, sombra forte na metade esquerda (a mão, a lateral da mesa),
 * texto preto nos dois lados, um traço de caneta azul e uma área escura
 * grande, como a foto 3x4 de um RG.
 */
const L = 400, A = 560;
const PAPEL = [240, 225, 190]; // luz quente: papel "amarelado" na foto
const sombra = (x: number) => (x < L / 2 ? 0.5 + 0.5 * (x / (L / 2)) : 1); // 50% → 100%

function foto(): Uint8ClampedArray {
  const d = new Uint8ClampedArray(L * A * 4);
  for (let y = 0; y < A; y++) {
    for (let x = 0; x < L; x++) {
      let cor = PAPEL;
      const texto = y % 40 < 3 && x % 60 > 6;             // linhas de "texto"
      const caneta = y > 300 && y < 304 && x > 230 && x < 380; // traço azul, no lado claro
      const fotoRg = x > 250 && x < 370 && y > 420 && y < 540;  // área escura grande
      if (texto) cor = [30, 30, 30];
      if (caneta) cor = [40, 60, 200];
      if (fotoRg) cor = [70, 60, 55];
      const s = sombra(x);
      const i = (y * L + x) * 4;
      d[i] = cor[0] * s; d[i + 1] = cor[1] * s; d[i + 2] = cor[2] * s; d[i + 3] = 255;
    }
  }
  return d;
}

const px = (d: Uint8ClampedArray, x: number, y: number) => {
  const i = (y * L + x) * 4;
  return [d[i], d[i + 1], d[i + 2]];
};
const luma = (p: number[]) => p[0] * 0.299 + p[1] * 0.587 + p[2] * 0.114;

/* Pontos de papel limpo (entre linhas de texto) na sombra e na luz. */
const PAPEL_NA_SOMBRA = [20, 20];
const PAPEL_NA_LUZ = [330, 20];

describe("antes do acabamento, a foto tem o problema", () => {
  it("o papel na sombra é bem mais escuro que na luz", () => {
    /* Garante que o teste testa alguma coisa. */
    const d = foto();
    expect(luma(px(d, ...PAPEL_NA_LUZ as [number, number])) - luma(px(d, ...PAPEL_NA_SOMBRA as [number, number]))).toBeGreaterThan(90);
  });
});

describe("colorido", () => {
  const d = foto();
  acabarPagina(d, L, A, "cor");

  it("o papel sai branco na luz E na sombra", () => {
    const sombra = luma(px(d, ...PAPEL_NA_SOMBRA as [number, number]));
    const luz = luma(px(d, ...PAPEL_NA_LUZ as [number, number]));
    expect(sombra, `papel na sombra ficou ${sombra.toFixed(0)}`).toBeGreaterThan(240);
    expect(luz).toBeGreaterThan(240);
    expect(Math.abs(luz - sombra)).toBeLessThan(10);
  });

  it("a luz amarela some: o papel fica branco neutro", () => {
    const [r, , b] = px(d, ...PAPEL_NA_LUZ as [number, number]);
    expect(Math.abs(r - b), `papel continua amarelado (R=${r}, B=${b})`).toBeLessThan(12);
  });

  it("o texto continua preto nos dois lados", () => {
    expect(luma(px(d, 30, 1))).toBeLessThan(80);  // linha de texto na sombra
    expect(luma(px(d, 330, 1))).toBeLessThan(80); // linha de texto na luz
  });

  it("a caneta azul continua azul", () => {
    const [r, , b] = px(d, 300, 302);
    expect(b - r, `caneta perdeu a cor (R=${r}, B=${b})`).toBeGreaterThan(60);
  });

  it("a foto do RG não é apagada", () => {
    /* Área escura grande não pode ser tomada por "sombra" e clareada. */
    expect(luma(px(d, 310, 480))).toBeLessThan(170);
  });
});

describe("preto e branco", () => {
  const d = foto();
  acabarPagina(d, L, A, "pb");

  it("o papel na sombra sai branco, não mancha preta", () => {
    expect(px(d, ...PAPEL_NA_SOMBRA as [number, number])[0]).toBe(255);
    expect(px(d, 5, 300)[0], "a borda mais escura da sombra virou preto").toBe(255);
  });

  it("o texto dentro da sombra continua legível", () => {
    expect(px(d, 30, 1)[0]).toBe(0);
  });

  it("só sai preto ou branco", () => {
    const valores = new Set<number>();
    for (let i = 0; i < d.length; i += 4) valores.add(d[i]);
    expect([...valores].sort()).toEqual([0, 255]);
  });
});

describe("tons de cinza", () => {
  it("papel branco na sombra, sem cor nenhuma", () => {
    const d = foto();
    acabarPagina(d, L, A, "cinza");
    const [r, g, b] = px(d, ...PAPEL_NA_SOMBRA as [number, number]);
    expect(r).toBe(g); expect(g).toBe(b);
    expect(r).toBeGreaterThan(240);
  });
});

describe("resolução da página", () => {
  it("o teto é A4 a 300 DPI, não os 1600 de antes", () => {
    expect(LADO_MAXIMO_PAGINA).toBe(3508);
  });

  it("foto de 4000 px é reduzida até o teto, mantendo a proporção", () => {
    expect(dimensoesDaPagina(4000, 3000)).toEqual({ largura: 3508, altura: 2631 });
  });

  it("imagem menor nunca é aumentada — aumentar não cria detalhe", () => {
    expect(dimensoesDaPagina(1200, 900)).toEqual({ largura: 1200, altura: 900 });
  });
});
