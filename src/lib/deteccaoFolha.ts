/**
 * Acha a folha na foto e devolve os 4 cantos, sem ninguém marcar.
 *
 * O detector anterior disparava raios do CENTRO da foto e parava onde
 * ficava "35 pontos mais escuro que o centro". Três coisas quebravam:
 * sombra dentro da própria folha (o raio parava no meio do papel), folha
 * fora do centro, e folha girada — os cantos eram achados por x+y e x−y,
 * que só funciona com a folha quase reta. Quando falhava, os cantos iam
 * para um recuo fixo de 6% e o técnico arrastava os quatro na mão.
 *
 * Aqui o caminho é o dos aplicativos de scanner, sem biblioteca:
 *
 *   1. reduz a foto (detecção não precisa de detalhe, precisa de forma);
 *   2. dá nota de "brancura" a cada pixel — claro E sem cor, que é o que
 *      distingue papel de mesa de madeira, de piso, de tecido;
 *   3. separa papel do resto pelo limiar de Otsu, calculado na própria
 *      foto (sem número fixo que só vale para uma luz);
 *   4. pega a maior região de papel, o contorno convexo dela, e reduz esse
 *      contorno aos 4 vértices de maior área — vale para qualquer rotação
 *      e para a folha vista de lado, em perspectiva;
 *   5. só aceita se parecer folha: área razoável, convexo, ângulos sãos.
 *
 * Entra a imagem (RGBA), saem os cantos em coordenadas dela — na ordem
 * superior-esquerdo, superior-direito, inferior-direito, inferior-esquerdo.
 */

import type { Ponto } from "./perspectiva";

export interface ImagemRGBA {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

/** Lado maior da imagem usada na detecção. */
const LADO_DE_DETECCAO = 360;

/** A folha precisa ocupar pelo menos isto da foto para valer. */
const AREA_MINIMA = 0.12;

/* ---------- 1 e 2: reduzir e dar nota de brancura ---------- */

function notaDeBrancura(img: ImagemRGBA) {
  const escala = Math.min(1, LADO_DE_DETECCAO / Math.max(img.width, img.height));
  const w = Math.max(8, Math.round(img.width * escala));
  const h = Math.max(8, Math.round(img.height * escala));
  const nota = new Float32Array(w * h);
  const passoX = img.width / w, passoY = img.height / h;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      /* Média de 4 amostras dentro do bloco: menos ruído que um pixel só. */
      let soma = 0;
      for (let k = 0; k < 4; k++) {
        const sx = Math.min(img.width - 1, Math.floor((x + (k & 1 ? 0.75 : 0.25)) * passoX));
        const sy = Math.min(img.height - 1, Math.floor((y + (k & 2 ? 0.75 : 0.25)) * passoY));
        const i = (sy * img.width + sx) * 4;
        const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
        const luma = r * 0.299 + g * 0.587 + b * 0.114;
        const saturacao = Math.max(r, g, b) - Math.min(r, g, b);
        /* Papel: claro e sem cor. Madeira e piso: cor. */
        soma += luma - 0.9 * saturacao;
      }
      nota[y * w + x] = soma / 4;
    }
  }

  /* Suaviza 3x3: a letra impressa não pode furar o papel. */
  const suave = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy < 0 || xx < 0 || yy >= h || xx >= w) continue;
        s += nota[yy * w + xx]; n++;
      }
      suave[y * w + x] = s / n;
    }
  }
  return { nota: suave, w, h, escalaX: img.width / w, escalaY: img.height / h };
}

/* ---------- 3: limiar de Otsu ---------- */

