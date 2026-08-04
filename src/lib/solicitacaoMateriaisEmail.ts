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

/** Frouxa de propósito: só o suficiente para pegar erro de digitação. */
const FORMATO_EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/**
 * Lê o campo "E-mails para Compras" como uma LISTA.
 *
 * O campo é um TEXT livre e aceita vírgula, ponto e vírgula, espaço ou quebra
 * de linha como separador — quem preenche copia de onde tiver e cola.
 *
 * Devolve os inválidos separados em vez de descartá-los em silêncio: é o que
 * permite a tela de configuração avisar na hora. Endereço repetido sai uma vez
 * só (comparando sem diferenciar maiúsculas), senão a pessoa recebe duas
 * cópias do mesmo email.
 */
export function separarEmails(texto?: string | null): { validos: string[]; invalidos: string[] } {
  const partes = (texto || "").split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean);
  const validos: string[] = [];
  const invalidos: string[] = [];
  const vistos = new Set<string>();
  for (const p of partes) {
    if (!FORMATO_EMAIL.test(p)) { invalidos.push(p); continue; }
    const chave = p.toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    validos.push(p);
  }
  return { validos, invalidos };
}

/**
 * Busca os emails do setor de compras da empresa, em ordem de preferência:
 * 1. Campo dedicado de emails para compras na empresa_config (pode ter vários)
 * 2. Email principal da empresa
 * 3. Email do usuário principal
 */
async function obterEmailsCompras(empresaId: string): Promise<string[]> {
  try {
    const { data: empresa } = await supabase
      .from("empresa_config")
      .select("email_compras, email")
      .eq("id", empresaId)
      .maybeSingle();

    const dedicados = separarEmails(empresa?.email_compras).validos;
    if (dedicados.length) return dedicados;

    const daEmpresa = separarEmails(empresa?.email).validos;
    if (daEmpresa.length) return daEmpresa;

    const { data: users } = await supabase
      .from("user_profiles")
      .select("email")
      .eq("empresa_id", empresaId)
      .eq("role", "principal")
      .limit(1);

    return separarEmails(users?.[0]?.email).validos;
  } catch (error) {
    console.error("[solicitacao] Erro ao buscar emails de compras:", error);
    return [];
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
  /** Todos os endereços que receberam (ou receberiam) o email. */
  destinatarios?: string[];
  /** Resumo legível dos destinatários, para mensagem de tela. */
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
    const emailsCompras = await obterEmailsCompras(empresaId);
    if (!emailsCompras.length) {
      console.warn("[solicitacao] Nenhum email de compras encontrado para a empresa");
      return { enviado: false, modoDebug: false, erro: "Nenhum email de compras configurado para a empresa" };
    }
    const emailCompras = emailsCompras.length === 1
      ? emailsCompras[0]
      : `${emailsCompras[0]} e mais ${emailsCompras.length - 1}`;

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

    // Token de aprovação/recusa sem login: quem recebe o email pode não ter
    // (e nunca ter) usuário no sistema. Gera um token novo a cada envio —
    // links de emails anteriores deixam de funcionar, e a decisão só é
    // aceita enquanto o status ainda for "enviada" (checado no banco).
    let tokenPublico: string | undefined;
    try {
      tokenPublico = crypto.randomUUID();
      const expiraEm = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await (supabase.from as any)("solicitacoes_materiais")
        .update({ token_publico: tokenPublico, token_publico_expira_em: expiraEm, token_publico_usado_em: null })
        .eq("id", solicitacaoId);
    } catch (e) {
      console.warn("[solicitacao] Não foi possível gerar o link de aprovação sem login:", e);
    }

    // A Edge Function repassa `email` direto como `to` da Resend, e a Resend
    // aceita lista — então dá para notificar várias pessoas sem reimplantar
    // nada. Com um destinatário só, continua indo string: preservar exatamente
    // a chamada que já funciona evita que um ajuste de vários endereços quebre
    // quem tem um, caso a função implantada esteja atrás deste repositório.
    const { data, error } = await supabase.functions.invoke("send-purchase-email", {
      body: {
        solicitacao: solicitacaoData,
        email: emailsCompras.length === 1 ? emailsCompras[0] : emailsCompras,
        pdfBase64, pdfFilename, tokenPublico,
      },
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
      return { enviado: false, modoDebug: false, emailDestino: emailCompras, destinatarios: emailsCompras, erro: detalhe };
    }

    const modoDebug = !!(data && typeof data.message === "string" && data.message.toLowerCase().includes("debug"));
    if (modoDebug) {
      console.warn("[solicitacao] Email NÃO enviado de verdade — Edge Function está em modo debug (RESEND_API_KEY ausente). Destino:", emailCompras);
    } else {
      console.log("[solicitacao] Email enviado com sucesso para:", emailCompras);
    }
    return { enviado: !modoDebug, modoDebug, emailDestino: emailCompras, destinatarios: emailsCompras };
  } catch (error: any) {
    console.error("[solicitacao] Erro ao preparar envio de email:", error);
    return { enviado: false, modoDebug: false, erro: error?.message || String(error) };
  }
}
