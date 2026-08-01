import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SolicitacaoEmail {
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

interface EmailPayload {
  solicitacao: SolicitacaoEmail;
  email: string;
  pdfBase64?: string;
  pdfFilename?: string;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  attachment?: { filename: string; base64: string }
): Promise<Response> {
  const apiKey = Deno.env.get("RESEND_API_KEY");

  // Se não tiver chave de Resend, registra em log (modo debug)
  if (!apiKey) {
    console.log("📧 EMAIL ENVIADO (MODO DEBUG - sem API Resend configurada)");
    console.log("Para:", to);
    console.log("Assunto:", subject);
    console.log("HTML:", html.substring(0, 200) + "...");
    console.log("Anexo:", attachment ? attachment.filename : "(nenhum)");

    // Retorna sucesso mesmo sem enviar (para testes)
    return new Response(
      JSON.stringify({
        success: true,
        message: "Email registrado em log (modo debug)",
        to,
        subject,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // Domínio de teste da própria Resend: funciona sem verificação de DNS,
      // mas só entrega para o e-mail do dono da conta Resend enquanto nenhum
      // domínio próprio for verificado. Trocar para um endereço @seudominio
      // depois de verificar o domínio em resend.com/domains.
      from: "EpiSafety <onboarding@resend.dev>",
      to,
      subject,
      html,
      attachments: attachment
        ? [{ filename: attachment.filename, content: attachment.base64 }]
        : undefined,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }

  return response;
}

function gerarHtmlEmail(solicitacao: SolicitacaoEmail, temAnexo: boolean): string {
  const prioridades: Record<string, string> = {
    baixa: "Baixa",
    normal: "Normal",
    alta: "Alta 🔶",
    urgente: "Urgente 🔴",
  };

  const priorityClass = solicitacao.prioridade === "urgente" ? "color: #dc2626;" : "color: #ff9800;";
  const dataFormatada = solicitacao.data_necessidade
    ? new Date(solicitacao.data_necessidade).toLocaleDateString("pt-BR")
    : "Não especificado";
  // Abre o modal de Aprovar/Recusar direto nessa solicitação — exige login,
  // a decisão em si é sempre tomada dentro do sistema.
  const linkAprovacao = `https://safetysolucoes.com/epis/solicitacoes-materiais?empresa_id=${solicitacao.empresa_id}&aprovar=${solicitacao.solicitacao_id}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
    <!-- Header -->
    <div style="background-color: #1f2937; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
      <h1 style="margin: 0; font-size: 24px; font-weight: bold;">
        📋 Nova Solicitação de Materiais
      </h1>
    </div>

    <!-- Content -->
    <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <!-- Alert if urgent -->
      ${solicitacao.prioridade === "urgente" ? `
      <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
        <p style="margin: 0; color: #991b1b; font-weight: bold;">⚠️ Esta solicitação é URGENTE</p>
      </div>
      ` : ""}

      <!-- Info Box -->
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #d1d5db;">
              <span style="font-weight: bold; color: #374151;">Número:</span>
            </td>
            <td style="padding: 10px 0; border-bottom: 1px solid #d1d5db; text-align: right;">
              <span style="color: #111827; font-size: 14px;">${solicitacao.numero_solicitacao}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #d1d5db;">
              <span style="font-weight: bold; color: #374151;">Título:</span>
            </td>
            <td style="padding: 10px 0; border-bottom: 1px solid #d1d5db; text-align: right;">
              <span style="color: #111827; font-size: 14px;">${solicitacao.titulo}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #d1d5db;">
              <span style="font-weight: bold; color: #374151;">Empresa:</span>
            </td>
            <td style="padding: 10px 0; border-bottom: 1px solid #d1d5db; text-align: right;">
              <span style="color: #111827; font-size: 14px;">${solicitacao.empresa_nome || "—"}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #d1d5db;">
              <span style="font-weight: bold; color: #374151;">Setor:</span>
            </td>
            <td style="padding: 10px 0; border-bottom: 1px solid #d1d5db; text-align: right;">
              <span style="color: #111827; font-size: 14px;">${solicitacao.setor || "—"}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #d1d5db;">
              <span style="font-weight: bold; color: #374151;">Solicitante:</span>
            </td>
            <td style="padding: 10px 0; border-bottom: 1px solid #d1d5db; text-align: right;">
              <span style="color: #111827; font-size: 14px;">${solicitacao.solicitante_nome || "—"}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #d1d5db;">
              <span style="font-weight: bold; color: #374151;">Necessário até:</span>
            </td>
            <td style="padding: 10px 0; border-bottom: 1px solid #d1d5db; text-align: right;">
              <span style="color: #111827; font-size: 14px;">${dataFormatada}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0;">
              <span style="font-weight: bold; color: #374151;">Prioridade:</span>
            </td>
            <td style="padding: 10px 0; text-align: right;">
              <span style="${priorityClass} font-weight: bold; font-size: 14px;">${prioridades[solicitacao.prioridade] || solicitacao.prioridade}</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Items Summary -->
      <div style="margin-bottom: 25px;">
        <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 16px; font-weight: bold;">
          📦 Itens Solicitados
        </h3>
        <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; border-radius: 4px;">
          <p style="margin: 0; color: #166534; font-size: 14px;">
            <strong>${solicitacao.itens_count} item${solicitacao.itens_count !== 1 ? "ns" : ""}</strong> na lista de compra
          </p>
        </div>
      </div>

      ${temAnexo ? `
      <div style="margin-bottom: 25px; text-align: center;">
        <p style="margin: 0; color: #374151; font-size: 13px;">
          📎 O PDF completo desta solicitação está anexado a este email.
        </p>
      </div>
      ` : ""}

      <!-- CTA Buttons: Aprovar / Recusar levam ao mesmo modal no sistema —
           a decisão final é sempre tomada lá dentro, com login, nunca só pelo
           clique no email. -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="${linkAprovacao}" style="display: inline-block; background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; margin: 0 6px 10px;">
          ✅ Aprovar
        </a>
        <a href="${linkAprovacao}" style="display: inline-block; background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; margin: 0 6px 10px;">
          ❌ Recusar
        </a>
        <div style="margin-top: 6px;">
          <a href="${linkAprovacao}" style="color: #6b7280; font-size: 12px; text-decoration: underline;">
            Ver solicitação completa no sistema
          </a>
        </div>
      </div>

      <!-- Footer -->
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
        <p style="margin: 0 0 5px 0;">
          EpisaFety - Sistema de Gestão de Segurança Ocupacional
        </p>
        <p style="margin: 0;">
          Essa é uma notificação automática. Por favor não responda este email.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { solicitacao, email, pdfBase64, pdfFilename }: EmailPayload = await req.json();

    if (!email || !solicitacao) {
      return new Response(
        JSON.stringify({ error: "Missing email or solicitacao" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anexo = pdfBase64 && pdfFilename ? { filename: pdfFilename, base64: pdfBase64 } : undefined;
    const html = gerarHtmlEmail(solicitacao, !!anexo);
    const subject = `[${solicitacao.numero_solicitacao}] ${solicitacao.titulo}${solicitacao.prioridade === "urgente" ? " - 🔴 URGENTE" : ""}`;

    await sendEmail(email, subject, html, anexo);

    return new Response(
      JSON.stringify({ success: true, message: "Email enviado com sucesso" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