function limiarDeOtsu(nota: Float32Array): number {
  let min = Infinity, max = -Infinity;
  for (const v of nota) { if (v < min) min = v; if (v > max) max = v; }
  if (max - min < 1) return max + 1;
  const hist = new Float64Array(256);
  for (const v of nota) hist[Math.min(255, Math.floor(((v - min) / (max - min)) * 255))]++;
  const total = nota.length;
  let somaTotal = 0;
  for (let i = 0; i < 256; i++) somaTotal += i * hist[i];
  let pesoFundo = 0, somaFundo = 0, melhor = 0, limiar = 127;
  for (let i = 0; i < 256; i++) {
    pesoFundo += hist[i];
    if (!pesoFundo) continue;
    const pesoFrente = total - pesoFundo;
    if (!pesoFrente) break;
    somaFundo += i * hist[i];
    const mediaFundo = somaFundo / pesoFundo;
    const mediaFrente = (somaTotal - somaFundo) / pesoFrente;
    const entre = pesoFundo * pesoFrente * (mediaFundo - mediaFrente) ** 2;
    if (entre > melhor) { melhor = entre; limiar = i; }
  }
  return min + ((limiar + 0.5) / 255) * (max - min);
}

/* ---------- 4: maior região, contorno, 4 vértices ---------- */

/** Maior região conectada de papel; devolve, por linha, a primeira e a última coluna. */
function maiorRegiao(mascara: Uint8Array, w: number, h: number) {
  const rotulo = new Int32Array(w * h).fill(-1);
  let melhorRotulo = -1, melhorTamanho = 0, atual = 0;
  const fila = new Int32Array(w * h);
  for (let inicio = 0; inicio < w * h; inicio++) {
    if (!mascara[inicio] || rotulo[inicio] !== -1) continue;
    let cabeca = 0, cauda = 0, tamanho = 0;
    fila[cauda++] = inicio; rotulo[inicio] = atual;
    while (cabeca < cauda) {
      const p = fila[cabeca++]; tamanho++;
      const x = p % w, y = (p - x) / w;
      const viz = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of viz) {
        if (q >= 0 && mascara[q] && rotulo[q] === -1) { rotulo[q] = atual; fila[cauda++] = q; }
      }
    }
    if (tamanho > melhorTamanho) { melhorTamanho = tamanho; melhorRotulo = atual; }
    atual++;
  }
  const pontos: Ponto[] = [];
  for (let y = 0; y < h; y++) {
    let esq = -1, dir = -1;
    for (let x = 0; x < w; x++) if (rotulo[y * w + x] === melhorRotulo) { if (esq < 0) esq = x; dir = x; }
    if (esq >= 0) { pontos.push({ x: esq, y }, { x: dir + 1, y }); }
  }
  return { pontos, tamanho: melhorTamanho };
}

function cruz(o: Ponto, a: Ponto, b: Ponto) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Contorno convexo (cadeia monótona), no sentido horário da tela. */
function contornoConvexo(pts: Ponto[]): Ponto[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const baixo: Ponto[] = [], cima: Ponto[] = [];
  for (const q of p) {
    while (baixo.length >= 2 && cruz(baixo[baixo.length - 2], baixo[baixo.length - 1], q) <= 0) baixo.pop();
    baixo.push(q);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (cima.length >= 2 && cruz(cima[cima.length - 2], cima[cima.length - 1], q) <= 0) cima.pop();
    cima.push(q);
  }
  return baixo.slice(0, -1).concat(cima.slice(0, -1));
}

function areaDoPoligono(p: Ponto[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    a += p[i].x * p[j].y - p[j].x * p[i].y;
  }
  return Math.abs(a) / 2;
}

/**
 * Os 4 vértices do contorno que cercam a maior área.
 *
 * O contorno da folha tem dezenas de vértices (o serrilhado da foto
 * reduzida). Os quatro cantos de verdade são o par mais distante (a
 * diagonal) e, de cada lado dela, o ponto mais afastado.
 */
