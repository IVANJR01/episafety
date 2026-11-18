import { describe, it, expect } from "vitest";
import { acabarPagina, dimensoesDaPagina, LADO_MAXIMO_PAGINA, normalizarIluminacao } from "./acabamentoScanner";

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


/* ---- Gabarito: a versão de antes da otimização. A nova tem de dar o mesmo. ---- */
const FRACAO_DO_BLOCO = 1 / 40;
const PISO_DO_FUNDO = 0.55;
function estimarFundoReferencia(d: Uint8ClampedArray, largura: number, altura: number) {
  const lado = Math.max(8, Math.round(Math.max(largura, altura) * FRACAO_DO_BLOCO));
  const gx = Math.ceil(largura / lado);
  const gy = Math.ceil(altura / lado);
  const grade = new Float32Array(gx * gy * 3);

  for (let by = 0; by < gy; by++) {
    for (let bx = 0; bx < gx; bx++) {
      /*
       * O 2º maior valor de cada canal, e não o máximo: um pixel estourado
       * de brilho (reflexo, ruído da câmera) não decide o bloco sozinho.
       */
      const m1 = [0, 0, 0], m2 = [0, 0, 0];
      const y1 = Math.min(altura, (by + 1) * lado);
      const x1 = Math.min(largura, (bx + 1) * lado);
      for (let y = by * lado; y < y1; y += 2) {
        for (let x = bx * lado; x < x1; x += 2) {
          const i = (y * largura + x) * 4;
          for (let c = 0; c < 3; c++) {
            const v = d[i + c];
            if (v > m1[c]) { m2[c] = m1[c]; m1[c] = v; } else if (v > m2[c]) m2[c] = v;
          }
        }
      }
      const g = (by * gx + bx) * 3;
      for (let c = 0; c < 3; c++) grade[g + c] = m2[c] || m1[c];
    }
  }

  /* Suaviza a grade: o fundo muda devagar; degrau de bloco viraria faixa. */
  const suave = new Float32Array(grade.length);
  for (let by = 0; by < gy; by++) {
    for (let bx = 0; bx < gx; bx++) {
      for (let c = 0; c < 3; c++) {
        let soma = 0, n = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const yy = by + dy, xx = bx + dx;
            if (yy < 0 || xx < 0 || yy >= gy || xx >= gx) continue;
            soma += grade[(yy * gx + xx) * 3 + c];
            n++;
          }
        }
        suave[(by * gx + bx) * 3 + c] = soma / n;
      }
    }
  }

  /* O papel da página: o fundo mais claro encontrado, canal a canal. */
  const papel = [1, 1, 1];
  for (let g = 0; g < suave.length; g += 3) {
    for (let c = 0; c < 3; c++) papel[c] = Math.max(papel[c], suave[g + c]);
  }
  for (let g = 0; g < suave.length; g += 3) {
    for (let c = 0; c < 3; c++) {
      suave[g + c] = Math.max(suave[g + c], papel[c] * PISO_DO_FUNDO, 1);
    }
  }

  return { grade: suave, gx, gy, lado };
}

/**
 * Tira sombra e cor da luz, deixando o papel branco e a tinta como está.
 * Altera `d` no lugar.
 */
function normalizarIluminacaoReferencia(d: Uint8ClampedArray, largura: number, altura: number): void {
  const { grade, gx, gy, lado } = estimarFundoReferencia(d, largura, altura);

  for (let y = 0; y < altura; y++) {
    /* Posição na grade, centrada no bloco, para interpolar entre vizinhos. */
    const fy = Math.min(gy - 1, Math.max(0, (y + 0.5) / lado - 0.5));
    const y0 = Math.floor(fy), y1 = Math.min(gy - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < largura; x++) {
      const fx = Math.min(gx - 1, Math.max(0, (x + 0.5) / lado - 0.5));
      const x0 = Math.floor(fx), x1 = Math.min(gx - 1, x0 + 1), tx = fx - x0;
      const i = (y * largura + x) * 4;
      for (let c = 0; c < 3; c++) {
        const a = grade[(y0 * gx + x0) * 3 + c] * (1 - tx) + grade[(y0 * gx + x1) * 3 + c] * tx;
        const b = grade[(y1 * gx + x0) * 3 + c] * (1 - tx) + grade[(y1 * gx + x1) * 3 + c] * tx;
        const fundo = a * (1 - ty) + b * ty;
        d[i + c] = Math.min(255, (d[i + c] / fundo) * 255);
      }
    }
  }
}

describe("a correção de iluminação otimizada dá a mesma página", () => {
  it("pixel a pixel, na foto com sombra", () => {
    const a = foto(), b = foto();
    normalizarIluminacao(a, L, A);
    normalizarIluminacaoReferencia(b, L, A);
    let maior = 0;
    for (let i = 0; i < a.length; i++) maior = Math.max(maior, Math.abs(a[i] - b[i]));
    expect(maior).toBeLessThanOrEqual(1);
  });
});
