/**
 * Deixa a assinatura sempre "deitada" (na horizontal), recortada no traço.
 *
 * O caso que motivou: o trabalhador assinou com o celular em pé. A área de
 * assinatura ficou alta (720 x 1193 px) e ele escreveu ao longo do lado
 * comprido, de lado. Na ficha, a caixa da assinatura é larga e baixa, e a
 * imagem era espremida para caber nela — saía achatada e de lado.
 *
 * Três regras, em pixels RGBA puros (dá para testar sem navegador):
 *  1. recorta a imagem na tinta, com uma folga — o branco em volta só
 *     diminuía a assinatura dentro da caixa;
 *  2. se a área era EM PÉ e a tinta ficou bem mais alta que larga, a pessoa
 *     escreveu de lado: gira 90° no sentido horário. É o giro que desfaz o
 *     jeito mais comum de virar o celular para escrever deitado (topo para
 *     a esquerda). Assinatura escrita normal num celular em pé fica larga,
 *     então não é girada;
 *  3. na ficha, a imagem entra na caixa sem distorcer (ver `encaixar`).
 */

export interface Caixa { x: number; y: number; w: number; h: number }

/** Pixel mais escuro que isto (0 a 255) conta como tinta. */
export const LIMIAR_DA_TINTA = 200;
/** Tinta tantas vezes mais alta que larga = escrita de lado. */
export const PROPORCAO_DE_LADO = 1.4;

/** Retângulo que contém toda a tinta, ou null se a imagem está em branco. */
export function caixaDaTinta(px: Uint8ClampedArray, w: number, h: number): Caixa | null {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (px[i + 3] < 128) continue; // transparente não é tinta
      const luz = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      if (luz < LIMIAR_DA_TINTA) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** A pessoa escreveu ao longo do lado comprido de uma área em pé? */
export function escritaDeLado(larguraArea: number, alturaArea: number, tinta: Caixa): boolean {
  return alturaArea > larguraArea && tinta.h > tinta.w * PROPORCAO_DE_LADO;
}

/** Recorta a caixa (com folga, sem sair da imagem). */
export function recortar(px: Uint8ClampedArray, w: number, h: number, c: Caixa, folga: number) {
  const x0 = Math.max(0, c.x - folga), y0 = Math.max(0, c.y - folga);
  const x1 = Math.min(w, c.x + c.w + folga), y1 = Math.min(h, c.y + c.h + folga);
  const nw = x1 - x0, nh = y1 - y0;
  const out = new Uint8ClampedArray(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    out.set(px.subarray(((y + y0) * w + x0) * 4, ((y + y0) * w + x1) * 4), y * nw * 4);
  }
  return { px: out, w: nw, h: nh };
}

/** Gira 90° no sentido horário: o que estava à esquerda vai para cima. */
export function girarHorario(px: Uint8ClampedArray, w: number, h: number) {
  const out = new Uint8ClampedArray(px.length);
  // Pixel (x, y) vai para (h - 1 - y, x) numa imagem h de largura e w de altura.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const de = (y * w + x) * 4;
      const para = (x * h + (h - 1 - y)) * 4;
      out[para] = px[de]; out[para + 1] = px[de + 1]; out[para + 2] = px[de + 2]; out[para + 3] = px[de + 3];
    }
  }
  return { px: out, w: h, h: w };
}

/** Assinatura pronta: recortada e, se foi escrita de lado, deitada. */
export function deitarAssinatura(px: Uint8ClampedArray, w: number, h: number) {
  const tinta = caixaDaTinta(px, w, h);
  if (!tinta) return { px, w, h, girou: false };
  const folga = Math.round(Math.max(tinta.w, tinta.h) * 0.06) + 2;
  const r = recortar(px, w, h, tinta, folga);
  if (!escritaDeLado(w, h, tinta)) return { ...r, girou: false };
  return { ...girarHorario(r.px, r.w, r.h), girou: true };
}

/** Tamanho e posição da imagem dentro da caixa, sem distorcer e centralizada. */
export function encaixar(larguraImg: number, alturaImg: number, larguraCaixa: number, alturaCaixa: number) {
  const k = Math.min(larguraCaixa / larguraImg, alturaCaixa / alturaImg);
  const w = larguraImg * k, h = alturaImg * k;
  return { w, h, dx: (larguraCaixa - w) / 2, dy: (alturaCaixa - h) / 2 };
}

/**
 * No navegador: recebe a imagem da assinatura (data URL) e devolve outra,
 * deitada e recortada. Em qualquer falha devolve a original — a ficha não
 * pode deixar de sair por causa disto.
 */
export async function assinaturaDeitadaDataUrl(dataUrl: string): Promise<string> {
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = erro;
      i.src = dataUrl;
    });
    return canvasDeitado(img, img.naturalWidth, img.naturalHeight)?.toDataURL("image/jpeg", 0.85) ?? dataUrl;
  } catch {
    return dataUrl;
  }
}

/** Mesma coisa, direto de um canvas ou imagem já carregada. */
export function canvasDeitado(fonte: CanvasImageSource, w: number, h: number): HTMLCanvasElement | null {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(fonte, 0, 0, w, h);
  const r = deitarAssinatura(ctx.getImageData(0, 0, w, h).data, w, h);
  const saida = document.createElement("canvas");
  saida.width = r.w;
  saida.height = r.h;
  const sctx = saida.getContext("2d");
  if (!sctx) return null;
  sctx.putImageData(new ImageData(r.px, r.w, r.h), 0, 0);
  return saida;
}
