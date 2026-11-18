import { describe, it, expect } from "vitest";
import { detectarFolha, ordenarComoFolha } from "./deteccaoFolha";
import { montarCena, folhaGirada, type Cena } from "./cenasDeFolha";
import type { Ponto } from "./perspectiva";

const MADEIRA: [number, number, number] = [120, 82, 50];
const L = 600, A = 800;

/** Maior distância entre o canto achado e o verdadeiro, em % da diagonal da foto. */
function erro(achado: Ponto[] | null, real: Ponto[]): number {
  if (!achado) return Infinity;
  const certo = ordenarComoFolha(real);
  const diag = Math.hypot(L, A);
  return Math.max(...achado.map((p, i) => Math.hypot(p.x - certo[i].x, p.y - certo[i].y))) / diag * 100;
}

const cena = (extra: Partial<Cena> & { cantos: Ponto[] }): Cena => ({ largura: L, altura: A, mesa: MADEIRA, ...extra });

/* Até 2% da diagonal: ~20 px numa foto de 1000 — o dedo ajusta isso, se precisar. */
const TOLERANCIA = 2;

const CENAS: [string, Cena][] = [
  ["folha reta sobre a mesa", cena({ cantos: folhaGirada(300, 400, 420, 594, 0) })],
  ["folha girada 15°", cena({ cantos: folhaGirada(300, 400, 400, 566, 15) })],
  ["folha girada 40° — onde o detector antigo falhava", cena({ cantos: folhaGirada(300, 400, 340, 480, 40) })],
  ["foto tirada de lado (perspectiva)", cena({ cantos: [{ x: 170, y: 140 }, { x: 440, y: 150 }, { x: 540, y: 700 }, { x: 70, y: 690 }] })],
  ["folha fora do centro", cena({ cantos: folhaGirada(380, 500, 300, 424, 8) })],
  ["sombra forte em metade da folha", cena({
    cantos: folhaGirada(300, 400, 420, 594, 5),
    sombra: (x) => (x < 0.5 ? 0.62 : 1),
  })],
  ["mesa clara e sem cor (cinza)", cena({ mesa: [150, 150, 152], cantos: folhaGirada(300, 400, 420, 594, 10) })],
  ["mesa clara e amarelada (madeira clara, fórmica bege)", cena({ mesa: [232, 198, 120], cantos: folhaGirada(300, 400, 420, 594, 7) })],
  ["foto com pouca luz e muito ruído", cena({ cantos: folhaGirada(300, 400, 420, 594, 4), sombra: () => 0.55, ruido: 70 })],
  ["perspectiva forte (foto tirada bem de lado)", cena({ cantos: [{ x: 220, y: 160 }, { x: 380, y: 160 }, { x: 570, y: 760 }, { x: 30, y: 760 }] })],
  ["documento com foto 3x4 escura (RG, crachá)", cena({
    cantos: folhaGirada(300, 400, 420, 594, 6),
    manchas: [{ u: 0.1, v: 0.12, tu: 0.3, tv: 0.25 }],
  })],
];

describe("acha os 4 cantos da folha", () => {
  for (const [nome, c] of CENAS) {
    it(nome, () => {
      const achado = detectarFolha(montarCena(c));
      const e = erro(achado, c.cantos);
      expect(e, `${nome}: erro de ${e.toFixed(1)}% da diagonal`).toBeLessThan(TOLERANCIA);
    });
  }
});

describe("não inventa folha", () => {
  it("mesa vazia: nada", () => {
    const vazia = montarCena({ largura: L, altura: A, mesa: MADEIRA, cantos: [{ x: -10, y: -10 }, { x: -9, y: -10 }, { x: -9, y: -9 }, { x: -10, y: -9 }] });
    expect(detectarFolha(vazia)).toBeNull();
  });

  it("papel branco triangular (pedaço rasgado) não vira folha", () => {
    const triangulo = montarCena(cena({ cantos: [{ x: 60, y: 120 }, { x: 560, y: 160 }, { x: 300, y: 740 }, { x: 299, y: 740 }] }));
    expect(detectarFolha(triangulo)).toBeNull();
  });

  it("pedaço pequeno de papel (um bilhete) não é a folha", () => {
    const bilhete = montarCena(cena({ cantos: folhaGirada(300, 400, 120, 90, 0) }));
    expect(detectarFolha(bilhete)).toBeNull();
  });
});

describe("ordem dos cantos", () => {
  it("superior-esquerdo, superior-direito, inferior-direito, inferior-esquerdo", () => {
    const q = ordenarComoFolha([{ x: 10, y: 90 }, { x: 90, y: 10 }, { x: 10, y: 10 }, { x: 90, y: 90 }]);
    expect(q).toEqual([{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }]);
  });
});
