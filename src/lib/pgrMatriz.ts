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

/*
 * AS CORES OFICIAIS DA CLASSIFICAÇÃO — fonte única.
 *
 * São as mesmas da planilha de inventário da SafetySoluções e dos documentos
 * em Word gerados pelo pacote (ferramentas/documentos). Antes a tela usava a
 * paleta do Tailwind (esmeralda, lima, amarelo-500...), e a mesma linha de
 * risco saía de uma cor na tela e de outra no Excel e no Word entregue ao
 * cliente. Agora há um lugar só, e o teste coresOficiais.test.ts confere que
 * o gerador de Word continua usando exatamente estes valores.
 *
 * Não trocar por classe do Tailwind: FFFF00 e 92D050 não existem na paleta
 * padrão, e aproximar "quase igual" é como a divergência começou.
 */
export const CLASSE_HEX_OFICIAL: Record<PgrClasse, string> = {
  trivial: "00B0F0",
  toleravel: "92D050",
  moderado: "FFFF00",
  substancial: "FFC000",
  intoleravel: "C00000",
};

/**
 * A letra que se lê em cima de cada cor.
 *
 * Só o Intolerável leva letra branca — é a mesma regra do gerador de Word
 * (`txtCor`). Nos outros o fundo é claro demais e o branco some; branco sobre
 * amarelo FFFF00 é ilegível, e rótulo ilegível num documento legal vale o
 * mesmo que rótulo ausente.
 */
export const CLASSE_TEXTO_SOBRE: Record<PgrClasse, string> = {
  trivial: "#000000",
  toleravel: "#000000",
  moderado: "#000000",
  substancial: "#000000",
  intoleravel: "#FFFFFF",
};

/** Preenchimento sólido — células da matriz. */
export const CLASSE_BG: Record<PgrClasse, string> = {
  trivial: "bg-[#00B0F0]",
  toleravel: "bg-[#92D050]",
  moderado: "bg-[#FFFF00]",
  substancial: "bg-[#FFC000]",
  intoleravel: "bg-[#C00000]",
};

/*
 * Badge/etiqueta — a mesma cor, clara o bastante para texto por cima.
 *
 * A cor oficial entra a 18% com borda a 55% dela; o texto usa um tom escuro
 * da MESMA matiz, para a etiqueta ser reconhecida como a mesma cor da célula
 * pintada sem ficar ilegível.
 */
export const CLASSE_TEXT: Record<PgrClasse, string> = {
  trivial: "bg-[#00B0F0]/18 text-[#065A7D] border-[#00B0F0]/55",
  toleravel: "bg-[#92D050]/18 text-[#3F6B12] border-[#92D050]/55",
  moderado: "bg-[#FFFF00]/25 text-[#6B6000] border-[#C9A400]/55",
  substancial: "bg-[#FFC000]/20 text-[#7A5A00] border-[#FFC000]/55",
  intoleravel: "bg-[#C00000]/12 text-[#8F0000] border-[#C00000]/45",
};

/**
 * Célula pintada da classificação, no inventário.
 *
 * Mesmo tratamento da coluna Agente: a cor preenche a célula e a letra sai na
 * cor que se lê em cima dela. É a escala de decisão da NR-01 — quanto mais
 * quente, mais urgente —, e pintar a célula inteira faz a linha crítica saltar
 * numa tabela de dezoito colunas.
 */
export const CLASSE_COR: Record<PgrClasse, { fundo: string; texto: string }> = {
  trivial: { fundo: "#00B0F0", texto: CLASSE_TEXTO_SOBRE.trivial },
  toleravel: { fundo: "#92D050", texto: CLASSE_TEXTO_SOBRE.toleravel },
  moderado: { fundo: "#FFFF00", texto: CLASSE_TEXTO_SOBRE.moderado },
  substancial: { fundo: "#FFC000", texto: CLASSE_TEXTO_SOBRE.substancial },
  intoleravel: { fundo: "#C00000", texto: CLASSE_TEXTO_SOBRE.intoleravel },
};

/**
 * A cor de uma classificação. Sem avaliação fica cinza — nunca a cor da menor
 * classe, que faria risco NÃO AVALIADO parecer risco aceito.
 */
export function corDaClasse(classe?: string | null): { fundo: string; texto: string } {
  const chave = (classe || "").trim().toLowerCase() as PgrClasse;
  return CLASSE_COR[chave] ?? COR_NEUTRA;
}

/** O hexadecimal oficial em RGB, para o PDF (jsPDF não entende classe Tailwind). */
const paraRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(0, 2), 16),
  parseInt(hex.slice(2, 4), 16),
  parseInt(hex.slice(4, 6), 16),
];

