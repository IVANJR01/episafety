// Matriz 5x5 espelhando a função SQL public.pgr_classificar_risco
export type PgrClasse = "baixo" | "moderado" | "alto" | "critico";

export const CLASSE_LABEL: Record<PgrClasse, string> = {
  baixo: "Baixo",
  moderado: "Moderado",
  alto: "Alto",
  critico: "Crítico",
};

export const CLASSE_BG: Record<PgrClasse, string> = {
  baixo: "bg-emerald-500",
  moderado: "bg-yellow-500",
  alto: "bg-orange-500",
  critico: "bg-red-600",
};

export const CLASSE_TEXT: Record<PgrClasse, string> = {
  baixo: "bg-emerald-100 text-emerald-800 border-emerald-300",
  moderado: "bg-yellow-100 text-yellow-800 border-yellow-300",
  alto: "bg-orange-100 text-orange-800 border-orange-300",
  critico: "bg-red-100 text-red-800 border-red-300",
};

/** Replica EXATAMENTE public.pgr_classificar_risco(severidade, probabilidade). */
export function classificarRisco(sev: number, prob: number): PgrClasse {
  const n = sev * prob;
  if (n <= 4) return "baixo";
  if (n <= 9) return "moderado";
  if (n <= 16) return "alto";
  return "critico";
}

export function nivelRisco(sev: number, prob: number) {
  return sev * prob;
}

export function necessitaAcao(classe: PgrClasse) {
  return classe === "alto" || classe === "critico";
}

export const SEVERIDADE_LABEL: Record<number, string> = {
  1: "Insignificante", 2: "Pequena", 3: "Moderada", 4: "Grande", 5: "Catastrófica",
};
export const PROBABILIDADE_LABEL: Record<number, string> = {
  1: "Raro", 2: "Improvável", 3: "Possível", 4: "Provável", 5: "Quase certo",
};

export const GRUPO_LABEL: Record<string, string> = {
  fisico: "Físico", quimico: "Químico", biologico: "Biológico",
  ergonomico: "Ergonômico", acidente: "Acidente", psicossocial: "Psicossocial", outro: "Outro",
};

export const EXPOSICAO_LABEL: Record<string, string> = {
  continua: "Contínua", intermitente: "Intermitente",
  eventual: "Eventual", nao_aplicavel: "N/A",
};

export const AVALIACAO_LABEL: Record<string, string> = {
  qualitativa: "Qualitativa", quantitativa: "Quantitativa",
};

// Classificação PGR — padrão SafetySoluções (5x5)
// 1-3 Trivial · 4-8 Tolerável · 9-12 Moderado · 13-15 Substancial · 16-25 Intolerável
export type PgrClassePGR = "trivial" | "toleravel" | "moderado" | "substancial" | "intoleravel";

export const CLASSE_PGR_LABEL: Record<PgrClassePGR, string> = {
  trivial: "Trivial",
  toleravel: "Tolerável",
  moderado: "Moderado",
  substancial: "Substancial",
  intoleravel: "Intolerável",
};

export const CLASSE_PGR_TEXT: Record<PgrClassePGR, string> = {
  trivial: "bg-emerald-100 text-emerald-800 border-emerald-300",
  toleravel: "bg-lime-100 text-lime-800 border-lime-300",
  moderado: "bg-yellow-100 text-yellow-800 border-yellow-300",
  substancial: "bg-orange-100 text-orange-800 border-orange-300",
  intoleravel: "bg-red-100 text-red-800 border-red-300",
};

export function classificarRiscoPGR(sev: number, prob: number): PgrClassePGR {
  const n = sev * prob;
  if (n <= 3) return "trivial";
  if (n <= 8) return "toleravel";
  if (n <= 12) return "moderado";
  if (n <= 15) return "substancial";
  return "intoleravel";
}
