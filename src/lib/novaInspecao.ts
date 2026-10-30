/**
 * Com que dados uma nova inspeção abre.
 *
 * O formulário abria com a data do ÚLTIMO lançamento, não com a de hoje.
 * A ideia era continuar o contexto do registro anterior — e para a obra e
 * o local isso ajuda, porque uma visita rende vários apontamentos no
 * mesmo lugar. Para a data, não: quem inspeciona hoje via 09/04/2026 no
 * campo e, se não reparasse, gravava a inspeção de hoje com a data de
 * meses atrás.
 *
 * Num documento que serve de prova de fiscalização, data errada é o pior
 * tipo de erro: ninguém confere o que já vem preenchido.
 *
 * Havia um segundo caminho para o mesmo erro: a data inicial do
 * formulário era calculada UMA vez, quando o arquivo carregava. O sistema
 * é um app instalado que fica dias aberto no celular em campo — na
 * segunda-feira ele ainda oferecia a sexta-feira.
 */

export interface ContextoAnterior {
  obra_id?: string | null;
  local?: string | null;
}

/** Hoje, no fuso de quem está usando, no formato do campo de data. */
export function hojeISO(agora: Date = new Date()): string {
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/**
 * O que o registro anterior empresta para o próximo.
 *
 * Obra e local, sim: uma visita rende vários apontamentos no mesmo
 * lugar. Data, nunca.
 */
export function heranca(anterior: ContextoAnterior | null | undefined): {
  obra_id: string; local: string;
} | null {
  if (!anterior) return null;
  const obra_id = (anterior.obra_id || "").trim();
  const local = (anterior.local || "").trim();
  if (!obra_id && !local) return null;
  return { obra_id, local };
}

/**
 * Os valores com que o formulário de nova inspeção abre.
 *
 * @param base      o formulário vazio do módulo.
 * @param anterior  o último registro lançado, ou null.
 * @param agora     injetável para teste.
 */
export function formularioDeNovaInspecao<T extends { data_inspecao: string }>(
  base: T,
  anterior?: ContextoAnterior | null,
  agora: Date = new Date(),
): T {
  const herdado = heranca(anterior);
  return { ...base, ...(herdado || {}), data_inspecao: hojeISO(agora) };
}
