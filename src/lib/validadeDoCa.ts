/**
 * A validade do CA do EPI na hora da entrega.
 *
 * O Certificado de Aprovação tem data de validade. Entregar EPI com CA
 * vencido, para a fiscalização e para a Justiça do Trabalho, equivale a
 * não ter entregado nada: o equipamento deixa de ser considerado
 * aprovado. A NR-06 obriga o empregador a fornecer ao trabalhador
 * somente EPI aprovado.
 *
 * Até aqui o sistema guardava o número do CA e a data, imprimia os dois
 * na ficha — e não olhava para a data em momento nenhum. Este arquivo é
 * quem olha.
 *
 * Sem banco, sem React: recebe a data cadastrada e devolve a situação.
 */

/** Quantos dias antes do vencimento o sistema começa a avisar. */
export const DIAS_DE_AVISO = 30;

export type NivelDoCa = "vencido" | "vence_em_breve" | "valido" | "sem_data";

export interface SituacaoDoCa {
  nivel: NivelDoCa;
  /**
   * Dias até vencer. Negativo quando já venceu, null quando não há data
   * cadastrada.
   */
  diasRestantes: number | null;
  /** Frase pronta para a tela. */
  mensagem: string;
}

/** Converte "2026-11-03" em dias desde a origem, sem passar por fuso. */
function emDias(iso: string): number | null {
  const partes = iso.slice(0, 10).split("-");
  if (partes.length !== 3) return null;
  const [ano, mes, dia] = partes.map(Number);
  if (!ano || !mes || !dia) return null;
  const marca = Date.UTC(ano, mes - 1, dia);
  if (Number.isNaN(marca)) return null;
  return Math.floor(marca / 86400000);
}

/** A data de hoje em ISO, no fuso de quem está usando o sistema. */
function hojeIso(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

/**
 * A situação do CA de um EPI.
 *
 * `hoje` existe para o teste fixar a data. A comparação é feita em dias
 * inteiros, não em horas: um CA que vence hoje ainda vale hoje, e passa
 * a estar vencido amanhã. Comparar com `new Date()` cru faria um CA que
 * vence hoje já aparecer vencido às 00h01.
 */
export function situacaoDoCa(
  validade?: string | null,
  hoje: string = hojeIso(),
): SituacaoDoCa {
  if (!validade || !validade.trim()) {
    return {
      nivel: "sem_data",
      diasRestantes: null,
      mensagem: "Validade do CA não cadastrada",
    };
  }

  const vence = emDias(validade);
  const agora = emDias(hoje);
  if (vence == null || agora == null) {
    return {
      nivel: "sem_data",
      diasRestantes: null,
      mensagem: "Validade do CA não cadastrada",
    };
  }

  const dias = vence - agora;

  if (dias < 0) {
    const atraso = Math.abs(dias);
    return {
      nivel: "vencido",
      diasRestantes: dias,
      mensagem:
        atraso === 1
          ? "CA vencido ontem"
          : `CA vencido há ${atraso} dias`,
    };
  }

  if (dias <= DIAS_DE_AVISO) {
    return {
      nivel: "vence_em_breve",
      diasRestantes: dias,
      mensagem:
        dias === 0
          ? "CA vence hoje"
          : dias === 1
            ? "CA vence amanhã"
            : `CA vence em ${dias} dias`,
    };
  }

  return { nivel: "valido", diasRestantes: dias, mensagem: "CA válido" };
}

/**
 * Este tipo de registro entrega EPI para o trabalhador usar?
 *
 * Importa porque só nesses o CA vencido impede. Registrar uma PERDA ou um
 * DANO de equipamento que já estava com o colaborador é o contrário de
 * entregar: bloquear isso esconderia o fato em vez de evitá-lo, e o EPI
 * perdido sumiria do controle.
 */
export function entregaEpiParaUso(tipo: string): boolean {
  return tipo === "entrega" || tipo === "substituicao";
}

/** Um EPI da lista, do jeito que a tela de entrega o conhece. */
export interface EpiComValidade {
  nome: string;
  validade?: string | null;
}

/**
 * Quais EPIs da lista estão com o CA vencido.
 *
 * Devolve lista vazia quando pode entregar. EPI sem validade cadastrada
 * NÃO entra: o sistema não sabe a data, e inventar bloqueio em cima do
 * que ele não sabe pararia o almoxarifado sem motivo. Esse caso aparece
 * como aviso na tela, para alguém completar o cadastro.
 */
export function episComCaVencido<T extends EpiComValidade>(
  itens: { epi: T }[],
  tipo: string,
  hoje?: string,
): T[] {
  if (!entregaEpiParaUso(tipo)) return [];
  return itens
    .map((i) => i.epi)
    .filter((epi) => situacaoDoCa(epi.validade, hoje).nivel === "vencido");
}

/**
 * O recado que a tela dá quando a entrega é recusada.
 *
 * Diz o nome dos EPIs e o que fazer — recusa sem saída é o jeito mais
 * rápido de o almoxarife largar o sistema e voltar para o papel.
 */
export function recusaPorCaVencido(epis: { nome: string }[]): {
  titulo: string;
  descricao: string;
} | null {
  if (epis.length === 0) return null;
  const nomes = epis.map((e) => e.nome).join(", ");
  return {
    titulo:
      epis.length === 1
        ? "EPI com CA vencido não pode ser entregue"
        : `${epis.length} EPIs com CA vencido não podem ser entregues`,
    descricao:
      `${nomes}. A NR-06 obriga a fornecer somente equipamento aprovado. ` +
      "Atualize a validade no cadastro do EPI, se ela estiver errada, " +
      "ou separe outro item para entregar.",
  };
}
