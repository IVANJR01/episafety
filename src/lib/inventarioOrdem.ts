/**
 * A ordem e a numeração dos itens do inventário de riscos.
 *
 * O inventário não tinha número de item: para falar de uma linha era preciso
 * descrevê-la ("aquele risco ergonômico do PCP"), e o plano de ação não tinha
 * como apontar para ela. É a numeração que o cliente pediu, no mesmo formato
 * do código do GES — 01, 02, 03.
 *
 * Ordem e numeração ficam juntas de propósito. O número é a POSIÇÃO na ordem:
 * se a tela ordenar de um jeito e o Excel de outro, o item 03 da tela seria
 * outro item no arquivo — e um documento legal apontando para o número errado
 * é pior do que um sem número nenhum.
 */

export interface ItemOrdenavel {
  id: string;
  setor?: string | null;
  descricao_ambiente?: string | null;
  grupo?: string | null;
  perigo_descricao?: string | null;
  ghe?: { codigo?: string | null; descricao_ambiente?: string | null; ambiente?: string | null } | null;
  ghe_id?: string | null;
}

const texto = (v?: string | null) => (v ?? "").toString().trim();

/** O ambiente da linha, com as mesmas reservas que a tela usa para exibir. */
export function ambienteDoItem(i?: ItemOrdenavel | null): string {
  if (!i) return "";
  return texto(i.descricao_ambiente)
    || texto(i.ghe?.descricao_ambiente)
    || texto(i.ghe?.ambiente)
    || "";
}

/**
 * Setor → ambiente → GES → grupo → perigo.
 *
 * A ordem espelha o aninhamento das células mescladas da tabela, e mesclar só
 * funciona em linhas vizinhas. Ordenar por GES primeiro espalhava os grupos de
 * um mesmo setor assim que existisse mais de um setor.
 */
export function compararItens(a: ItemOrdenavel, b: ItemOrdenavel): number {
  const sa = texto(a.setor); const sb = texto(b.setor);
  if (sa !== sb) return sa.localeCompare(sb);
  const aa = ambienteDoItem(a); const ab = ambienteDoItem(b);
  if (aa !== ab) return aa.localeCompare(ab);
  const ga = texto(a.ghe?.codigo); const gb = texto(b.ghe?.codigo);
  if (ga !== gb) return ga.localeCompare(gb);
  const gra = texto(a.grupo); const grb = texto(b.grupo);
  if (gra !== grb) return gra.localeCompare(grb);
  const pa = texto(a.perigo_descricao); const pb = texto(b.perigo_descricao);
  if (pa !== pb) return pa.localeCompare(pb);
  // Desempate final pelo id: sem ele, dois itens idênticos podem trocar de
  // lugar entre uma renderização e outra — e trocariam de número junto.
  return texto(a.id).localeCompare(texto(b.id));
}

export function ordenarInventario<T extends ItemOrdenavel>(itens: T[]): T[] {
  return [...(itens || [])].sort(compararItens);
}

/**
 * O número de cada item, no formato 01, 02, 03.
 *
 * Numera a lista INTEIRA, não a filtrada: o número serve para apontar um item
 * de fora ("o item 07 do inventário"), e renumerar conforme a busca faria o
 * mesmo item mudar de número enquanto se digita.
 *
 * Passa de 99 sem quebrar — vira "100", com três dígitos, em vez de estourar
 * a largura ou reiniciar.
 */
export function numerarInventario(itens: ItemOrdenavel[]): Map<string, string> {
  const mapa = new Map<string, string>();
  ordenarInventario(itens || []).forEach((item, indice) => {
    if (item?.id) mapa.set(item.id, String(indice + 1).padStart(2, "0"));
  });
  return mapa;
}
