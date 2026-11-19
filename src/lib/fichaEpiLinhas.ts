/**
 * Quais linhas a Ficha de EPI imprime, e a data de devolução de cada uma.
 *
 * A devolução fica gravada no banco como um registro à parte (tipo
 * "devolucao"), para a trilha de auditoria e o estoque. Na ficha, porém,
 * ela saía como uma linha nova — "Motivo: Devolução", assinatura em branco —
 * logo abaixo da entrega original, que já mostrava a mesma data na coluna
 * Devolução. Para o fiscal, a ficha parecia ter entregas sem assinatura.
 *
 * O modelo de ficha da NR-6 não tem linha de devolução: a devolução é a
 * coluna "Devolução" da linha da entrega. Então:
 *  - a entrega devolvida/substituída recebe a data do registro que a
 *    encerrou (o primeiro posterior a ela, do mesmo EPI);
 *  - o registro de devolução que encontrou a sua entrega sai da ficha;
 *  - a substituição continua: ela é uma entrega nova e tem assinatura;
 *  - devolução sem entrega correspondente (entrega apagada) continua
 *    aparecendo — sumir com ela esconderia um movimento de verdade.
 */
export interface MovimentoDaFicha {
  id: string;
  epi_id: string;
  data: string;
  created_at: string;
  tipo: string;
  status: string;
}

const ENCERRADA = new Set(["devolvido", "substituido"]);
const ENCERRA = new Set(["devolucao", "substituicao"]);

export function linhasDaFicha<T extends MovimentoDaFicha>(
  movimentos: T[],
  caDoEpi: (epiId: string) => string | null | undefined,
): (T & { data_devolucao: string | null })[] {
  const mesmoEpi = (a: T, b: T) => {
    if (a.epi_id === b.epi_id) return true;
    const ca = caDoEpi(a.epi_id);
    return !!ca && ca === caDoEpi(b.epi_id);
  };
  const porCriacao = [...movimentos].sort((a, b) => a.created_at.localeCompare(b.created_at));
  /* Cada registro de devolução/substituição encerra uma entrega só. */
  const usados = new Set<string>();
  const dataDevolucao = new Map<string, string>();
  for (const e of porCriacao) {
    if (!ENCERRADA.has(e.status) || e.tipo === "devolucao") continue;
    const fim = porCriacao.find((o) =>
      o.id !== e.id && !usados.has(o.id) && ENCERRA.has(o.tipo) &&
      o.created_at > e.created_at && mesmoEpi(e, o));
    if (fim) usados.add(fim.id);
    dataDevolucao.set(e.id, fim?.data ?? e.data);
  }
  return movimentos
    .filter((m) => !(m.tipo === "devolucao" && usados.has(m.id)))
    .map((m) => ({ ...m, data_devolucao: dataDevolucao.get(m.id) ?? null }));
}
