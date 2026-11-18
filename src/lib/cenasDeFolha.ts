/**
 * Cenas sintéticas de "foto de documento", para testar a detecção da
 * folha sem câmera e sem canvas. Só para teste.
 */
import type { Ponto } from "./perspectiva";

export interface Cena {
  largura: number;
  altura: number;
  cantos: Ponto[]; // superior-esquerdo, superior-direito, inferior-direito, inferior-esquerdo
  mesa: [number, number, number];
  papel?: [number, number, number];
  sombra?: (x: number, y: number) => number;
  /** Áreas escuras dentro da folha (foto de RG, logotipo), em fração da folha. */
  manchas?: { u: number; v: number; tu: number; tv: number }[];
  ruido?: number;
}

function dentro(p: Ponto, q: Ponto[]): boolean {
  let ok = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    if ((q[i].y > p.y) !== (q[j].y > p.y) &&
        p.x < ((q[j].x - q[i].x) * (p.y - q[i].y)) / (q[j].y - q[i].y) + q[i].x) ok = !ok;
  }
  return ok;
}

/** Coordenadas (u, v) de 0 a 1 dentro da folha, por interpolação bilinear inversa aproximada. */
function naFolha(p: Ponto, q: Ponto[]) {
  const [a, b, , d] = q;
  const ex = { x: b.x - a.x, y: b.y - a.y }, ey = { x: d.x - a.x, y: d.y - a.y };
  const det = ex.x * ey.y - ex.y * ey.x;
  const rx = p.x - a.x, ry = p.y - a.y;
  return { u: (rx * ey.y - ry * ey.x) / det, v: (ex.x * ry - ex.y * rx) / det };
}

/* Pseudoaleatório fixo: o teste não pode mudar de uma rodada para outra. */
function sorteio(semente: number) {
  let s = semente >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function montarCena(c: Cena) {
  const data = new Uint8ClampedArray(c.largura * c.altura * 4);
  const rnd = sorteio(42);
  const papel = c.papel || [236, 232, 222];
  for (let y = 0; y < c.altura; y++) {
    for (let x = 0; x < c.largura; x++) {
      const p = { x: x + 0.5, y: y + 0.5 };
      let cor: number[] = c.mesa;
      if (dentro(p, c.cantos)) {
        cor = papel;
        const { u, v } = naFolha(p, c.cantos);
        /* Linhas de texto: faixas escuras finas, como um documento. */
        if (u > 0.08 && u < 0.92 && v > 0.08 && v < 0.9 && Math.floor(v * 60) % 3 === 0 && (u * 50) % 1 > 0.15) cor = [35, 35, 40];
        for (const m of c.manchas || []) if (u > m.u && u < m.u + m.tu && v > m.v && v < m.v + m.tv) cor = [60, 52, 48];
      } else if ((x * 7 + y * 3) % 23 < 4) {
        /* Veio da madeira / textura do piso. */
        cor = cor.map((k) => k * 0.85);
      }
      const s = c.sombra ? c.sombra(x / c.largura, y / c.altura) : 1;
      const r = (rnd() - 0.5) * (c.ruido ?? 10);
      const i = (y * c.largura + x) * 4;
      data[i] = cor[0] * s + r; data[i + 1] = cor[1] * s + r; data[i + 2] = cor[2] * s + r; data[i + 3] = 255;
    }
  }
  return { data, width: c.largura, height: c.altura };
}

/** Retângulo de lados w x h, centrado em (cx, cy), girado em graus. */
export function folhaGirada(cx: number, cy: number, w: number, h: number, graus: number): Ponto[] {
  const r = (graus * Math.PI) / 180, cos = Math.cos(r), sin = Math.sin(r);
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]
    .map(([x, y]) => ({ x: cx + x * cos - y * sin, y: cy + x * sin + y * cos }));
}
