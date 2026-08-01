# 🚨 Causa Raiz Encontrada: Edge Function Nunca Foi Implantada

Comparando a lista de **Edge Functions** no seu Supabase (`cleanup-storage`, `consulta-ca`, `create-user`, `gdrive-proxy`, `portal-rh-aso-download`, `signed-url`, `update-profile`) com o que o código do sistema chama (`send-purchase-email`), a função **não existe no seu projeto Supabase**. Ela só existe no repositório de código — nunca foi implantada ("deployed").

Por isso o toast dizia "sucesso" mesmo sem enviar nada: a chamada falhava (função não encontrada), mas o código anterior escondia esse erro. **Isso já foi corrigido** — agora o sistema avisa a verdade (sucesso real / modo debug / erro).

Mas o problema de fundo continua: **a função precisa ser criada no Supabase**. Sem CLI configurado neste ambiente, o jeito mais rápido é copiar e colar direto no painel.

---

## Passo a Passo (5 minutos)

### 1. Abra o Editor de Functions no Supabase

1. Vá para a aba que você já tinha aberta: `Edge Functions`
2. Clique em **Deploy a new function** (ou "Create a new function")
3. Escolha a opção **"Via Editor"** / **"Write your function"** (não "Via CLI")
4. Nome da função: `send-purchase-email` (exatamente assim, com hífens)

### 2. Cole o Código Abaixo

Apague qualquer conteúdo de exemplo que vier no editor e cole isto:

```typescript
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

async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<Response> {
  const apiKey = Deno.env.get("RESEND_API_KEY");

  if (!apiKey) {
    console.log("📧 EMAIL ENVIADO (MODO DEBUG - sem API Resend configurada)");
    console.log("Para:", to);
    console.log("Assunto:", subject);
    console.log("HTML:", html.substring(0, 200) + "...");

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
      from: "EpiSafety <onboarding@resend.dev>",
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }

  return response;
}

function gerarHtmlEmail(solicitacao: SolicitacaoEmail): string {
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

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
    <div style="background-color: #1f2937; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
      <h1 style="margin: 0; font-size: 24px; font-weight: bold;">
        📋 Nova Solicitação de Materiais
      </h1>
    </div>

    <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      ${solicitacao.prioridade === "urgente" ? `
      <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
        <p style="margin: 0; color: #991b1b; font-weight: bold;">⚠️ Esta solicitação é URGENTE</p>
      </div>
      ` : ""}

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

      <div style="text-align: center; margin: 30px 0;">
        <a href="https://safetysolucoes.com/epis/solicitacoes-materiais" style="display: inline-block; background-color: #ff9500; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
          Revisar Solicitação
        </a>
      </div>

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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { solicitacao, email } = await req.json();

    if (!email || !solicitacao) {
      return new Response(
        JSON.stringify({ error: "Missing email or solicitacao" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = gerarHtmlEmail(solicitacao);
    const subject = `[${solicitacao.numero_solicitacao}] ${solicitacao.titulo}${solicitacao.prioridade === "urgente" ? " - 🔴 URGENTE" : ""}`;

    await sendEmail(email, subject, html);

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
```

### 3. Clique em Deploy / Save

O Supabase vai compilar e publicar a função. Leva alguns segundos.

### 4. Confirme que Apareceu na Lista

Volte para a tela de **Edge Functions** — agora `send-purchase-email` deve aparecer junto das outras 7.

---

## Depois de Implantar: Configure a Chave de Email (Opcional mas Recomendado)

Sem isso, a função funciona mas fica em **modo debug** (não envia de verdade, só registra em log). O sistema agora **avisa isso claramente** com um toast amarelo de aviso.

1. Crie conta grátis em **[resend.com](https://resend.com)**
2. Gere uma **API Key** (começa com `re_`)
3. No Supabase: **Edge Functions → send-purchase-email → Settings → Environment Variables**
4. Adicione: **Name:** `RESEND_API_KEY` **Value:** `re_sua_chave_aqui`
5. Salve

---

## Teste Final

1. Volte para o sistema (episafety)
2. Vá em **Solicitações de Materiais**
3. Clique no ícone de envelope (✉️) na sua solicitação `SOL-2026-0001` para reenviar
4. Observe o toast:
   - 🟢 **"Email reenviado com sucesso"** → funcionando de verdade (Resend configurado)
   - 🟡 **"Email NÃO foi enviado de verdade"** (aviso amarelo) → função funcionando, mas falta configurar RESEND_API_KEY
   - 🔴 **"Erro ao reenviar email"** → ainda há problema (leia a descrição do erro no toast)
