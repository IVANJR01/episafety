/*
 * Aviso de vencimento do certificado digital.
 *
 * Um A1 da ICP-Brasil vale um ano. Quando ele vence, a ficha de EPI continua
 * sendo gerada e baixada normalmente — só volta a sair sem assinatura
 * reconhecida pelo validar.iti.gov.br. Ou seja, o dia em que a garantia
 * jurídica cai é justamente o dia em que nada aparenta ter mudado.
 *
 * Por isso o aviso começa bem antes do vencimento, com prazo suficiente para
 * renovar por videoconferência sem correria.
 */

/** A partir de quantos dias antes do vencimento o aviso aparece. */
export const DIAS_DE_AVISO = 30;

export type NivelValidade = "ok" | "aviso" | "vencido";

export interface AvisoValidade {
  nivel: NivelValidade;
  /** Dias inteiros até vencer. Negativo quando já venceu. */
  dias: number;
  titulo: string;
  mensagem: string;
}

const UM_DIA = 24 * 60 * 60 * 1000;

function dataBr(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}

function plural(n: number, um: string, muitos: string): string {
  return n === 1 ? um : muitos;
}

/**
 * Avalia a validade devolvida pela função `assinar-pdf`.
 *
 * Devolve `null` quando não há o que dizer: sem data, com data ilegível, ou
 * com o vencimento ainda longe. Inventar um aviso a partir de uma data que
 * não deu para ler seria pior do que ficar calado — mandaria renovar um
 * certificado que talvez esteja em dia.
 */
export function avaliarValidade(
  validoAte: string | null | undefined,
  agora: Date = new Date(),
  diasDeAviso: number = DIAS_DE_AVISO,
): AvisoValidade | null {
  if (!validoAte) return null;
  const fim = new Date(validoAte);
  if (Number.isNaN(fim.getTime())) return null;

  // Dias inteiros: vencer daqui a 20 horas é "vence hoje", não "em 1 dia".
  const dias = Math.floor((fim.getTime() - agora.getTime()) / UM_DIA);

  if (dias < 0) {
    const passados = Math.abs(dias);
    return {
      nivel: "vencido",
      dias,
      titulo: "Certificado digital vencido",
      mensagem:
        `O certificado venceu em ${dataBr(fim)}, há ${passados} ${plural(passados, "dia", "dias")}. ` +
        "As fichas continuam sendo geradas, mas a assinatura não será aceita no validar.iti.gov.br.",
    };
  }

  if (dias > diasDeAviso) return null;

  const quando = dias === 0
    ? "vence hoje"
    : `vence em ${dias} ${plural(dias, "dia", "dias")}`;
  return {
    nivel: "aviso",
    dias,
    titulo: "Certificado digital perto de vencer",
    mensagem:
      `O certificado ${quando} (${dataBr(fim)}). ` +
      "Renove e atualize CERT_A1_PFX_BASE64 e CERT_A1_SENHA para as fichas continuarem assinadas.",
  };
}
