import { describe, it, expect } from "vitest";
import { corrigirPerspectiva, homografia, aplicar, quadrilateroUtil, type Quadrilatero } from "./perspectiva";

/* jsdom não tem ImageData; para estes testes basta o formato. */
class ImageDataFalso { data: Uint8ClampedArray; constructor(public width: number, public height: number, data?: Uint8ClampedArray) { this.data = data || new Uint8ClampedArray(width * height * 4); } }
(globalThis as any).ImageData = (globalThis as any).ImageData || ImageDataFalso;

/**
 * A versão de antes da otimização, guardada como gabarito. A nova tem de
 * dar a MESMA página — só mais rápido.
 */
function corrigirPerspectivaReferencia(
  origem: ImageData,
  cantos: Quadrilatero,
  larguraDestino: number,
  alturaDestino: number,
): ImageData | null {
  const destino: Quadrilatero = [
    { x: 0, y: 0 },
    { x: larguraDestino - 1, y: 0 },
    { x: larguraDestino - 1, y: alturaDestino - 1 },
    { x: 0, y: alturaDestino - 1 },
  ];
  if (!quadrilateroUtil(cantos)) return null;
  const h = homografia(destino, cantos);
  if (!h) return null;

  const saida = new ImageData(larguraDestino, alturaDestino);
  const src = origem.data;
  const dst = saida.data;
  const lo = origem.width;
  const al = origem.height;

  for (let y = 0; y < alturaDestino; y++) {
    for (let x = 0; x < larguraDestino; x++) {
      const p = aplicar(h, { x, y });
      const i = (y * larguraDestino + x) * 4;

      if (p.x < 0 || p.y < 0 || p.x > lo - 1 || p.y > al - 1) {
        // Fora da folha: branco, como a área que o scanner não cobre.
        dst[i] = dst[i + 1] = dst[i + 2] = 255;
        dst[i + 3] = 255;
        continue;
      }

      const x0 = Math.floor(p.x), y0 = Math.floor(p.y);
      const x1 = Math.min(x0 + 1, lo - 1), y1 = Math.min(y0 + 1, al - 1);
      const fx = p.x - x0, fy = p.y - y0;

      for (let c = 0; c < 3; c++) {
        const a = src[(y0 * lo + x0) * 4 + c] * (1 - fx) + src[(y0 * lo + x1) * 4 + c] * fx;
        const b = src[(y1 * lo + x0) * 4 + c] * (1 - fx) + src[(y1 * lo + x1) * 4 + c] * fx;
        dst[i + c] = a * (1 - fy) + b * fy;
      }
      dst[i + 3] = 255;
    }
  }
  return saida;
}

function imagemAleatoria(l: number, a: number) {
  const d = new Uint8ClampedArray(l * a * 4);
  let s = 7;
  for (let i = 0; i < d.length; i++) d[i] = (s = (s * 1103515245 + 12345) >>> 0) >>> 24;
  return new (globalThis as any).ImageData(l, a, d);
}

describe("endireitar a folha", () => {
  const origem = imagemAleatoria(320, 240);
  const quad: Quadrilatero = [{ x: 40, y: 22 }, { x: 290, y: 35 }, { x: 300, y: 225 }, { x: 18, y: 210 }];

  it("dá a mesma página que a versão anterior", () => {
    const novo = corrigirPerspectiva(origem, quad, 260, 200)!;
    const ref = corrigirPerspectivaReferencia(origem, quad, 260, 200)!;
    let maior = 0;
    for (let i = 0; i < novo.data.length; i++) maior = Math.max(maior, Math.abs(novo.data[i] - ref.data[i]));
    /* Até 1 nível de diferença: arredondamento da ordem das contas. */
    expect(maior).toBeLessThanOrEqual(1);
  });

  it("o retângulo inteiro da imagem devolve a própria imagem", () => {
    const tudo: Quadrilatero = [{ x: 0, y: 0 }, { x: 319, y: 0 }, { x: 319, y: 239 }, { x: 0, y: 239 }];
    const r = corrigirPerspectiva(origem, tudo, 320, 240)!;
    let maior = 0;
    /* Só as cores: a saída é sempre opaca, a origem de teste não. */
    for (let i = 0; i < r.data.length; i++) if (i % 4 !== 3) maior = Math.max(maior, Math.abs(r.data[i] - origem.data[i]));
    expect(maior).toBeLessThanOrEqual(1);
  });

  it("o que fica fora da foto sai branco", () => {
    const passa: Quadrilatero = [{ x: -40, y: -40 }, { x: 330, y: -40 }, { x: 330, y: 260 }, { x: -40, y: 260 }];
    const r = corrigirPerspectiva(origem, passa, 100, 80)!;
    expect([r.data[0], r.data[1], r.data[2], r.data[3]]).toEqual([255, 255, 255, 255]);
  });

  it("quadrilátero achatado é recusado", () => {
    const achatado: Quadrilatero = [{ x: 0, y: 0 }, { x: 100, y: 1 }, { x: 200, y: 2 }, { x: 300, y: 3 }];
    expect(quadrilateroUtil(achatado)).toBe(false);
    expect(corrigirPerspectiva(origem, achatado, 50, 50)).toBeNull();
  });

  it("a homografia leva cada canto ao seu destino", () => {
    const destino: Quadrilatero = [{ x: 0, y: 0 }, { x: 99, y: 0 }, { x: 99, y: 49 }, { x: 0, y: 49 }];
    const h = homografia(destino, quad)!;
    destino.forEach((p, i) => {
      const q = aplicar(h, p);
      expect(q.x).toBeCloseTo(quad[i].x, 6);
      expect(q.y).toBeCloseTo(quad[i].y, 6);
    });
  });
});
