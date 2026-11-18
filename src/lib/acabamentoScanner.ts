/**
 * O acabamento da página escaneada: tirar sombra, branquear o papel,
 * manter a tinta.
 *
 * O tratamento anterior aplicava UMA curva de contraste à página inteira,
 * calculada pelo histograma. Isso funciona com luz uniforme, que é o que
 * quase nunca existe ao fotografar um papel na mesa: a mão faz sombra, a
 * luz da sala vem de um lado, a lâmpada amarela tinge tudo. Com uma curva
 * só, o canto iluminado fica branco e o da sombra fica cinza-sujo — ou,
 * no preto e branco, uma mancha preta por cima do texto.
 *
 * O que os aplicativos de scanner fazem é estimar o FUNDO de cada região
 * — a cor que o papel teria ali, com aquela luz — e dividir a página por
 * ele. Onde há sombra o fundo é escuro, a divisão compensa, e o papel sai
 * igualmente branco nos dois cantos. Feito canal a canal, isso também
 * corrige a luz amarela: o papel vira branco neutro e a caneta azul
 * continua azul.
 *
 * Aqui não há canvas nem React: entram os pixels (RGBA), saem os pixels.
 * É o que deixa testar com imagem sintética, sem navegador.
 */

export type ModoAcabamento = "cor" | "cinza" | "pb";

/** Lado do bloco usado para estimar o fundo, como fração da página. */
const FRACAO_DO_BLOCO = 1 / 40;

/**
 * Quanto o fundo pode escurecer em relação ao papel da página.
 *
 * Sem este piso, uma área grande de tinta (foto do RG, logotipo, carimbo
 * cheio) seria tomada por "fundo escuro" e clareada até sumir. Com ele, a
 * sombra é compensada e a foto continua foto.
 */
const PISO_DO_FUNDO = 0.55;

/**
 * Estima o fundo (a cor do papel) de cada região, canal a canal.
 *
 * Divide a página em blocos, pega o valor mais claro de cada bloco — o
 * papel é sempre mais claro que a tinta por cima dele —, suaviza a grade
 * e devolve uma grade pequena que depois é interpolada por pixel.
 */
function estimarFundo(d: Uint8ClampedArray, largura: number, altura: number) {
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
export function normalizarIluminacao(d: Uint8ClampedArray, largura: number, altura: number): void {
  const { grade, gx, gy, lado } = estimarFundo(d, largura, altura);

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

/**
 * Curva final: empurra o quase-branco para branco e escurece um pouco a
 * tinta, sem achatar os meios-tons (caneta, carimbo, foto).
 */
function curvaDeContraste(): Uint8ClampedArray {
  const t = new Uint8ClampedArray(256);
  const preto = 25, branco = 225;
  for (let v = 0; v < 256; v++) {
    const n = Math.max(0, Math.min(1, (v - preto) / (branco - preto)));
    /* Leve curva em S: meios-tons ficam onde estão, extremos se firmam. */
    const s = n < 0.5 ? 2 * n * n : 1 - 2 * (1 - n) * (1 - n);
    t[v] = Math.round((0.35 * n + 0.65 * s) * 255);
  }
  return t;
}

/**
 * Limite do preto e branco: quão mais escuro que o papel o pixel precisa
 * ser para virar tinta. Depois da normalização o papel vale ~255 em toda
 * a página — então um limite fixo passa a funcionar também dentro da
 * sombra, que é onde o limite global antigo pintava tudo de preto.
 */
const LIMITE_PB = 175;

/** Aplica o acabamento escolhido. Altera `d` no lugar. */
export function acabarPagina(d: Uint8ClampedArray, largura: number, altura: number, modo: ModoAcabamento): void {
  normalizarIluminacao(d, largura, altura);
  const curva = curvaDeContraste();

  for (let i = 0; i < d.length; i += 4) {
    if (modo === "cor") {
      d[i] = curva[d[i]];
      d[i + 1] = curva[d[i + 1]];
      d[i + 2] = curva[d[i + 2]];
    } else {
      const luma = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      const v = modo === "pb" ? (luma > LIMITE_PB ? 255 : 0) : curva[luma | 0];
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    d[i + 3] = 255;
  }
}

/**
 * Lado maior da página final, em pixels.
 *
 * 3508 é a altura de uma folha A4 a 300 DPI — a resolução de um scanner
 * de mesa. Antes era 1600 (~137 DPI): letra miúda de laudo, CPF e número
 * de CA saíam serrilhados.
 */
export const LADO_MAXIMO_PAGINA = 3508;

/** Reduz para caber no lado máximo, sem nunca aumentar. */
export function dimensoesDaPagina(largura: number, altura: number, ladoMaximo = LADO_MAXIMO_PAGINA) {
  const escala = Math.min(1, ladoMaximo / Math.max(largura, altura, 1));
  return { largura: Math.max(1, Math.round(largura * escala)), altura: Math.max(1, Math.round(altura * escala)) };
}
