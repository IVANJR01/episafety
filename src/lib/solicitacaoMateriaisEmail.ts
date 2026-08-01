import { supabase } from "@/integrations/supabase/client";
import { carregarDadosPdfSolicitacao } from "@/lib/solicitacaoMateriaisPdfData";
import { gerarSolicitacaoPdfBase64 } from "@/lib/solicitacaoMateriaisPdf";

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

export interface ResultadoEnvioEmail {
  /** true somente quando o email foi de fato enviado (não em modo debug) */
  enviado: boolean;
  /** true quando a Edge Function respondeu em modo debug (sem RESEND_API_KEY) */
  modoDebug: boolean;
  emailDestino?: string;
  erro?: string;
}

/**
 * Envia email de notificação quando uma solicitação é enviada.
 * Não lança exceção: o chamador sempre recebe um resultado, mesmo em falha,
 * para não interromper o fluxo principal (salvar/enviar solicitação).
 * Use o campo `enviado`/`erro` do retorno para saber o que de fato aconteceu —
 * a Edge Function pode responder "sucesso" em modo debug sem enviar nada.
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
): Promise<ResultadoEnvioEmail> {
  try {
    const emailCompras = await obterEmailCompras(empresaId);
    if (!emailCompras) {
      console.warn("[solicitacao] Nenhum email de compras encontrado para a empresa");
      return { enviado: false, modoDebug: false, erro: "Nenhum email de compras configurado para a empresa" };
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

    // Anexa o PDF da solicitação para quem recebe o email não precisar entrar
    // no sistema. Se a geração falhar por qualquer motivo, o email ainda sai,
    // só que sem anexo — não vale travar a notificação por causa do PDF.
    let pdfBase64: string | undefined;
    let pdfFilename: string | undefined;
    try {
      const dadosPdf = await carregarDadosPdfSolicitacao(solicitacaoId, empresaId);
      if (dadosPdf) {
        const gerado = gerarSolicitacaoPdfBase64(dadosPdf);
        pdfBase64 = gerado.base64;
        pdfFilename = gerado.filename;
      }
    } catch (e) {
      console.warn("[solicitacao] Não foi possível anexar o PDF ao email:", e);
    }

    const { data, error } = await supabase.functions.invoke("send-purchase-email", {
      body: { solicitacao: solicitacaoData, email: emailCompras, pdfBase64, pdfFilename },
    });

    if (error) {
      // supabase-js só coloca "Edge Function returned a non-2xx status code" em
      // error.message — o motivo real (ex.: erro da Resend) vem no corpo da
      // resposta, acessível via error.context, um Response.
      let detalhe = error.message;
      try {
        const body = await error.context?.clone().json();
        if (body?.error) detalhe = body.error;
      } catch {
        try {
          const texto = await error.context?.clone().text();
          if (texto) detalhe = texto;
        } catch { /* mantém error.message */ }
      }
      console.error("[solicitacao] Erro ao enviar email:", detalhe, error);
      return { enviado: false, modoDebug: false, emailDestino: emailCompras, erro: detalhe };
    }

    const modoDebug = !!(data && typeof data.message === "string" && data.message.toLowerCase().includes("debug"));
    if (modoDebug) {
      console.warn("[solicitacao] Email NÃO enviado de verdade — Edge Function está em modo debug (RESEND_API_KEY ausente). Destino:", emailCompras);
    } else {
      console.log("[solicitacao] Email enviado com sucesso para:", emailCompras);
    }
    return { enviado: !modoDebug, modoDebug, emailDestino: emailCompras };
  } catch (error: any) {
    console.error("[solicitacao] Erro ao preparar envio de email:", error);
    return { enviado: false, modoDebug: false, erro: error?.message || String(error) };
  }
}
