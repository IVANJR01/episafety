/**
 * Junta o que foi lido de vários arquivos num PGR só.
 *
 * Um PGR real quase nunca cabe num arquivo. O Word traz a identificação
 * da empresa, o responsável técnico, as unidades e a lista de GES; a
 * planilha traz o inventário de riscos e o plano de ação. A tela de
 * importação obrigava a escolher UM caminho por vez — PDF/Word, ou
 * planilha, ou texto colado — e cada escolha jogava fora o que a
 * anterior tinha lido.
 *
 * Então importar um PGR completo era importar duas vezes e perder metade
 * no caminho. Daí a frase do técnico: "não deixei isso unificado".
 *
 * Aqui não há banco, nem IA, nem React: entram duas leituras, sai uma.
 */

export interface ExtracaoDePgr {
  documento?: Record<string, unknown> | null;
  unidades?: unknown[] | null;
  setores?: { nome: string; [k: string]: unknown }[] | null;
  ghes?: { codigo?: string; nome?: string; [k: string]: unknown }[] | null;
  inventario?: Record<string, unknown>[] | null;
  [k: string]: unknown;
}

/** Texto vazio, espaço em branco ou traço não contam como preenchido. */
function temConteudo(valor: unknown): boolean {
  if (valor == null) return false;
  if (typeof valor === "string") {
    const limpo = valor.trim();
    return limpo !== "" && limpo !== "-" && limpo !== "—";
  }
  if (Array.isArray(valor)) return valor.length > 0;
  return true;
}

/**
 * Campo a campo, o que já estava ganha de campo vazio do novo.
 *
 * O primeiro arquivo costuma ser o documento principal, e o segundo
 * complementa. Deixar o segundo sobrescrever com vazio apagaria o nome
 * do responsável técnico que o Word trouxe.
 */
function mesclarObjeto(
  atual: Record<string, unknown> | null | undefined,
  novo: Record<string, unknown> | null | undefined,
): Record<string, unknown> | undefined {
  if (!atual && !novo) return undefined;
  const saida: Record<string, unknown> = { ...(atual || {}) };
  for (const [chave, valor] of Object.entries(novo || {})) {
    if (!temConteudo(saida[chave]) && temConteudo(valor)) saida[chave] = valor;
  }
  return saida;
}

function normalizar(texto: unknown): string {
  return String(texto ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Une duas listas sem repetir, usando a chave para saber o que é igual. */
function unirListas<T>(
  atual: T[] | null | undefined,
  novo: T[] | null | undefined,
  chaveDe: (item: T) => string,
): T[] {
  const saida: T[] = [];
  const vistos = new Set<string>();

  for (const item of [...(atual || []), ...(novo || [])]) {
    const k = chaveDe(item);
    /* Sem chave reconhecível, o item entra: perder risco é pior que repetir. */
    if (k && vistos.has(k)) continue;
    if (k) vistos.add(k);
    saida.push(item);
  }

  return saida;
}

/**
 * A chave de um risco do inventário.
 *
 * Dois arquivos podem trazer o mesmo perigo — a planilha e o Word, por
 * exemplo. O que identifica um risco é o conjunto GES + setor + perigo:
 * o mesmo ruído em dois setores são dois riscos, e precisam dos dois.
 */
function chaveDoRisco(item: Record<string, unknown>): string {
  const partes = [
    normalizar(item.ges_codigo),
    normalizar(item.setor),
    normalizar(item.perigo_descricao),
  ];
  /*
   * Risco sem nenhum dos três não tem chave — e sem chave ele é sempre
   * mantido. "||" seria uma chave válida e faria todos os riscos vazios
   * colapsarem num só.
   */
  if (partes.every((p) => p === "")) return "";
  return partes.join("|");
}

export function mesclarExtracoes(
  atual: ExtracaoDePgr | null | undefined,
  novo: ExtracaoDePgr | null | undefined,
): ExtracaoDePgr {
  if (!atual) return novo || {};
  if (!novo) return atual;

  return {
    ...atual,
    ...novo,
    documento: mesclarObjeto(
      atual.documento as Record<string, unknown>,
      novo.documento as Record<string, unknown>,
    ),
    unidades: unirListas(
      atual.unidades as Record<string, unknown>[],
      novo.unidades as Record<string, unknown>[],
      (u) => normalizar(u?.nome ?? u?.cnpj),
    ),
    setores: unirListas(atual.setores, novo.setores, (s) => normalizar(s?.nome)),
    ghes: unirListas(atual.ghes, novo.ghes, (g) => normalizar(g?.codigo || g?.nome)),
    inventario: unirListas(atual.inventario, novo.inventario, chaveDoRisco),
  };
}

/** O resumo do que a junção produziu, para a tela mostrar. */
export function resumoDaExtracao(dados: ExtracaoDePgr | null | undefined): {
  setores: number;
  ges: number;
  riscos: number;
  unidades: number;
} {
  return {
    setores: dados?.setores?.length || 0,
    ges: dados?.ghes?.length || 0,
    riscos: dados?.inventario?.length || 0,
    unidades: dados?.unidades?.length || 0,
  };
}
