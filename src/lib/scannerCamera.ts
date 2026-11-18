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

/**
 * Onde a foto fica dentro da área de ajuste: o maior retângulo com o
 * formato dela que cabe na área, centrado.
 *
 * A tela de ajuste mostrava a foto com `object-contain` — encaixada, com
 * faixas pretas — mas calculava os cantos, o arraste e a lupa sobre a
 * área INTEIRA, faixas incluídas. O canto que o técnico via na borda da
 * folha correspondia a outro ponto da foto, mais para dentro, e a página
 * saía cortada. Com o quadro do vídeo, que tinha o formato da tela, as
 * faixas eram finas e o erro passava quase despercebido; com a foto de
 * verdade (4:3), ficaram largas e o corte apareceu.
 */
export function encaixarNaArea(areaL: number, areaA: number, imgL: number, imgA: number) {
  if (areaL <= 0 || areaA <= 0 || imgL <= 0 || imgA <= 0) return { largura: 0, altura: 0, esquerda: 0, topo: 0 };
  const escala = Math.min(areaL / imgL, areaA / imgA);
  const largura = imgL * escala, altura = imgA * escala;
  return { largura, altura, esquerda: (areaL - largura) / 2, topo: (areaA - altura) / 2 };
}

/**
 * Converte um ponto do vídeo da câmera para a posição na tela.
 *
 * A prévia usa `object-cover`: o vídeo é ampliado até cobrir a área e o
 * que sobra é cortado nas bordas. O contorno da folha, achado nos pixels
 * do vídeo, precisa da mesma ampliação e do mesmo deslocamento para cair
 * em cima da folha que aparece na tela.
 */
export function videoParaTela(
  p: { x: number; y: number },
  videoL: number, videoA: number, telaL: number, telaA: number,
) {
  if (videoL <= 0 || videoA <= 0) return { x: 0, y: 0 };
  const escala = Math.max(telaL / videoL, telaA / videoA);
  return {
    x: p.x * escala + (telaL - videoL * escala) / 2,
    y: p.y * escala + (telaA - videoA * escala) / 2,
  };
}
