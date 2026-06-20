export type PgrAcaoStatus = "pendente" | "em_andamento" | "concluida" | "atrasada" | "cancelada";
export type PgrMedidaTipo = "eliminacao" | "substituicao" | "engenharia" | "administrativa" | "epi";
export type PgrClasse = "baixo" | "moderado" | "alto" | "critico";

export const ACAO_STATUS_LABEL: Record<PgrAcaoStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  atrasada: "Atrasada",
  cancelada: "Cancelada",
};

export const ACAO_STATUS_COLOR: Record<PgrAcaoStatus, string> = {
  pendente: "bg-slate-100 text-slate-700 border-slate-300",
  em_andamento: "bg-blue-100 text-blue-800 border-blue-300",
  concluida: "bg-emerald-100 text-emerald-800 border-emerald-300",
  atrasada: "bg-red-100 text-red-800 border-red-300",
  cancelada: "bg-zinc-100 text-zinc-600 border-zinc-300",
};

export const MEDIDA_LABEL: Record<PgrMedidaTipo, string> = {
  eliminacao: "Eliminação",
  substituicao: "Substituição",
  engenharia: "Engenharia",
  administrativa: "Administrativa",
  epi: "EPI",
};

/** SLA por classificação (em dias). */
export const SLA_POR_CLASSE: Record<PgrClasse, number | null> = {
  critico: 30,
  alto: 60,
  moderado: 90,
  baixo: null, // não gera sugestão automática
};

/** Prioridade sugerida por classe (1=baixa, 5=máxima). */
export const PRIORIDADE_POR_CLASSE: Record<PgrClasse, number> = {
  baixo: 1, moderado: 2, alto: 4, critico: 5,
};

/** Calcula prazo sugerido a partir de hoje + SLA da classe. */
export function prazoSugerido(classe: PgrClasse): string | null {
  const sla = SLA_POR_CLASSE[classe];
  if (sla == null) return null;
  const d = new Date();
  d.setDate(d.getDate() + sla);
  return d.toISOString().slice(0, 10);
}

export function isAtrasada(a: { prazo?: string | null; status: PgrAcaoStatus }) {
  if (!a.prazo) return false;
  if (a.status === "concluida" || a.status === "cancelada") return false;
  return new Date(a.prazo + "T23:59:59") < new Date();
}
