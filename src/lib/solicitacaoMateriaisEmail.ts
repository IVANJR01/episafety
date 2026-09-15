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

    // O usuário principal é marcado em usuarios_liberados.is_principal — a
    // mesma fonte que o AuthContext consulta. Não existe tabela
    // "user_profiles", nem o papel "principal" em app_role.
    const { data: users } = await supabase
      .from("usuarios_liberados")
      .select("email")
      .eq("empresa_id", empresaId)
      .eq("is_principal", true)
      .eq("ativo", true)
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

/**
 * Traduz os erros conhecidos da Resend para algo acionável.
 *
 * O texto cru chega em inglês, embrulhado em JSON, e vai parar no rodapé de
 * um toast. Quem lê não tem como adivinhar que o problema está na CONTA de
 * email — não na solicitação, nem nos endereços que acabou de cadastrar.
 */
function traduzirErroEnvio(detalhe: string): string {
  const t = (detalhe || "").toLowerCase();
  if (t.includes("you can only send testing emails")) {
    return "O envio para múltiplos endereços ainda não foi liberado no sistema: a conta de email está em modo de teste e recusa o lote inteiro quando há mais de um destinatário. "
      + "É uma configuração única do produto (verificar safetysolucoes.com em resend.com/domains e definir RESEND_FROM no Supabase) — vale para todas as empresas de uma vez, não precisa ser feita por empresa.";
  }
  if (t.includes("not verified") || t.includes("domain is not verified")) {
    return "O domínio do remetente do sistema não está verificado na conta de email. Verifique safetysolucoes.com em resend.com/domains — uma vez só, vale para todas as empresas.";
  }
  return detalhe;
}

/**
 * O endereço que a conta em modo de teste tem permissão de receber. A Resend
 * o cita entre parênteses no próprio 403 ("...to your own email address
 * (fulano@gmail.com)"), que é como dá para reenviar sem pedir nada a ninguém.
 */
function enderecoLiberadoNoErro(detalhe: string): string | null {
  if (!/you can only send testing emails/i.test(detalhe || "")) return null;
  const m = detalhe.match(/\(([^()\s]+@[^()\s]+)\)/);
  return m ? m[1] : null;
}

/** "a@x.com" ou "a@x.com e mais 3" — cabe em mensagem de tela. */
function resumoDestinatarios(lista: string[]): string {
  if (lista.length === 0) return "";
  return lista.length === 1 ? lista[0] : `${lista[0]} e mais ${lista.length - 1}`;
}

export interface ResultadoEnvioEmail {
  /** true somente quando o email foi de fato enviado (não em modo debug) */
  enviado: boolean;
  /** true quando a Edge Function respondeu em modo debug (sem RESEND_API_KEY) */
  modoDebug: boolean;
  /** Endereços que de fato receberam (ou receberiam, em modo debug). */
  destinatarios?: string[];
  /** Cadastrados que ficaram de fora — hoje, por limite da conta de email. */
  naoEntregues?: string[];
  /** Explicação do que ficou faltando, quando o envio saiu incompleto. */
  aviso?: string;
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
    // Todas as empresas clientes compartilham o mesmo remetente (é o domínio do
    // produto que fica verificado, não o de cada cliente). Sem reply-to, um
    // "responder" do setor de compras cairia numa caixa que ninguém lê; com
    // ele, a resposta volta para quem pediu o material.
    let replyTo: string | undefined;
    try {
      const { data: auth } = await supabase.auth.getUser();
      replyTo = auth?.user?.email || undefined;
    } catch { /* sem reply-to o email ainda sai */ }

    const enviarPara = async (para: string | string[]) => {
      const { data, error } = await supabase.functions.invoke("send-purchase-email", {
        body: { solicitacao: solicitacaoData, email: para, pdfBase64, pdfFilename, tokenPublico, replyTo },
      });
      if (!error) return { data, detalhe: null as string | null };
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
      return { data: null, detalhe };
    };

    let entregues = emailsCompras;
    let naoEntregues: string[] = [];
    let { data, detalhe } = await enviarPara(
      emailsCompras.length === 1 ? emailsCompras[0] : emailsCompras,
    );

    /**
     * Conta de email em modo de teste: a Resend recusa o lote INTEIRO quando
     * há qualquer endereço além do dono da conta — e aí ninguém é avisado da
     * solicitação, nem o próprio dono, que receberia normalmente se estivesse
     * sozinho na lista. Perder a notificação toda é o pior desfecho possível.
     *
     * O endereço liberado vem citado no próprio erro. Reenvia só para ele e
     * devolve quem ficou de fora, para a tela dizer exatamente quem não
     * recebeu — degradar avisando é diferente de degradar em silêncio.
     */
    const donoDaConta = detalhe ? enderecoLiberadoNoErro(detalhe) : null;
    if (donoDaConta && emailsCompras.length > 1) {
      console.warn("[solicitacao] Conta Resend em modo de teste; reenviando só para", donoDaConta);
      const segunda = await enviarPara(donoDaConta);
      if (!segunda.detalhe) {
        data = segunda.data;
        detalhe = null;
        entregues = [donoDaConta];
        naoEntregues = emailsCompras.filter((e) => e.toLowerCase() !== donoDaConta.toLowerCase());
      }
    }

    if (detalhe) {
      console.error("[solicitacao] Erro ao enviar email:", detalhe);
      return {
        enviado: false, modoDebug: false, emailDestino: resumoDestinatarios(emailsCompras),
        destinatarios: emailsCompras, erro: traduzirErroEnvio(detalhe),
      };
    }

    const modoDebug = !!(data && typeof data.message === "string" && data.message.toLowerCase().includes("debug"));
    const resumo = resumoDestinatarios(entregues);
    if (modoDebug) {
      console.warn("[solicitacao] Email NÃO enviado de verdade — Edge Function está em modo debug (RESEND_API_KEY ausente). Destino:", resumo);
    } else {
      console.log("[solicitacao] Email enviado com sucesso para:", entregues.join(", "));
    }
    return {
      enviado: !modoDebug, modoDebug, emailDestino: resumo, destinatarios: entregues,
      naoEntregues: naoEntregues.length ? naoEntregues : undefined,
      aviso: naoEntregues.length
        ? `A conta de email ainda está em modo de teste e só entrega para ${donoDaConta}. `
          + `Não receberam: ${naoEntregues.join(", ")}. `
          + `Para liberar os demais, verifique um domínio em resend.com/domains e defina o secret RESEND_FROM no Supabase.`
        : undefined,
    };
  } catch (error: any) {
    console.error("[solicitacao] Erro ao preparar envio de email:", error);
    return { enviado: false, modoDebug: false, erro: error?.message || String(error) };
  }
}
