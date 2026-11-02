/**
 * As regras de registrar uma entrega de EPI.
 *
 * Este é o caminho que o técnico usa todos os dias: escolher o
 * colaborador, somar os EPIs e salvar. Ficava dentro de um handleSave de
 * 263 linhas em Entregas.tsx, misturado com estado do React, toast, fila
 * offline e gravação no banco — e por isso nunca teve um teste.
 *
 * Aqui dentro não há banco, nem supabase, nem React. As funções recebem o
 * que o formulário tem e devolvem o que deve ser gravado.
 *
 * O mesmo registro é montado em quatro situações (online, offline, queda
 * de conexão no meio do envio, e a linha que a tela mostra enquanto a
 * sincronização não acontece). Cada uma tinha a própria cópia do objeto,
 * e as cópias já não eram idênticas: a linha de exibição usa o id visível
 * do EPI e a que vai para o banco usa o id de origem. Isso está preservado
 * e agora está escrito em um lugar só, com teste dizendo que é de
 * propósito.
 */

/** O que o formulário de entrega tem preenchido. */
export interface FormularioDeEntrega {
  funcionario_id: string;
  data: string;
  tipo: string;
  observacao?: string | null;
  unidade_origem_id?: string | null;
}

/** Um EPI com a quantidade que o técnico somou na lista. */
export interface ItemDeEntrega {
  epi: { id: string; nome: string; source_epi_id?: string };
  quantidade: number;
}

export type TipoDeEntrega =
  | "entrega"
  | "substituicao"
  | "perda"
  | "dano"
  | "devolucao";

/**
 * O status que a entrega nasce com, conforme o tipo.
 *
 * Perda e dano nascem já marcados: o EPI saiu e não está em uso. Entrega
 * e substituição nascem ativas. Tipo que não esteja na lista nasce ativo,
 * que é o comportamento antigo e o mais seguro: EPI em uso aparece na
 * ficha do colaborador, e o que não deveria aparecer é corrigido depois —
 * o contrário (EPI entregue que não aparece) é falta na fiscalização.
 */
export function statusDaEntrega(tipo: string): string {
  const porTipo: Record<string, string> = {
    entrega: "ativo",
    substituicao: "ativo",
    perda: "perdido",
    dano: "danificado",
  };
  return porTipo[tipo] || "ativo";
}

/** O que impede de salvar, já com o texto que a tela mostra. */
export interface ImpedimentoDeEntrega {
  titulo: string;
  descricao?: string;
}

/**
 * Confere o que falta antes de gravar.
 *
 * Devolve null quando pode salvar. A ordem das conferências é a mesma de
 * antes, porque é a ordem em que o técnico preenche a tela: primeiro o
 * colaborador e os EPIs, depois de onde o EPI está saindo, e por fim a
 * sessão.
 */
export function impedimentoParaSalvar(entrada: {
  form: FormularioDeEntrega;
  itens: ItemDeEntrega[];
  empresaId?: string | null;
}): ImpedimentoDeEntrega | null {
  const { form, itens } = entrada;

  if (!form.funcionario_id || itens.length === 0) {
    return { titulo: "Preencha funcionário e adicione ao menos um EPI" };
  }
  if (!form.unidade_origem_id) {
    return {
      titulo: "Selecione o Local de Baixa",
      descricao: "Informe de qual unidade o EPI está saindo.",
    };
  }
  if (!entrada.empresaId) {
    return {
      titulo: "Erro de sessão",
      descricao: "Empresa não identificada. Faça logout e entre novamente.",
    };
  }
  return null;
}

/**
 * O EPI que vai para o banco.
 *
 * `source_epi_id` existe quando o EPI da tela é a cópia de um EPI de
 * contrato: o banco guarda o original, não a cópia.
 */
function idDoEpiNoBanco(item: ItemDeEntrega): string {
  return item.epi.source_epi_id || item.epi.id;
}

/** A linha de entrega que vai para a tabela. */
export function registroDeEntrega(entrada: {
  form: FormularioDeEntrega;
  item: ItemDeEntrega;
  status: string;
  empresaId: string;
  usuarioId?: string | null;
}) {
  const { form, item } = entrada;
  return {
    funcionario_id: form.funcionario_id,
    epi_id: idDoEpiNoBanco(item),
    quantidade: item.quantidade,
    data: form.data,
    tipo: normalizarTipo(form.tipo),
    status: entrada.status,
    observacao: form.observacao || null,
    empresa_id: entrada.empresaId,
    created_by: entrada.usuarioId ?? null,
    unidade_origem_id: form.unidade_origem_id || null,
  };
}

/**
 * A linha que entra na fila de sincronização quando não há internet.
 *
 * Leva um id provisório gerado no aparelho, porque a tela precisa de algo
 * para apontar enquanto o servidor não devolveu o id de verdade. Não leva
 * created_by: quem sincroniza depois é que sabe quem está logado.
 */
