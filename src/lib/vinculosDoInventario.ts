/**
 * A qual estrutura cada item do inventário se liga.
 *
 * A tabela do inventário tem DUAS colunas de GES, e elas apontam para
 * tabelas diferentes:
 *
 *   ghe_id  -> ghe_ges    (o GES do módulo de PGR)
 *   ges_id  -> sst_ges    (o GES da Estrutura Ocupacional)
 *
 * A importação criava o grupo em `ghe_ges` e gravava o MESMO id nas
 * duas colunas. O banco recusava o inventário inteiro:
 *
 *   violates foreign key constraint "pgr_inventario_itens_ges_id_fkey"
 *
 * — e o PGR ficava criado, sem um risco sequer. O id existe; existe na
 * tabela errada.
 *
 * Aqui cada coluna recebe o id da sua própria tabela, e fica nula quando
 * não há correspondente. Null é verdade: o grupo pode existir só no
 * módulo de PGR e ainda não ter sido cadastrado na Estrutura
 * Ocupacional.
 */

/** Chave de comparação de código ou nome de GES: "1.0" e "01" são o mesmo. */
export function chaveDoGes(valor: unknown): string {
  const s = String(valor ?? "").trim().toLowerCase();
  if (!s) return "";
  const numero = Number(s.replace(",", "."));
  if (Number.isFinite(numero) && Number.isInteger(numero)) return String(numero);
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface GesCadastrado {
  id: string;
  codigo?: string | null;
  nome?: string | null;
}

/** Índice de busca por código e por nome. */
export function indiceDeGes(lista: GesCadastrado[]): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const g of lista || []) {
    if (!g?.id) continue;
    const porCodigo = chaveDoGes(g.codigo);
    const porNome = chaveDoGes(g.nome);
    if (porCodigo && !mapa.has(porCodigo)) mapa.set(porCodigo, g.id);
    if (porNome && !mapa.has(porNome)) mapa.set(porNome, g.id);
  }
  return mapa;
}

/**
 * O id de `sst_ges` correspondente, ou null.
 *
 * @param codigo  o código do GES no documento importado.
 * @param nome    o nome/setor, usado quando o código não casa.
 */
export function gesDaEstrutura(
  indice: Map<string, string>, codigo: unknown, nome?: unknown,
): string | null {
  return indice.get(chaveDoGes(codigo))
    || (nome ? indice.get(chaveDoGes(nome)) : undefined)
    || null;
}
