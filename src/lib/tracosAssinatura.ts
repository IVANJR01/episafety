/**
 * Traços de assinatura que sobrevivem a girar o aparelho.
 *
 * O DEFEITO que este módulo corrige, visto em vídeo: a assinatura não sumia,
 * mas MINGUAVA a cada giro, até virar um borrão do tamanho de uma unha — e era
 * esse borrão que ia para o documento assinado.
 *
 * A conta antiga encaixava a CAIXA DO CANVAS antigo dentro da nova:
 *
 *     escala = min(larguraNova / larguraAntiga, alturaNova / alturaAntiga)
 *
 * Girando 390x700 para 700x390 isso dá min(1,79 · 0,557) = 0,557 — encolhe 44%.
 * Girando de volta dá 0,557 outra vez, porque as dimensões só trocam de lugar:
 * encolhia nos DOIS sentidos. Pior, o resultado era gravado por cima do
 * original, então cada giro partia do tamanho já reduzido — 0,557 elevado ao
 * número de giros. Medido: 100% · 55,7% · 31% · 17,3% · 9,6%.
 *
 * A correção tem duas partes, e as duas importam:
 *
 * 1. A assinatura guarda o TAMANHO EM PIXELS que foi desenhada. Girar não
 *    reescala nada: se o traço cabe na nova área, ele fica igualzinho. Só
 *    encolhe quando de fato não cabe — e aí encolhe o mínimo, com o mesmo
 *    fator nos dois eixos, para não deformar.
 *
 * 2. Os traços são guardados uma única vez, e todo desenho parte deles. Nada é
 *    gravado por cima do original, então nenhum erro se acumula por mais que se
 *    gire. Encolher para caber numa tela baixa e voltar recupera o traço
 *    inteiro.
 *
 * O sistema guardado é "pixels a partir do centro do canvas". O centro, e não
 * o canto, porque é o centro que continua sendo o centro depois do giro — com
 * origem no canto, a assinatura escorregaria para um lado a cada rotação.
 */

export interface PontoTraco { x: number; y: number; [chave: string]: unknown }
export interface Traco { points?: PontoTraco[]; [chave: string]: unknown }

const valido = (largura: number, altura: number) =>
  Number.isFinite(largura) && Number.isFinite(altura) && largura > 0 && altura > 0;

const mapear = (dados: Traco[], f: (p: PontoTraco) => PontoTraco): Traco[] =>
  dados.map((grupo) => ({
    ...grupo,
    points: Array.isArray(grupo?.points) ? grupo.points.map(f) : grupo?.points,
  }));

/** De pixels do canvas para pixels a partir do centro. */
export function paraNormalizado(dados: Traco[], largura: number, altura: number): Traco[] {
  if (!Array.isArray(dados) || !valido(largura, altura)) return Array.isArray(dados) ? dados : [];
  return mapear(dados, (p) => ({
    ...p,
    x: typeof p?.x === "number" ? p.x - largura / 2 : p?.x,
    y: typeof p?.y === "number" ? p.y - altura / 2 : p?.y,
  }));
}

/**
 * Quanto o traço precisa encolher para caber num canvas deste tamanho.
 *
 * 1 quer dizer "cabe inteiro, não mexe". Existe separada para o teste poder
 * verificar a regra sem passar por um canvas de verdade.
 */
export function fatorParaCaber(dados: Traco[], largura: number, altura: number): number {
  if (!Array.isArray(dados) || !valido(largura, altura)) return 1;

  // O quanto o traço se afasta do centro, no ponto em que mais se afasta.
  let extX = 0;
  let extY = 0;
  for (const grupo of dados) {
    if (!Array.isArray(grupo?.points)) continue;
    for (const p of grupo.points) {
      if (typeof p?.x === "number") extX = Math.max(extX, Math.abs(p.x));
      if (typeof p?.y === "number") extY = Math.max(extY, Math.abs(p.y));
    }
  }

  const limites = [1];
  if (extX > 0) limites.push((largura / 2) / extX);
  if (extY > 0) limites.push((altura / 2) / extY);
  return Math.min(...limites);
}

/**
 * De pixels a partir do centro de volta para pixels do canvas.
 *
 * Cortar parte da assinatura seria pior do que encolher: assinatura pela
 * metade não vale como assinatura. Por isso o corte nunca acontece — o que não
 * cabe é reduzido junto, no mesmo fator dos dois eixos.
 */
export function paraCanvas(dados: Traco[], largura: number, altura: number): Traco[] {
  if (!Array.isArray(dados) || !valido(largura, altura)) return Array.isArray(dados) ? dados : [];
  const k = fatorParaCaber(dados, largura, altura);
  return mapear(dados, (p) => ({
    ...p,
    x: typeof p?.x === "number" ? p.x * k + largura / 2 : p?.x,
    y: typeof p?.y === "number" ? p.y * k + altura / 2 : p?.y,
  }));
}
