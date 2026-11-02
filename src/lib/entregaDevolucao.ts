/**
 * As regras de devolução e de estorno de EPI.
 *
 * Por que isto existe: essas decisões moravam dentro dos botões da tela
 * Entregas.tsx, misturadas com gravação no banco, toast e estado do React.
 * Só era possível conferi-las clicando — e elas valem dinheiro e valem
 * fiscalização: quantidade que volta ao estoque, status que a entrega
 * original recupera, trilha de auditoria da devolução.
 *
 * Aqui dentro NÃO há acesso ao banco, nem a `supabase`, nem a React. Cada
 * função recebe o que já foi lido e devolve o que deve ser gravado. Quem
 * grava continua sendo a tela; quem decide é este arquivo.
 *
 * Nenhuma regra foi mudada na extração: é o mesmo comportamento de antes,
 * agora num lugar onde o teste alcança.
 */

/** Para onde vai o EPI que o colaborador devolveu. */
export type DestinoDevolucao = "estoque" | "descarte";

/** O que a tela precisa saber de uma entrega para decidir a devolução. */
export interface EntregaParaDevolucao {
  id: string;
  funcionario_id: string;
  epi_id: string;
  quantidade: number;
  data: string;
  status?: string | null;
  observacao?: string | null;
  empresa_id?: string | null;
}

/** A linha nova que a devolução grava na tabela de entregas. */
export interface RegistroDeDevolucao {
  funcionario_id: string;
  epi_id: string;
  quantidade: number;
  data: string;
  tipo: "devolucao";
  status: "devolvido";
  observacao: string;
  empresa_id: string | null;
  created_by: string | null;
}

export interface PlanoDeDevolucao {
  /** A linha nova de devolução. */
  registro: RegistroDeDevolucao;
  /** O status que a entrega original passa a ter. */
  statusDaEntregaOriginal: "devolvido";
}

export const DESTINOS_DE_DEVOLUCAO = [
  { value: "estoque", label: "Retornar ao estoque" },
  { value: "descarte", label: "Descarte / Avaria" },
] as const;

