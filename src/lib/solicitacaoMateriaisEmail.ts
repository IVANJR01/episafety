import { supabase } from "@/integrations/supabase/client";

interface SolicitacaoEmailData {
  solicitacao_id: string;
  numero_solicitacao: string;
  titulo: string;
  empresa_id: string;
  empresa_nome?: string;
  setor?: string;
  solicitante_nome?: string;
  prioridade: string;
  data_necessidade?: string;
  itens_count: number;
}

/**
 * Busca o email do setor de compras (ou admin) da empresa.
 * Prioridade:
 * 1. Campo dedicado de email para compras na empresa_config
 * 2. Email do usuário principal da empresa
 * 3. Email de fallback (se não encontrar nada)
 */
async function obterEmailCompras(empresaId: string): Promise<string | null> {
  try {
    // Tenta buscar email de compras direto da empresa_config
    const { data: empresa } = await supabase
      .from("empresa_config")
      .select("email_compras, email")
      .eq("id", empresaId)
      .maybeSingle();

    if (empresa?.email_compras) {
      return empresa.email_compras;
    }

    if (empresa?.email) {
      return empresa.email;
    }

    // Se não encontrou, tenta buscar email do usuário principal
    const { data: users } = await supabase
      .from("user_profiles")
      .select("email")
      .eq("empresa_id", empresaId)
      .eq("role", "principal")
      .limit(1);

    if (users && users.length > 0) {
      return users[0].email;
    }

    return null;
  } catch (error) {
    console.error("[solicitacao] Erro ao buscar email de compras:", error);
    return null;
  }
}

/**
 * Obtém a contagem de itens da solicitação
 */
async function obterContagemItens(solicitacaoId: string): Promise<number> {
  try {
    const { count } = await supabase
      .from("solicitacoes_materiais_itens")
      .select("*", { count: "exact", head: true })
      .eq("solicitacao_id", solicitacaoId);
    return count || 0;
  } catch {
    return 0;
  }
}

/**
 * Envia email de notificação quando uma solicitação é enviada.
 * Executa de forma assíncrona sem bloquear a operação principal.
 */
export async function enviarEmailSolicitacao(
  solicitacaoId: string,
  numeroSolicitacao: string,
  titulo: string,
  empresaId: string,
  empresaNome?: string,
  setor?: string,
  solicitanteNome?: string,
  prioridade: string = "normal",
  dataNecessidade?: string
): Promise<void> {
  try {
    const emailCompras = await obterEmailCompras(empresaId);
    if (!emailCompras) {
      console.warn("[solicitacao] Nenhum email de compras encontrado para a empresa");
      return;
    }

    const itensCount = await obterContagemItens(solicitacaoId);

    const solicitacaoData: SolicitacaoEmailData = {
      solicitacao_id: solicitacaoId,
      numero_solicitacao: numeroSolicitacao,
      titulo,
      empresa_id: empresaId,
      empresa_nome: empresaNome,
      setor,
      solicitante_nome: solicitanteNome,
      prioridade,
      data_necessidade: dataNecessidade,
      itens_count: itensCount,
    };

    // Chama a Edge Function para enviar o email
    // Executamos de forma assíncrona (sem await) para não bloquear a UI
    const { error } = await supabase.functions.invoke("send-purchase-email", {
      body: { solicitacao: solicitacaoData, email: emailCompras },
    });

    if (error) {
      console.error("[solicitacao] Erro ao enviar email:", error);
      // Não lançamos erro aqui para não interromper a operação principal
    } else {
      console.log("[solicitacao] Email enviado com sucesso para:", emailCompras);
    }
  } catch (error) {
    console.error("[solicitacao] Erro ao preparar envio de email:", error);
    // Não lançamos erro aqui para não interromper a operação principal
  }
}
