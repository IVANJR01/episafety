import { supabase } from "@/integrations/supabase/client";
import { sugerirExamesCompletosNr07, type ExameCatalogoItem } from "@/lib/pcmsoCatalogoExames";

/**
 * A Matriz de Saúde de um GES — a MESMA que o PCMSO mostra.
 *
 * O Portal de ASO e a Matriz de Saúde do PCMSO liam tabelas diferentes, e
 * as do ASO estavam vazias. Conferido no banco desta empresa:
 *
 *   ghe_riscos ................. 0 linhas  (o ASO lia daqui)
 *   ghe_exames ................. 1 linha   (o ASO lia daqui)
 *   pgr_inventario_itens ....... 30 linhas (a Matriz lê daqui)
 *
 * Resultado na tela: a Matriz do PCMSO mostrava "2 risco(s) PGR" em cada
 * GES e a lista de exames sugeridos, e o Portal de ASO do mesmo
 * colaborador mostrava "N.A." em todos os fatores de risco e o aviso de
 * que o GES não tem risco cadastrado. Os riscos existiam; o ASO é que
 * estava olhando para o lugar errado.
 *
 * Aqui a ordem de procedência é a mesma nos dois lados:
 *
 *   1. o que o médico cadastrou na Matriz (ghe_riscos / ghe_exames);
 *   2. na falta disso, o inventário do PGR e a sugestão da NR-07 — que é
 *      exatamente o que a Matriz mostra marcado como "Sugerido NR-07".
 *
 * Assim o ASO sai com o que o PCMSO prometeu, e é o PGR que manda nos
 * dois.
 */

export interface RiscoDoGes {
  /** fisico | quimico | biologico | ergonomico | acidente | outro */
  grupo: string;
  descricao: string;
}

export interface ExameDoGes {
  nome_exame: string;
  codigo?: string | null;
  tipo?: string | null;
  periodicidade_meses?: number;
}

/** De onde os dados vieram — para a tela poder dizer isso a quem emite. */
export type OrigemMatriz = "matriz" | "pgr" | "vazio";

export interface MatrizDoGes {
  riscos: RiscoDoGes[];
  exames: ExameDoGes[];
  origemRiscos: OrigemMatriz;
  origemExames: OrigemMatriz;
}

/** Coluna de ghe_exames que diz se o exame entra neste tipo de ASO. */
export const TIPO_EXAME_COL: Record<string, string> = {
  admissional: "admissional",
  periodico: "periodico",
  retorno: "retorno_trabalho",
  mudanca_risco: "mudanca_risco",
  mudanca_funcao: "mudanca_funcao",
  demissional: "demissional",
};

/**
 * O grupo do inventário do PGR traduzido para o do ASO.
 *
 * O ASO tem seis colunas de fator de risco; o PGR tem um grupo a mais
 * (psicossocial), que no ASO cabe em "Outros" — deixá-lo de fora faria o
 * risco sumir do documento.
 */
export function grupoDoAso(grupoDoPgr?: string | null): string {
  const g = (grupoDoPgr || "").trim().toLowerCase();
  if (["fisico", "quimico", "biologico", "ergonomico", "acidente"].includes(g)) return g;
  if (g === "físico") return "fisico";
  if (g === "químico") return "quimico";
  if (g === "biológico") return "biologico";
  if (g === "ergonômico") return "ergonomico";
  return "outro";
}

/**
 * Descrição do risco para o ASO, a partir de um item do inventário.
 *
 * É a mesma escolha que a Matriz faz: o agente, e na falta dele o perigo
 * descrito. Item sem nenhum dos dois não vira linha — o ASO é documento
 * legal e não pode carregar um risco sem nome.
 */
export function descricaoDoRisco(item: {
  tipo_agente?: string | null;
  perigo_descricao?: string | null;
}): string {
  return (item?.tipo_agente || "").trim() || (item?.perigo_descricao || "").trim();
}

