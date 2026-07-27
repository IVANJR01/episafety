import type { PgrClasse } from "@/lib/pgrMatriz";

export type PgrAcaoStatus =
  | "pendente" | "programada" | "em_andamento" | "bloqueada"
  | "atrasada" | "reprogramada" | "concluida" | "cancelada";

export type PgrMedidaTipo = "eliminacao" | "substituicao" | "engenharia" | "administrativa" | "epi";

export const ACAO_STATUS_LABEL: Record<PgrAcaoStatus, string> = {
  pendente: "Pendente",
  programada: "Programada",
  em_andamento: "Em andamento",
  bloqueada: "Bloqueada",
  atrasada: "Atrasada",
  reprogramada: "Reprogramada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const ACAO_STATUS_COLOR: Record<PgrAcaoStatus, string> = {
  pendente: "bg-slate-100 text-slate-700 border-slate-300",
  programada: "bg-indigo-100 text-indigo-800 border-indigo-300",
  em_andamento: "bg-blue-100 text-blue-800 border-blue-300",
  bloqueada: "bg-amber-100 text-amber-800 border-amber-300",
  atrasada: "bg-red-100 text-red-800 border-red-300",
  reprogramada: "bg-purple-100 text-purple-800 border-purple-300",
  concluida: "bg-emerald-100 text-emerald-800 border-emerald-300",
  cancelada: "bg-zinc-100 text-zinc-600 border-zinc-300",
};

/** Colunas do Kanban, na ordem natural de progressão do trabalho. */
export const ACAO_KANBAN_COLS: PgrAcaoStatus[] = [
  "pendente", "programada", "em_andamento", "bloqueada",
  "atrasada", "reprogramada", "concluida",
];

/** Status que encerram a ação — não aparecem como destino de arrasto. */
export const ACAO_STATUS_FINAIS: PgrAcaoStatus[] = ["concluida", "cancelada"];

export const MEDIDA_LABEL: Record<PgrMedidaTipo, string> = {
  eliminacao: "Eliminação",
  substituicao: "Substituição",
  engenharia: "Engenharia",
  administrativa: "Administrativa",
  epi: "EPI",
};

/**
 * SLA por classificação, em dias.
 *
 * Indexado pela escala de 5 níveis — as chaves antigas (baixo/alto/critico)
 * deixaram de existir e resultariam em `undefined` silencioso aqui.
 * Trivial e tolerável não geram sugestão automática de prazo.
 */
export const SLA_POR_CLASSE: Record<PgrClasse, number | null> = {
  intoleravel: 15,
  substancial: 30,
  moderado: 60,
  toleravel: null,
  trivial: null,
};

/** Prioridade sugerida por classe (1=baixa, 5=máxima). */
export const PRIORIDADE_POR_CLASSE: Record<PgrClasse, number> = {
  trivial: 1, toleravel: 2, moderado: 3, substancial: 4, intoleravel: 5,
};

/** Prazo sugerido a partir de hoje + SLA da classe. Null quando não há SLA. */
export function prazoSugerido(classe?: PgrClasse | string | null): string | null {
  if (!classe) return null;
  const sla = SLA_POR_CLASSE[classe as PgrClasse];
  if (sla == null) return null;
  const d = new Date();
  d.setDate(d.getDate() + sla);
  return d.toISOString().slice(0, 10);
}

/**
 * Prioridade sugerida. O número de trabalhadores atingidos pode ELEVAR a
 * prioridade da ação, mas nunca altera a pontuação do risco — nível de risco e
 * prioridade da ação são grandezas distintas.
 */
export function prioridadeSugerida(
  classe?: PgrClasse | string | null,
  trabalhadoresAtingidos?: number | null,
): number {
  const base = PRIORIDADE_POR_CLASSE[classe as PgrClasse] ?? 3;
  if (trabalhadoresAtingidos != null && trabalhadoresAtingidos >= 20) {
    return Math.min(5, base + 1);
  }
  return base;
}

export function isAtrasada(a: { prazo?: string | null; status: PgrAcaoStatus }) {
  if (!a.prazo) return false;
  if (a.status === "concluida" || a.status === "cancelada") return false;
  return new Date(a.prazo + "T23:59:59") < new Date();
}
