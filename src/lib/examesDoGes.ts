/**
 * O que os riscos de um GES dizem sobre o PRAZO do exame clínico.
 *
 * Quem monta a LISTA de exames é matrizSaudeDoGes.ts, de onde o PCMSO e o
 * ASO leem a mesma Matriz de Saúde. O que sobrou aqui é o que a NR-07
 * decide a partir dos riscos e não da lista:
 *
 *   7.5.8, II — anual para quem está exposto a risco identificado e
 *               classificado no PGR, bienal para os demais;
 *   Anexo II  — audiometria quando há ruído.
 */

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

/** Como a tabela do PCMSO escreve a periodicidade. */
export function periodicidadeEmTexto(meses: number | null): string {
  if (meses === 6) return "Semestral";
  if (meses === 24) return "Bienal";
  if (meses) return "Anual";
  return "—";
}
