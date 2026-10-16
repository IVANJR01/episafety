/**
 * Nome de cada tipo de exame do ASO, num lugar só.
 *
 * O catálogo tem UM tipo de documento para ASO, e admissional, periódico,
 * demissional e companhia são versões dele. Quem olha a lista precisa ver
 * de que exame é cada arquivo, e esse rótulo aparece em mais de uma tela —
 * na lista do módulo e no histórico do dossiê. Duas cópias dele acabariam
 * divergindo na primeira vez que um nome mudasse.
 */
export const ROTULO_EXAME_ASO: Record<string, string> = {
  admissional: "Admissional",
  periodico: "Periódico",
  retorno: "Retorno ao Trabalho",
  mudanca_risco: "Mudança de Risco",
  demissional: "Demissional",
};

/** Rótulo do exame; devolve o próprio código quando for um valor novo. */
export function rotuloExameAso(tipoExame?: string | null): string | null {
  if (!tipoExame) return null;
  return ROTULO_EXAME_ASO[tipoExame] || tipoExame;
}

/** Uma versão de documento, do ponto de vista do rótulo. */
export interface VersaoComOrigem {
  origem_tabela?: string | null;
  origem_id?: string | null;
}

/**
 * Ids dos ASOs que originaram estas versões, sem repetição.
 *
 * Só versões que vieram da tabela `asos` entram. Um comprovante de
 * treinamento também carrega `origem_id`, e consultar a tabela de ASO com
 * o id de um treinamento devolve nada — ou, pior, bate com um id de ASO e
 * rotula o documento errado.
 */
export function idsDeAsoNasVersoes(versoes: VersaoComOrigem[]): string[] {
  const ids = new Set<string>();
  for (const v of versoes || []) {
    if (v?.origem_tabela === "asos" && v.origem_id) ids.add(v.origem_id);
  }
  return Array.from(ids);
}

/** Mapa id do ASO -> rótulo do exame. */
export function rotulosDosAsos(
  asos: { id: string; tipo_exame?: string | null }[],
): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const a of asos || []) {
    const r = rotuloExameAso(a?.tipo_exame);
    if (a?.id && r) mapa.set(a.id, r);
  }
  return mapa;
}