export function registroOffline(entrada: {
  form: FormularioDeEntrega;
  item: ItemDeEntrega;
  status: string;
  empresaId: string;
  idProvisorio: string;
}) {
  const { form, item } = entrada;
  return {
    id: entrada.idProvisorio,
    funcionario_id: form.funcionario_id,
    epi_id: idDoEpiNoBanco(item),
    quantidade: item.quantidade,
    data: form.data,
    tipo: normalizarTipo(form.tipo),
    status: entrada.status,
    observacao: form.observacao || null,
    empresa_id: entrada.empresaId,
    unidade_origem_id: form.unidade_origem_id || null,
  };
}

/**
 * A linha que a tela mostra enquanto a entrega ainda não subiu.
 *
 * Usa o id VISÍVEL do EPI, não o de origem, porque é por ele que a tela
 * acha o nome do EPI para escrever no card. Trocar por source_epi_id faz
 * o card aparecer como "EPI não localizado".
 */
export function linhaDoCache(entrada: {
  form: FormularioDeEntrega;
  item: ItemDeEntrega;
  status: string;
  idProvisorio: string;
  agora?: string;
}) {
  const { form, item } = entrada;
  return {
    id: entrada.idProvisorio,
    funcionario_id: form.funcionario_id,
    epi_id: item.epi.id,
    quantidade: item.quantidade,
    data: form.data,
    tipo: normalizarTipo(form.tipo),
    status: entrada.status,
    observacao: form.observacao || null,
    created_at: entrada.agora ?? new Date().toISOString(),
    assinatura_colaborador: null,
    foto_reconhecimento: null,
  };
}

/**
 * O tipo escrito de qualquer jeito, reduzido ao que o banco aceita.
 *
 * O campo chega com acento, maiúscula e variação ("Substituição",
 * "SUBSTITUICAO", "substituição"). O enum do banco só aceita um deles.
 */
export function normalizarTipo(valor?: string | null): TipoDeEntrega {
  const limpo = (valor || "")
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

  if (limpo.includes("substit")) return "substituicao";
  if (limpo.includes("perda")) return "perda";
  if (limpo.includes("dano")) return "dano";
  if (limpo.includes("devolu")) return "devolucao";
  return "entrega";
}

/** O que a tela precisa de uma entrega antiga para substituí-la. */
export interface EntregaAtiva {
  id: string;
  funcionario_id: string;
  epi_id: string;
  tipo: string;
  status: string;
  empresa_id?: string | null;
}

/**
 * A entrega que a nova substitui, se existir.
 *
 * Só entrega ativa do mesmo colaborador e do mesmo EPI. Devolução nunca
 * entra: devolução já está encerrada, e marcá-la como substituída
 * apagaria o histórico de que o EPI tinha voltado.
 */
export function entregaAtivaParaSubstituir<T extends EntregaAtiva>(
  historico: T[],
  funcionarioId: string,
  epiIdNoBanco: string,
): T | null {
  return (
    historico.find(
      (e) =>
        e.funcionario_id === funcionarioId &&
        e.epi_id === epiIdNoBanco &&
        e.status === "ativo" &&
        e.tipo !== "devolucao",
    ) || null
  );
}

/**
 * O descarte automático de quando o EPI novo substitui o antigo.
 *
 * O EPI antigo não volta ao estoque: ele foi substituído porque acabou,
 * rasgou ou venceu. Por isso a devolução entra com quantidade ZERO, do
 * mesmo jeito que o descarte manual — e grava a mesma trilha de
 * auditoria, para que o estorno consiga ler os dois.
 */
export function descarteDaSubstituicao(entrada: {
  entregaAntiga: EntregaAtiva;
  /** Data da entrega nova, que é quando a troca aconteceu. */
  data: string;
  /** Quem está processando, para a trilha. */
  operador?: string | null;
  /** O que o técnico escreveu sobre o estado do item antigo. */
  descricaoDoEstado?: string;
  empresaId?: string | null;
  usuarioId?: string | null;
}) {
  const { entregaAntiga } = entrada;

  const observacao = [
    `Descarte automático por substituição em ${entrada.data}`,
    `Entrega origem: ${entregaAntiga.id}`,
    `Status anterior: ${entregaAntiga.status}`,
    `Processado por: ${entrada.operador || "usuário autenticado"}`,
    "[DESCARTE/AVARIA - não retornado ao estoque]",
    entrada.descricaoDoEstado?.trim()
      ? `Estado: ${entrada.descricaoDoEstado.trim()}`
      : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return {
    registro: {
      funcionario_id: entregaAntiga.funcionario_id,
      epi_id: entregaAntiga.epi_id,
      quantidade: 0,
      data: entrada.data,
      tipo: "devolucao" as const,
      status: "devolvido" as const,
      observacao,
      empresa_id: entregaAntiga.empresa_id || entrada.empresaId || null,
      created_by: entrada.usuarioId ?? null,
    },
    /**
     * O antigo fica "substituido", não "devolvido": o colaborador não
     * devolveu nada, ele trocou. É essa diferença que a ficha mostra.
     */
    statusDaEntregaAntiga: "substituido" as const,
  };
}
