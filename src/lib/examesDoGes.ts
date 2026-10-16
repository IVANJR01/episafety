/**
 * Os exames de um GES, quando a Matriz de Saúde ainda não foi preenchida.
 *
 * Aqui estavam duas listas que não conversavam. O documento do PCMSO lê a
 * Matriz de Saúde (tabela `ghe_exames`) e, quando ela está vazia para o
 * GES, monta a lista pela NR-07 a partir dos riscos — é por isso que o PDF
 * sai com os exames certos. O Portal de ASO lia SÓ a Matriz, e sem ela
 * devolvia lista vazia: o ASO saía sem exame nenhum enquanto o PCMSO da
 * mesma empresa mostrava a lista cheia.
 *
 * Conferido no banco: a Matriz tem uma linha em todo o sistema. Ou seja,
 * na prática o ASO nunca via exame nenhum.
 *
 * A regra de origem passa a ser esta função, usada pelos dois. Ela é a
 * base normativa; o que a Matriz tiver cadastrado continua tendo
 * precedência sobre ela, nos dois lados.
 */

export interface ExameNormativo {
  /** Código do exame no eSocial. */
  codigo: string;
  nome: string;
  admissional: boolean;
  periodico: boolean;
  /** 12 ou 24 — NR-07, 7.5.8, II. Null quando não é periódico. */
  periodicidadeMeses: number | null;
  retorno: boolean;
  demissional: boolean;
  /**
   * Mudança de risco/função. Para o exame clínico a NR-07 exige só quando
   * a mudança leva a risco diferente do atual (7.5.10) — é o asterisco da
   * tabela do PCMSO, e por isso não é um "sim" seco.
   */
  mudanca: boolean;
  mudancaSeRiscoDiferente: boolean;
}

/** Texto que o inventário usa quando o GES não tem risco. */
const SEM_RISCO = "ausência de fator de risco";

const semAcento = (s: string) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** O GES tem risco identificado e classificado no PGR? */
export function temRiscoIdentificado(textosDosRiscos: string[]): boolean {
  return (textosDosRiscos || []).some((t) => {
    const s = (t || "").trim();
    return !!s && !semAcento(s).includes(semAcento(SEM_RISCO));
  });
}

/** Há ruído entre os riscos — NR-07, Anexo II, exige audiometria. */
export function temRuido(textosDosRiscos: string[]): boolean {
  return (textosDosRiscos || []).some((t) => {
    const s = semAcento(t);
    return s.includes("ruido") || s.includes("pressao sonora");
  });
}

/**
 * Lista normativa de exames do GES.
 *
 * @param textosDosRiscos  descrição dos riscos do GES — do inventário do
 *                         PGR ou do cadastro do GES, tanto faz: o que
 *                         importa é o que está escrito.
 */
export function examesNormativosDoGes(textosDosRiscos: string[]): ExameNormativo[] {
  const exposto = temRiscoIdentificado(textosDosRiscos);

  /*
   * O exame clínico é o único obrigatório em todo ASO (NR-07, 7.5.6). O
   * intervalo é anual para quem está exposto a risco do PGR e bienal para
   * os demais (7.5.8, II).
   */
  const lista: ExameNormativo[] = [{
    codigo: "0295",
    nome: "Avaliação Clínica Ocupacional (Anamnese e Exame físico)",
    admissional: true,
    periodico: true,
    periodicidadeMeses: exposto ? 12 : 24,
    retorno: true,
    demissional: true,
    mudanca: false,
    mudancaSeRiscoDiferente: true,
  }];

  if (temRuido(textosDosRiscos)) {
    lista.push({
      codigo: "0935",
      nome: "Audiometria Tonal e Vocal",
      admissional: true,
      periodico: true,
      periodicidadeMeses: 12,
      retorno: true,
      demissional: true,
      mudanca: true,
      mudancaSeRiscoDiferente: false,
    });
  }

  return lista;
}

/** Os exames que entram num ASO deste tipo de exame. */
export function examesDoTipoDeExame(
  exames: ExameNormativo[],
  tipoExame: string,
): ExameNormativo[] {
  return (exames || []).filter((e) => {
    switch (tipoExame) {
      case "admissional": return e.admissional;
      case "periodico": return e.periodico;
      case "retorno": return e.retorno;
      case "demissional": return e.demissional;
      case "mudanca_risco":
      case "mudanca_funcao": return e.mudanca || e.mudancaSeRiscoDiferente;
      default: return e.periodico;
    }
  });
}

/** Como a tabela do PCMSO escreve a periodicidade. */
export function periodicidadeEmTexto(meses: number | null): string {
  if (meses === 6) return "Semestral";
  if (meses === 24) return "Bienal";
  if (meses) return "Anual";
  return "—";
}
