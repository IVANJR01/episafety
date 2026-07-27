// Matriz de risco 5x5 do PGR.
//
// FONTE ÚNICA DE VERDADE — espelha exatamente a função SQL
// public.pgr_classificar_risco(severidade, probabilidade).
// Qualquer alteração aqui exige a migration correspondente, e vice-versa.
//
// Escala oficial (nivel_risco = severidade x probabilidade):
//   1-3 Trivial | 4-8 Tolerável | 9-12 Moderado | 13-15 Substancial | 16-25 Intolerável

export type PgrClasse =
  | "trivial"
  | "toleravel"
  | "moderado"
  | "substancial"
  | "intoleravel";

/** Ordem crescente de gravidade — use para iterar, nunca Object.keys. */
export const CLASSES_ORDENADAS: PgrClasse[] = [
  "trivial",
  "toleravel",
  "moderado",
  "substancial",
  "intoleravel",
];

export const CLASSE_LABEL: Record<PgrClasse, string> = {
  trivial: "Trivial",
  toleravel: "Tolerável",
  moderado: "Moderado",
  substancial: "Substancial",
  intoleravel: "Intolerável",
};

/** Preenchimento sólido — células da matriz. */
export const CLASSE_BG: Record<PgrClasse, string> = {
  trivial: "bg-emerald-500",
  toleravel: "bg-lime-500",
  moderado: "bg-yellow-500",
  substancial: "bg-orange-500",
  intoleravel: "bg-red-600",
};

/** Badge/etiqueta — fundo claro com texto legível. */
export const CLASSE_TEXT: Record<PgrClasse, string> = {
  trivial: "bg-emerald-100 text-emerald-800 border-emerald-300",
  toleravel: "bg-lime-100 text-lime-800 border-lime-300",
  moderado: "bg-yellow-100 text-yellow-800 border-yellow-300",
  substancial: "bg-orange-100 text-orange-800 border-orange-300",
  intoleravel: "bg-red-100 text-red-800 border-red-300",
};

/** Cor hexadecimal para o PDF (jsPDF não entende classes Tailwind). */
export const CLASSE_HEX: Record<PgrClasse, [number, number, number]> = {
  trivial: [16, 185, 129],
  toleravel: [132, 204, 22],
  moderado: [234, 179, 8],
  substancial: [249, 115, 22],
  intoleravel: [220, 38, 38],
};

/** Decisão associada a cada faixa (NR-01 1.5.4.4.3). */
export const CLASSE_DECISAO: Record<PgrClasse, string> = {
  trivial: "Não requer ação adicional; manter os controles existentes.",
  toleravel:
    "Manter monitoramento e os controles existentes; avaliar melhorias de baixo custo.",
  moderado:
    "Requer plano de ação com prazo definido para reduzir o risco.",
  substancial:
    "Requer ação prioritária; não iniciar ou não manter a atividade sem controles adicionais.",
  intoleravel:
    "Interromper a atividade até que o risco seja reduzido; ação imediata.",
};

export function nivelRisco(sev: number, prob: number) {
  return sev * prob;
}

/**
 * Replica EXATAMENTE public.pgr_classificar_risco(severidade, probabilidade).
 * Retorna null quando não há avaliação — não rebaixa para a menor classe.
 */
export function classificarRisco(
  sev: number | null | undefined,
  prob: number | null | undefined,
): PgrClasse | null {
  if (sev == null || prob == null) return null;
  if (sev < 1 || sev > 5 || prob < 1 || prob > 5) return null;
  const n = sev * prob;
  if (n <= 3) return "trivial";
  if (n <= 8) return "toleravel";
  if (n <= 12) return "moderado";
  if (n <= 15) return "substancial";
  return "intoleravel";
}

/** Espelha necessita_acao do trigger pgr_child_guard: moderado e acima. */
export function necessitaAcao(classe: PgrClasse | null | undefined) {
  return (
    classe === "moderado" || classe === "substancial" || classe === "intoleravel"
  );
}

/** Rótulo seguro para classes vindas do banco (inclui dados legados). */
export function classeLabel(classe: string | null | undefined): string {
  if (!classe) return "Não avaliado";
  return CLASSE_LABEL[classe as PgrClasse] ?? classe;
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

// ---------------------------------------------------------------------------
// Compatibilidade — nomes usados antes da unificação da escala.
// @deprecated Use PgrClasse / classificarRisco / CLASSE_LABEL / CLASSE_TEXT.
// ---------------------------------------------------------------------------
/** @deprecated */ export type PgrClassePGR = PgrClasse;
/** @deprecated */ export const CLASSE_PGR_LABEL = CLASSE_LABEL;
/** @deprecated */ export const CLASSE_PGR_TEXT = CLASSE_TEXT;
/** @deprecated */ export const classificarRiscoPGR = classificarRisco;
