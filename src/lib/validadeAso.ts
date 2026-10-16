/**
 * Validade do ASO, pela NR-07.
 *
 * O cadastro tratava todo ASO igual: o formulário abria em "1 ano" para
 * qualquer tipo de exame, e no catálogo de documentos havia um tipo "ASO"
 * com 12 meses e outro "ASO - DEMISSIONAL" com 2 meses. Nenhum dos dois
 * números sai da norma, e os dois geram cobrança errada no painel de
 * vencimentos — um ASO aparecendo vigente depois do prazo, ou vencendo
 * antes da hora.
 *
 * A NR-07 não dá um prazo só. Dá um por situação:
 *
 *   7.5.8 I   — admissional: antes de o empregado assumir as atividades.
 *   7.5.8 II  — periódico: a cada ANO para quem está exposto a risco
 *               identificado e classificado no PGR (ou é portador de doença
 *               crônica que aumente a susceptibilidade); a cada DOIS ANOS
 *               para os demais.
 *   7.5.9     — retorno ao trabalho: antes de reassumir, após 30 dias ou
 *               mais afastado por doença ou acidente.
 *   7.5.10    — mudança de risco: antes da data da mudança.
 *   7.5.11    — demissional: o exame clínico é feito em até 10 dias do
 *               término do contrato, e PODE SER DISPENSADO se o exame
 *               ocupacional mais recente for de menos de 135 dias (graus de
 *               risco 1 e 2) ou menos de 90 dias (graus 3 e 4).
 *
 * Repare no que o 7.5.11 diz: 135/90 dias NÃO é "validade do demissional".
 * É a janela em que um exame anterior dispensa o demissional. O demissional
 * em si encerra o contrato — não vence, e dar validade a ele faz o sistema
 * cobrar de novo um documento de alguém que não trabalha mais ali.
 *
 * Depois de feito o exame, quem decide a aptidão e o intervalo é o médico
 * (7.5.8 II "a" 1 permite intervalo MENOR a critério dele). O que está aqui
 * é o prazo máximo da norma, usado como sugestão — nunca como trava.
 */

export type TipoExameAso =
  | "admissional"
  | "periodico"
  | "retorno"
  | "mudanca_risco"
  | "demissional";

export interface ValidadeAso {
  /** Meses até o próximo exame clínico; null quando o ASO não vence. */
  meses: number | null;
  /** O item da NR-07 de onde o prazo sai. */
  base: string;
  /** Frase curta para mostrar ao lado do campo. */
  explicacao: string;
}

/**
 * Prazo até o próximo exame clínico.
 *
 * @param tipoExame     tipo do exame deste ASO.
 * @param exposto       o trabalhador está exposto a risco identificado e
 *                      classificado no PGR, ou é portador de doença crônica
 *                      que aumente a susceptibilidade a esses riscos.
 */
export function validadeDoAso(tipoExame: TipoExameAso, exposto: boolean): ValidadeAso {
  if (tipoExame === "demissional") {
    return {
      meses: null,
      base: "NR-07, item 7.5.11",
      explicacao:
        "O demissional encerra o vínculo: não vence e não é cobrado de novo.",
    };
  }

  /*
   * Admissional, retorno e mudança de risco não têm prazo próprio: o que
   * corre a partir deles é o relógio do PERIÓDICO, e é esse prazo que o
   * sistema precisa guardar para saber quando cobrar o próximo exame.
   */
  if (exposto) {
    return {
      meses: 12,
      base: "NR-07, item 7.5.8, II, 'a'",
      explicacao:
        "Exposto a risco do PGR: exame clínico a cada ano, ou antes, a critério do médico.",
    };
  }
  return {
    meses: 24,
    base: "NR-07, item 7.5.8, II, 'b'",
    explicacao: "Sem risco identificado no PGR: exame clínico a cada dois anos.",
  };
}

/** Janela do 7.5.11, em dias, pelo grau de risco da organização. */
export function janelaDispensaDemissional(grauRisco?: number | null): number | null {
  if (grauRisco === 1 || grauRisco === 2) return 135;
  if (grauRisco === 3 || grauRisco === 4) return 90;
  /*
   * Sem o grau de risco cadastrado não dá para dizer se são 135 ou 90 dias.
   * Chutar o prazo maior dispensaria exame que a norma exige; chutar o menor
   * mandaria fazer exame dispensado. O sistema diz que não sabe.
   */
  return null;
}

export interface DispensaDemissional {
  /** true quando o exame anterior dispensa o demissional. */
  dispensado: boolean;
  /** Dias entre o exame mais recente e o término do contrato. */
  diasDesdeUltimoExame: number | null;
  /** 135, 90, ou null quando o grau de risco não está cadastrado. */
  janelaDias: number | null;
  motivo: string;
}

/**
 * Diz se o demissional pode ser dispensado — NR-07, 7.5.11.
 *
 * @param dataUltimoExame  data do exame clínico ocupacional mais recente.
 * @param dataTermino      data do término do contrato.
 */
export function dispensaDemissional(
  dataUltimoExame: string | null | undefined,
  dataTermino: string | null | undefined,
  grauRisco?: number | null,
): DispensaDemissional {
  const janelaDias = janelaDispensaDemissional(grauRisco);

  const dias = diasCorridos(dataUltimoExame, dataTermino);
  if (dias === null) {
    return {
      dispensado: false,
      diasDesdeUltimoExame: null,
      janelaDias,
      motivo: !dataUltimoExame
        ? "Sem exame ocupacional anterior registrado: o demissional é obrigatório."
        : "Datas incompletas: não dá para verificar a dispensa.",
    };
  }

  if (janelaDias === null) {
    return {
      dispensado: false,
      diasDesdeUltimoExame: dias,
      janelaDias: null,
      motivo:
        "Grau de risco da empresa não cadastrado: sem ele não dá para saber se a janela é de 135 ou de 90 dias.",
    };
  }

  /*
   * "há menos de" — exatamente no limite o exame NÃO dispensa. O documento
   * vai à fiscalização; o empate fica do lado de fazer o exame.
   */
  const dispensado = dias < janelaDias;
  return {
    dispensado,
    diasDesdeUltimoExame: dias,
    janelaDias,
    motivo: dispensado
      ? `Exame ocupacional de ${dias} dias atrás, dentro da janela de ${janelaDias} dias: o demissional pode ser dispensado.`
      : `Exame ocupacional de ${dias} dias atrás, fora da janela de ${janelaDias} dias: o demissional é obrigatório.`,
  };
}

/** Dias inteiros entre duas datas ISO, sem deixar fuso comer um dia. */
function diasCorridos(de?: string | null, ate?: string | null): number | null {
  if (!de || !ate) return null;
  const a = new Date(`${de.slice(0, 10)}T00:00:00`);
  const b = new Date(`${ate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * O prazo que duas datas gravadas representam.
 *
 * Serve para o ASO que entra pronto no sistema — o PDF digitalizado que
 * já traz emissão e vencimento —, e para o PDF do ASO decidir qual
 * quadrinho marcar. A regra estava escrita nos dois lugares.
 */
export function validadeTipoPelasDatas(
  dataEmissao?: string | null, dataVencimento?: string | null,
): string | null {
  if (!dataEmissao || !dataVencimento) return null;
  const a = new Date(`${dataEmissao.slice(0, 10)}T00:00:00`);
  const b = new Date(`${dataVencimento.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const dias = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  if (dias <= 0) return null;
  if (dias <= 100) return "90dias";
  if (dias <= 200) return "6meses";
  if (dias <= 400) return "1ano";
  return "2anos";
}