/** Data de hoje em ISO (YYYY-MM-DD), do mesmo jeito que a tela gravava. */
function hojeIso(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Monta a devolução de uma entrega.
 *
 * A regra que mais importa está numa linha só: EPI descartado entra com
 * **quantidade zero**, porque descarte não devolve peça ao estoque. Era
 * essa conta que, se saísse errada, inflava o estoque com EPI avariado.
 */
export function planejarDevolucao(entrada: {
  entrega: EntregaParaDevolucao;
  destino: DestinoDevolucao;
  /** O que o técnico escreveu no campo de observação; pode vir vazio. */
  observacao?: string;
  /** E-mail ou id de quem está processando, para a trilha de auditoria. */
  operador?: string | null;
  /** Empresa ativa, usada quando a entrega não traz a dela. */
  empresaId?: string | null;
  /** Id do usuário, gravado em created_by. */
  usuarioId?: string | null;
  /** Só para teste: fixa a data de hoje. */
  hoje?: string;
}): PlanoDeDevolucao {
  const { entrega, destino } = entrada;
  const devolveAoEstoque = destino === "estoque";

  return {
    registro: {
      funcionario_id: entrega.funcionario_id,
      epi_id: entrega.epi_id,
      quantidade: devolveAoEstoque ? entrega.quantidade : 0,
      data: entrada.hoje ?? hojeIso(),
      tipo: "devolucao",
      status: "devolvido",
      observacao: observacaoDaDevolucao(entrada),
      empresa_id: entrega.empresa_id || entrada.empresaId || null,
      created_by: entrada.usuarioId || null,
    },
    statusDaEntregaOriginal: "devolvido",
  };
}

/**
 * A trilha de auditoria que vai no campo observação.
 *
 * Guarda de onde veio e em que estado estava, porque é só com isso que o
 * estorno consegue desfazer a devolução depois. O que o técnico escreveu
 * vai no fim, e some se vier em branco — nunca sobra um " • " solto.
 */
function observacaoDaDevolucao(entrada: {
  entrega: EntregaParaDevolucao;
  destino: DestinoDevolucao;
  observacao?: string;
  operador?: string | null;
}): string {
  const { entrega, destino } = entrada;
  return [
    `Devolução ref. entrega de ${entrega.data}`,
    `Entrega origem: ${entrega.id}`,
    `Status anterior: ${entrega.status || "ativo"}`,
    `Processado por: ${entrada.operador || "usuário autenticado"}`,
    destino === "descarte"
      ? "[DESCARTE/AVARIA - não retornado ao estoque]"
      : null,
    entrada.observacao?.trim() || null,
  ]
    .filter(Boolean)
    .join(" • ");
}

/** O que a devolução gravou sobre si mesma, lido de volta. */
export interface AuditoriaDaDevolucao {
  entregaDeOrigemId: string | null;
  statusAnterior: string | null;
  processadoPor: string | null;
}

/** Lê a trilha de auditoria de dentro da observação da devolução. */
export function lerAuditoriaDaDevolucao(
  observacao?: string | null,
): AuditoriaDaDevolucao {
  return {
    entregaDeOrigemId:
      observacao?.match(/Entrega origem:\s*([0-9a-f-]{36})/i)?.[1] ?? null,
    statusAnterior:
      observacao?.match(/Status anterior:\s*([a-z_]+)/i)?.[1] ?? null,
    processadoPor:
      observacao?.match(/Processado por:\s*([^•]+)/i)?.[1]?.trim() ?? null,
  };
}

/** Junta uma anotação nova ao que já estava escrito, sem deixar lixo. */
export function acrescentarObservacao(
  atual: string | null | undefined,
  nota: string,
): string {
  return [atual?.trim(), nota.trim()].filter(Boolean).join(" • ");
}

/** O mínimo que precisamos de uma entrega para achar a origem. */
export interface EntregaNoHistorico {
  id: string;
  funcionario_id: string;
  epi_id: string;
  tipo: string;
  created_at: string;
  observacao?: string | null;
  status?: string | null;
}

/**
 * Acha a entrega que esta devolução devolveu.
 *
 * Primeiro pelo id que a própria devolução gravou — caminho confiável.
 * Devolução antiga, gravada antes da trilha existir, cai no palpite: a
 * última entrega do mesmo colaborador, do mesmo EPI, feita até o momento
 * da devolução. Devolve null quando não dá para saber, e aí a tela avisa
 * em vez de estornar a entrega errada.
 */
export function localizarEntregaDeOrigem<T extends EntregaNoHistorico>(
  devolucao: T & { created_at: string },
  historico: T[],
): { entregaDeOrigem: T | null; auditoria: AuditoriaDaDevolucao } {
  const auditoria = lerAuditoriaDaDevolucao(devolucao.observacao);

  if (auditoria.entregaDeOrigemId) {
    const pelaTrilha =
      historico.find((item) => item.id === auditoria.entregaDeOrigemId) || null;
    if (pelaTrilha) return { entregaDeOrigem: pelaTrilha, auditoria };
  }

  const momentoDaDevolucao = new Date(devolucao.created_at).getTime();
  const entregaDeOrigem =
    [...historico]
      .filter(
        (item) =>
          item.id !== devolucao.id &&
          item.tipo !== "devolucao" &&
          item.funcionario_id === devolucao.funcionario_id &&
          item.epi_id === devolucao.epi_id &&
          new Date(item.created_at).getTime() <= momentoDaDevolucao,
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )[0] || null;

  return { entregaDeOrigem, auditoria };
}

export interface PlanoDeEstorno {
  /** Status que a entrega original recupera. */
  statusRestaurado: string;
  /** Observação da entrega original, já com a nota do estorno. */
  observacaoDaOrigem: string;
  /**
   * Quanto o estoque da unidade passa a ter, ou null quando não se mexe
   * nele — porque o EPI é de contrato, ou porque a devolução não tinha
   * devolvido peça nenhuma (descarte).
   */
  novoEstoqueDaUnidade: number | null;
}

/**
 * O que o estorno de uma devolução desfaz.
 *
 * Desfazer uma devolução é tirar de volta do estoque o que ela tinha
 * devolvido. Duas coisas impedem esse desconto: EPI controlado por
 * contrato (quem cuida do saldo é o contrato) e devolução de descarte,
 * que entrou com quantidade zero e portanto nunca somou nada.
 *
 * O estoque nunca fica negativo: o piso é zero, mesmo que a conta dê
 * menos. Estoque negativo em tela de EPI é erro que o técnico não tem
 * como explicar na fiscalização.
 */
export function planejarEstorno(entrada: {
  devolucao: { id: string; data: string; quantidade: number };
  entregaDeOrigem: { observacao?: string | null };
  auditoria: AuditoriaDaDevolucao;
  /** Quem está desfazendo agora. */
  operador?: string | null;
  /** true quando o EPI tem saldo controlado por contrato. */
  temContrato: boolean;
  /** Estoque que a unidade tem hoje; só é lido quando há desconto. */
  estoqueAtual?: number | null;
  /** Só para teste: fixa a data da nota de auditoria. */
  dataDoEstorno?: string;
}): PlanoDeEstorno {
  const { devolucao, auditoria } = entrada;

  const operadorDoEstorno = entrada.operador || "usuário autenticado";
  const dia = entrada.dataDoEstorno ?? new Date().toLocaleDateString("pt-BR");
  const nota =
    `Estorno de devolução por erro em ${dia} por ${operadorDoEstorno}. ` +
    `Devolução original: ${devolucao.data}` +
    (auditoria.processadoPor
      ? `, processada por ${auditoria.processadoPor}`
      : ", sem operador identificado") +
    ".";

  const descontaEstoque = !entrada.temContrato && devolucao.quantidade > 0;

  return {
    statusRestaurado: auditoria.statusAnterior || "ativo",
    observacaoDaOrigem: acrescentarObservacao(
      entrada.entregaDeOrigem.observacao,
      nota,
    ),
    novoEstoqueDaUnidade: descontaEstoque
      ? Math.max(Number(entrada.estoqueAtual || 0) - devolucao.quantidade, 0)
      : null,
  };
}
