/**
 * Acompanha a folha entre um quadro e outro da câmera.
 *
 * O detector olha cada quadro sozinho. Na mão de quem segura o celular, o
 * contorno verde pulava alguns pixels a cada quadro, piscava quando um
 * quadro saía tremido e aparecia por um instante quando um papel qualquer
 * passava pela frente. Aqui ficam três regras simples:
 *
 *  - só mostra a folha depois de vê-la em 2 quadros seguidos no mesmo lugar;
 *  - enquanto ela fica no lugar, os cantos andam metade do caminho até a
 *    nova posição (o contorno desliza em vez de tremer);
 *  - um ou dois quadros sem achar não apagam o contorno — só o terceiro.
 *
 * E a captura automática: a folha parada (cantos andando menos de 1,5%)
 * por QUADROS_PARADOS quadros seguidos pode ser fotografada sozinha.
 * Parada também quer dizer foto sem tremor.
 */
export interface Ponto { x: number; y: number }

export interface EstadoDaFolha {
  cantos: Ponto[] | null;
  /** Quadros seguidos em que a folha apareceu no mesmo lugar. */
  vistos: number;
  /** Quadros seguidos sem folha. */
  falhas: number;
  /** Quadros seguidos com a folha praticamente parada. */
  parados: number;
}

export const SEM_FOLHA: EstadoDaFolha = { cantos: null, vistos: 0, falhas: 0, parados: 0 };

/** Fração do lado maior do quadro que um canto pode andar e ainda ser "a mesma folha". */
export const MESMO_LUGAR = 0.05;
export const QUADROS_PARA_MOSTRAR = 2;
export const FALHAS_TOLERADAS = 2;
/** Quanto um canto pode andar, entre dois quadros, para a folha contar como parada. */
export const PARADA = 0.015;
/** Quadros parados para fotografar sozinho: 4 x 200 ms, menos de 1 segundo. */
export const QUADROS_PARADOS = 4;

function maiorDeslocamento(a: Ponto[], b: Ponto[]): number {
  return Math.max(...a.map((p, i) => Math.hypot(p.x - b[i].x, p.y - b[i].y)));
}


export function acompanharFolha(
  estado: EstadoDaFolha,
  achados: Ponto[] | null,
  ladoMaior: number,
): { estado: EstadoDaFolha; mostrar: Ponto[] | null } {
  let novo: EstadoDaFolha;
  if (!achados) {
    const falhas = estado.falhas + 1;
    novo = falhas > FALHAS_TOLERADAS ? SEM_FOLHA : { ...estado, falhas, parados: 0 };
  } else if (estado.cantos && maiorDeslocamento(estado.cantos, achados) <= MESMO_LUGAR * ladoMaior) {
    const parada = maiorDeslocamento(estado.cantos, achados) <= PARADA * ladoMaior;
    novo = {
      cantos: estado.cantos.map((p, i) => ({ x: (p.x + achados[i].x) / 2, y: (p.y + achados[i].y) / 2 })),
      vistos: estado.vistos + 1,
      falhas: 0,
      parados: parada ? estado.parados + 1 : 0,
    };
  } else {
    novo = { cantos: achados, vistos: 1, falhas: 0, parados: 0 };
  }
  return { estado: novo, mostrar: novo.vistos >= QUADROS_PARA_MOSTRAR ? novo.cantos : null };
}

/** De 0 a 1: quanto falta para a captura automática (o anel que enche na tela). */
export function progressoDaCaptura(estado: EstadoDaFolha): number {
  return Math.min(1, estado.parados / QUADROS_PARADOS);
}

/**
 * Captura automática com trava: depois de fotografar, só fotografa de novo
 * quando a folha sair da frente da câmera ou mudar de lugar — senão, no
 * modo Lote, a mesma página seria fotografada várias vezes seguidas.
 */
export interface Gatilho { armado: boolean }

export function decidirCaptura(
  gatilho: Gatilho,
  estado: EstadoDaFolha,
  mostrar: Ponto[] | null,
): { gatilho: Gatilho; fotografar: boolean } {
  if (!gatilho.armado) {
    /*
     * Folha posta em outro lugar também conta: o acompanhamento recomeça e
     * esconde o contorno por um quadro, o que já rearma o gatilho.
     */
    return { gatilho: { armado: !mostrar }, fotografar: false };
  }
  if (mostrar && estado.parados >= QUADROS_PARADOS) return { gatilho: { armado: false }, fotografar: true };
  return { gatilho, fotografar: false };
}

/**
 * Lado maior do vídeo a partir do qual o quadro do vídeo já serve de foto.
 * Com vídeo 4K a folha sai com uns 250 DPI e a foto é instantânea; pedir a
 * foto à câmera (takePhoto) leva de 1 a 3 segundos em muitos Android.
 * Abaixo disso, o vídeo é fraco demais e vale a espera.
 */
export const VIDEO_QUE_BASTA = 3000;

export function videoBastaComoFoto(larguraVideo: number, alturaVideo: number): boolean {
  return Math.max(larguraVideo, alturaVideo) >= VIDEO_QUE_BASTA;
}
