/*
 * Regra de reatar a câmera à prévia do scanner de documentos.
 *
 * O <video> do ScannerDocumento vive dentro do ramo "não estou ajustando"
 * do JSX. Entrar no passo de marcar os cantos desmonta o elemento; sair de
 * lá monta um elemento novo, sem `srcObject`. Como o stream continua ligado
 * e o estado da câmera continua valendo, nada denunciava o problema: a
 * prévia ficava preta e o botão Capturar seguia habilitado, pronto para
 * gravar um quadro em branco.
 *
 * Fora do componente para poder ser testado sem câmera e sem DOM.
 */

export interface VideoComFonte {
  srcObject: unknown;
}

/**
 * Diz se o elemento de vídeo voltou à tela sem a fonte que ainda está no ar.
 *
 * Reatribuir um `srcObject` que já é o mesmo reinicia a reprodução à toa, e
 * durante o ajuste não há elemento nenhum para reatar.
 */
export function precisaReatarStream(
  video: VideoComFonte | null | undefined,
  stream: unknown,
  ajustando: boolean,
): boolean {
  if (ajustando) return false;
  if (!video || !stream) return false;
  return video.srcObject !== stream;
}

/**
 * Se dá para capturar um quadro agora.
 *
 * `previaPronta` não é o mesmo que "câmera ligada": entre atribuir o stream
 * e o navegador ler os metadados do vídeo existe uma janela em que o
 * elemento ainda mede 0x0. Capturar ali devolvia uma imagem vazia, e o
 * código preferia não fazer nada — sem aviso nenhum, de modo que o botão
 * parecia quebrado.
 */
export function podeCapturar(
  cameraLigada: boolean,
  previaPronta: boolean,
  ocupado: boolean,
): boolean {
  return cameraLigada && previaPronta && !ocupado;
}

/** Se o elemento de vídeo já tem dimensão, isto é, um quadro para copiar. */
export function temQuadro(video: { videoWidth?: number; videoHeight?: number } | null | undefined): boolean {
  return !!video && !!video.videoWidth && !!video.videoHeight;
}