/** A letra que se lê em cima da cor, em RGB — para o PDF. */
export const CLASSE_TEXTO_HEX: Record<PgrClasse, [number, number, number]> = {
  trivial: paraRgb(CLASSE_TEXTO_SOBRE.trivial.slice(1)),
  toleravel: paraRgb(CLASSE_TEXTO_SOBRE.toleravel.slice(1)),
  moderado: paraRgb(CLASSE_TEXTO_SOBRE.moderado.slice(1)),
  substancial: paraRgb(CLASSE_TEXTO_SOBRE.substancial.slice(1)),
  intoleravel: paraRgb(CLASSE_TEXTO_SOBRE.intoleravel.slice(1)),
};

export const CLASSE_HEX: Record<PgrClasse, [number, number, number]> = {
  trivial: paraRgb(CLASSE_HEX_OFICIAL.trivial),
  toleravel: paraRgb(CLASSE_HEX_OFICIAL.toleravel),
  moderado: paraRgb(CLASSE_HEX_OFICIAL.moderado),
  substancial: paraRgb(CLASSE_HEX_OFICIAL.substancial),
  intoleravel: paraRgb(CLASSE_HEX_OFICIAL.intoleravel),
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

/**
 * A FAIXA DE NÍVEL de cada classe, para escrever na legenda da matriz.
 *
 * Não dá para deduzir a faixa dos produtos que a matriz 5x5 produz: entre 13 e
 * 15 o único produto possível é 15, e a legenda saía "15 a 15" em vez da faixa
 * oficial "13 a 15" da escala. A faixa é a regra, não a amostra.
 *
 * `faixasConferem()` prova que estes limites e `classificarRisco` dizem a
 * mesma coisa para todo nível de 1 a 25 — se um mudar sem o outro, o teste cai.
 */
export const CLASSE_FAIXA: Record<PgrClasse, [number, number]> = {
  trivial: [1, 3],
  toleravel: [4, 8],
  moderado: [9, 12],
  substancial: [13, 15],
  intoleravel: [16, 25],
};

/**
 * As faixas escritas e a regra que classifica dizem a mesma coisa?
 *
 * Duas conferências. A primeira: todo par P×S da matriz cai dentro da faixa da
 * classe que `classificarRisco` devolve. A segunda: as faixas cobrem 1 a 25
 * inteiro, uma começando onde a outra termina — sem buraco e sem sobreposição.
 * A segunda importa porque 13 e 14 não são produto de dois números de 1 a 5, e
 * sem ela ninguém perceberia se o Substancial começasse em 15.
 */
export function faixasConferem(): boolean {
  for (let sev = 1; sev <= 5; sev++) {
    for (let prob = 1; prob <= 5; prob++) {
      const classe = classificarRisco(sev, prob);
      if (!classe) return false;
      const [de, ate] = CLASSE_FAIXA[classe];
      const n = sev * prob;
      if (n < de || n > ate) return false;
    }
  }
  let esperado = 1;
  for (const c of CLASSES_ORDENADAS) {
    const [de, ate] = CLASSE_FAIXA[c];
    if (de !== esperado || ate < de) return false;
    esperado = ate + 1;
  }
  return esperado === 26;
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
  acidente: "Acidente", ergonomico: "Ergonômico", 
  psicossocial: "Psicossocial", outro: "Outros",
};

/**
 * As cores do mapa de riscos, por grupo de agente.
 *
 * É a convenção que a NR-09 consagrou e que todo técnico reconhece de olho:
 * verde para físico, vermelho para químico, marrom para biológico, amarelo
 * para ergonômico e azul para acidente. Numa tabela de dezoito colunas, a cor
 * diz o grupo antes de a pessoa chegar a ler a palavra.
 *
 * O amarelo pede texto escuro; os outros, claro. Sem isso o rótulo some no
 * fundo — e "some no fundo" num documento legal é o mesmo que não estar lá.
 */
export const GRUPO_COR: Record<string, { fundo: string; texto: string }> = {
  fisico: { fundo: "#16A34A", texto: "#FFFFFF" },
  quimico: { fundo: "#DC2626", texto: "#FFFFFF" },
  biologico: { fundo: "#92400E", texto: "#FFFFFF" },
  ergonomico: { fundo: "#FACC15", texto: "#1F2937" },
  acidente: { fundo: "#2563EB", texto: "#FFFFFF" },
};

/**
 * A cor de um grupo. Grupo desconhecido — ou item antigo classificado como
 * psicossocial/outros, que saíram do seletor — fica cinza: melhor uma cor
 * neutra e honesta do que emprestar a de outro grupo e induzir a leitura.
 */
export const COR_NEUTRA = { fundo: "#E2E8F0", texto: "#334155" };

export function corDoGrupo(grupo?: string | null): { fundo: string; texto: string } {
  const chave = (grupo || "").trim().toLowerCase();
  return GRUPO_COR[chave] ?? COR_NEUTRA;
}

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
