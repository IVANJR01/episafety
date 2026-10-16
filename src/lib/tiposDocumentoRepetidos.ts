/**
 * Tipo da empresa que repete um tipo do catálogo compartilhado.
 *
 * Buscando "aso" no catálogo apareciam duas linhas com o mesmo nome: o tipo
 * do catálogo compartilhado, permanente, e um tipo criado na empresa com 12
 * meses de validade. São dois documentos diferentes para o sistema, e quem
 * anexa não tem como saber em qual deve anexar — metade do histórico vai
 * para um, metade para o outro, e o painel de vencimentos cobra pelo prazo
 * de um só.
 *
 * Isto não apaga nada: documento já anexado não se remaneja. Só marca o
 * repetido na tela, para quem cadastrou decidir.
 */

export interface TipoParaComparar {
  id: string;
  nome: string;
  empresa_id: string | null;
}

/** Nome sem acento, caixa, pontuação e espaço repetido. */
export function chaveDoTipo(nome: string): string {
  return (nome || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Ids dos tipos DA EMPRESA que repetem o nome de um tipo do catálogo
 * compartilhado. O do catálogo nunca é marcado: ele é o original.
 */
export function tiposRepetidos(tipos: TipoParaComparar[]): Set<string> {
  const doCatalogo = new Set<string>();
  for (const t of tipos) {
    if (!t.empresa_id) doCatalogo.add(chaveDoTipo(t.nome));
  }
  const repetidos = new Set<string>();
  for (const t of tipos) {
    if (t.empresa_id && doCatalogo.has(chaveDoTipo(t.nome))) repetidos.add(t.id);
  }
  return repetidos;
}
