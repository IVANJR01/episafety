/**
 * Correção de perspectiva — o que separa uma digitalização de uma foto.
 *
 * Foto de documento sai como trapézio: a borda de cima menor que a de baixo,
 * o texto inclinado, a folha ocupando parte do quadro. Um scanner entrega
 * retângulo. Para chegar lá é preciso saber os quatro cantos da folha e
 * remapear os pixels de dentro deles para um retângulo.
 */

export interface Ponto { x: number; y: number }

/** Cantos na ordem superior-esquerdo, superior-direito, inferior-direito, inferior-esquerdo. */
export type Quadrilatero = [Ponto, Ponto, Ponto, Ponto];

/**
 * Resolve um sistema linear pelo método de eliminação de Gauss com pivô
 * parcial. `a` é a matriz aumentada (n linhas × n+1 colunas) e é modificada.
 */
function resolverSistema(a: number[][], n: number): number[] | null {
  for (let i = 0; i < n; i++) {
    // Pivô parcial: troca pela linha de maior valor absoluto na coluna.
    let maior = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(a[k][i]) > Math.abs(a[maior][i])) maior = k;
    }
    if (Math.abs(a[maior][i]) < 1e-10) return null; // sistema degenerado
    [a[i], a[maior]] = [a[maior], a[i]];

    for (let k = i + 1; k < n; k++) {
      const f = a[k][i] / a[i][i];
      for (let j = i; j <= n; j++) a[k][j] -= f * a[i][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let soma = a[i][n];
    for (let j = i + 1; j < n; j++) soma -= a[i][j] * x[j];
    x[i] = soma / a[i][i];
  }
  return x;
}

/**
 * Matriz que leva os pontos `de` nos pontos `para`.
 *
 * São 8 incógnitas (a matriz 3×3 com o último termo fixado em 1) e cada par
 * de pontos dá duas equações — quatro pares fecham a conta.
 *
 * Devolve os 8 coeficientes, ou null quando os pontos não formam um
 * quadrilátero válido (três deles alinhados, por exemplo).
 */
export function homografia(de: Quadrilatero, para: Quadrilatero): number[] | null {
  const m: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = de[i];
    const { x: u, y: v } = para[i];
    m.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    m.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  return resolverSistema(m, 8);
}

/** Aplica os coeficientes a um ponto. */
export function aplicar(h: number[], p: Ponto): Ponto {
  const d = h[6] * p.x + h[7] * p.y + 1;
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / d,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / d,
  };
}

const dist = (a: Ponto, b: Ponto) => Math.hypot(a.x - b.x, a.y - b.y);

/** Área do quadrilátero pela fórmula do laço (shoelace). */
export function area(q: Quadrilatero): number {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

/**
 * O quadrilátero serve para endireitar?
 *
 * Descobri no teste que três pontos alinhados NÃO fazem a resolução do
 * sistema falhar — ela devolve coeficientes, e o resultado é uma imagem
 * embaralhada em vez de um erro. Confiar no pivô quase-zero não bastava.
 *
 * A área resolve com honestidade: um quadrilátero achatado tem área perto
 * de zero comparada à do retângulo que o envolve. Abaixo de 10% é figura
 * degenerada — arrastar um canto por cima do outro, por exemplo.
 */
export function quadrilateroUtil(q: Quadrilatero): boolean {
  const xs = q.map((p) => p.x), ys = q.map((p) => p.y);
  const caixa = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
  if (caixa < 100) return false;
  return area(q) / caixa >= 0.1;
}

/**
 * Tamanho do retângulo de saída, tirado do próprio quadrilátero.
 *
 * Usa o maior de cada par de lados opostos: encolher para o menor jogaria
 * fora parte do conteúdo que está na borda mais distante da câmera.
 */
export function tamanhoDestino(q: Quadrilatero) {
  const largura = Math.max(dist(q[0], q[1]), dist(q[3], q[2]));
  const altura = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
  return { largura: Math.round(largura), altura: Math.round(altura) };
}

/**
 * Ordena quatro pontos soltos em superior-esquerdo, superior-direito,
 * inferior-direito e inferior-esquerdo.
 *
 * Sem isto, arrastar um canto para o lado do outro embaralharia a ordem e a
 * imagem sairia espelhada ou dobrada sobre si mesma.
 */
export function ordenarCantos(pts: Ponto[]): Quadrilatero {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const acima = pts.filter((p) => p.y < cy).sort((a, b) => a.x - b.x);
  const abaixo = pts.filter((p) => p.y >= cy).sort((a, b) => a.x - b.x);
  // Divisão desequilibrada (3 de um lado) significa quadrilátero degenerado;
  // cair no ângulo em torno do centro ainda dá uma ordem coerente.
  if (acima.length !== 2 || abaixo.length !== 2) {
    const porAngulo = [...pts].sort(
      (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
    );
    return porAngulo as Quadrilatero;
  }
  return [acima[0], acima[1], abaixo[1], abaixo[0]];
}

/**
 * Endireita o quadrilátero `cantos` da imagem de origem num retângulo.
 *
 * Percorre o destino e, para cada pixel, pergunta de onde ele vem na origem
 * (por isso a matriz vai do destino para a origem). Amostragem bilinear:
 * pegar o pixel mais próximo deixaria o texto serrilhado, e texto serrilhado
 * é justamente o que atrapalha quem vai ler o documento depois.
 */
export function corrigirPerspectiva(
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