function quatroCantos(contorno: Ponto[]): Ponto[] | null {
  const n = contorno.length;
  if (n < 4) return null;
  let a = 0, c = 0, melhorD = -1;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const d = (contorno[i].x - contorno[j].x) ** 2 + (contorno[i].y - contorno[j].y) ** 2;
    if (d > melhorD) { melhorD = d; a = i; c = j; }
  }
  const maisLonge = (de: number, ate: number, p: number, q: number) => {
    let melhor = -1, idx = -1;
    for (let k = (de + 1) % n; k !== ate; k = (k + 1) % n) {
      const d = Math.abs(cruz(contorno[p], contorno[q], contorno[k]));
      if (d > melhor) { melhor = d; idx = k; }
    }
    return idx;
  };
  const b = maisLonge(a, c, a, c);
  const d = maisLonge(c, a, a, c);
  if (b < 0 || d < 0) return null;
  /*
   * Havia aqui um refinamento que movia cada canto em busca de área maior.
   * Sabotado (desligado), nenhuma das 11 cenas de teste mudou — nem a de
   * perspectiva forte: num contorno convexo de quatro lados, a diagonal
   * mais longa e o ponto mais afastado de cada lado dela já são os cantos.
   * Saiu.
   */
  const idx = [a, b, c, d];
  return idx.map((t) => contorno[t]);
}

/** Põe na ordem: superior-esquerdo, superior-direito, inferior-direito, inferior-esquerdo. */
export function ordenarComoFolha(p: Ponto[]): Ponto[] {
  const cx = p.reduce((s, q) => s + q.x, 0) / p.length;
  const cy = p.reduce((s, q) => s + q.y, 0) / p.length;
  const porAngulo = [...p].sort((u, v) => Math.atan2(u.y - cy, u.x - cx) - Math.atan2(v.y - cy, v.x - cx));
  /* Começa pelo de menor x+y (o mais próximo do canto superior esquerdo). */
  let inicio = 0;
  porAngulo.forEach((q, i) => { if (q.x + q.y < porAngulo[inicio].x + porAngulo[inicio].y) inicio = i; });
  return [0, 1, 2, 3].map((k) => porAngulo[(inicio + k) % 4]);
}

/* ---------- 5: só aceita o que parece folha ---------- */

function pareceFolha(q: Ponto[], larguraImg: number, alturaImg: number): boolean {
  if (areaDoPoligono(q) < AREA_MINIMA * larguraImg * alturaImg) return false;
  for (let i = 0; i < 4; i++) {
    const a = q[(i + 3) % 4], b = q[i], c = q[(i + 1) % 4];
    const v1 = { x: a.x - b.x, y: a.y - b.y }, v2 = { x: c.x - b.x, y: c.y - b.y };
    const cos = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1);
    const graus = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
    /* Folha em perspectiva fica entre ~45° e ~135°. Fora disso, é outra coisa. */
    if (graus < 40 || graus > 140) return false;
  }
  return true;
}

/** Os 4 cantos da folha, ou null quando não há folha clara na foto. */
export function detectarFolha(img: ImagemRGBA): Ponto[] | null {
  if (!img || img.width < 16 || img.height < 16) return null;
  const { nota, w, h, escalaX, escalaY } = notaDeBrancura(img);
  const limiar = limiarDeOtsu(nota);
  const mascara = new Uint8Array(w * h);
  for (let i = 0; i < nota.length; i++) mascara[i] = nota[i] > limiar ? 1 : 0;

  const { pontos, tamanho } = maiorRegiao(mascara, w, h);
  /* Região que cobre a foto inteira: não há borda para achar. */
  if (tamanho > 0.97 * w * h) return null;

  const contorno = contornoConvexo(pontos);
  const cantos = quatroCantos(contorno);
  if (!cantos) return null;

  const naImagem = ordenarComoFolha(cantos).map((p) => ({
    x: Math.max(0, Math.min(img.width, p.x * escalaX)),
    y: Math.max(0, Math.min(img.height, p.y * escalaY)),
  }));
  return pareceFolha(naImagem, img.width, img.height) ? naImagem : null;
}