/** Converte itens do inventário do PGR em riscos do ASO, sem repetir. */
export function riscosDoInventario(itens: any[]): RiscoDoGes[] {
  const vistos = new Set<string>();
  const riscos: RiscoDoGes[] = [];
  for (const it of itens || []) {
    const descricao = descricaoDoRisco(it);
    if (!descricao) continue;
    const grupo = grupoDoAso(it.grupo);
    const chave = `${grupo}|${descricao.toLowerCase()}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    riscos.push({ grupo, descricao });
  }
  return riscos;
}

/** O exame do catálogo entra neste tipo de ASO? */
export function exameEntraNoAso(e: ExameCatalogoItem, tipoExame: string): boolean {
  switch (tipoExame) {
    case "admissional": return e.admissional;
    case "periodico": return e.periodico;
    case "retorno": return e.retornoTrabalho;
    case "demissional": return e.demissional;
    case "mudanca_risco":
    case "mudanca_funcao": return e.mudancaRisco;
    default: return e.periodico;
  }
}

/**
 * Os exames sugeridos pela NR-07 para estes riscos — a mesma sugestão que
 * a Matriz do PCMSO exibe marcada como "Sugerido NR-07".
 */
export function examesSugeridosCompletos(riscos: RiscoDoGes[]): ExameCatalogoItem[] {
  const porCodigo = new Map<string, ExameCatalogoItem>();
  /*
   * Sem risco nenhum ainda há exame: o clínico é obrigatório em todo ASO
   * (NR-07, 7.5.6). A sugestão com texto vazio devolve justamente ele.
   */
  const entradas = riscos.length > 0
    ? riscos.map((r) => ({ grupo: r.grupo, risco: r.descricao }))
    : [{ grupo: "", risco: "" }];

  for (const e of entradas) {
    for (const ex of sugerirExamesCompletosNr07(e.grupo, e.risco, "") || []) {
      if (!porCodigo.has(ex.codigo)) porCodigo.set(ex.codigo, ex);
    }
  }

  return Array.from(porCodigo.values());
}

/** Os sugeridos que entram NESTE tipo de ASO. */
export function examesSugeridos(
  riscos: RiscoDoGes[], tipoExame: string,
): ExameDoGes[] {
  return examesSugeridosCompletos(riscos)
    .filter((ex) => exameEntraNoAso(ex, tipoExame))
    .map((ex) => ({
      nome_exame: ex.nome,
      codigo: ex.codigo,
      tipo: ex.tipo,
      periodicidade_meses: ex.periodicidadeMeses,
    }));
}

/**
 * Carrega a Matriz de Saúde do GES, na mesma ordem de procedência que o
 * PCMSO usa.
 *
 * @param gheId      o GES do colaborador.
 * @param tipoExame  admissional, periodico, retorno, mudanca_risco,
 *                   mudanca_funcao ou demissional.
 */
export async function carregarMatrizDoGes(
  gheId: string, tipoExame: string,
): Promise<MatrizDoGes> {
  const col = TIPO_EXAME_COL[tipoExame] || "periodico";

  const [riscosRes, examesRes] = await Promise.all([
    supabase.from("ghe_riscos")
      .select("grupo, tipo_agente, texto_aso").eq("ghe_id", gheId).eq("aparece_aso", true),
    supabase.from("ghe_exames")
      .select("nome_exame, codigo_exame, tipo_exame, periodicidade_meses, " + col)
      .eq("ghe_id", gheId).eq("aparece_aso", true),
  ]);

  let riscos: RiscoDoGes[] = (riscosRes.data || [])
    .map((r: any) => ({
      grupo: grupoDoAso(r.grupo),
      descricao: (r.texto_aso || r.tipo_agente || "").trim(),
    }))
    .filter((r) => r.descricao);
  let origemRiscos: OrigemMatriz = riscos.length ? "matriz" : "vazio";

  if (riscos.length === 0) {
    /* O inventário do PGR — a fonte que a Matriz do PCMSO mostra. */
    const { data } = await (supabase.from as any)("pgr_inventario_itens")
      .select("grupo, tipo_agente, perigo_descricao, ghe_id")
      .eq("ghe_id", gheId);
    riscos = riscosDoInventario(data || []);
    if (riscos.length) origemRiscos = "pgr";
  }

  let exames: ExameDoGes[] = (examesRes.data || [])
    .filter((e: any) => e[col] === true)
    .map((e: any) => ({
      nome_exame: e.nome_exame, codigo: e.codigo_exame,
      tipo: e.tipo_exame, periodicidade_meses: e.periodicidade_meses,
    }));
  let origemExames: OrigemMatriz = exames.length ? "matriz" : "vazio";

  if (exames.length === 0) {
    exames = examesSugeridos(riscos, tipoExame);
    if (exames.length) origemExames = "pgr";
  }

  return { riscos, exames, origemRiscos, origemExames };
}
