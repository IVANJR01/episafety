import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { resolveCors } from "../_shared/cors.ts";
import { checkRateLimit, clientKey } from "../_shared/rateLimit.ts";
import { listarTemplatesAprovados } from "../_shared/whatsapp.ts";

/**
 * Os templates aprovados da empresa, para a tela poder oferecer um.
 *
 * Por que uma function e não uma consulta direta do navegador à Meta: a
 * listagem exige o mesmo token permanente que envia mensagem em nome da
 * empresa. Ele não vai para o front.
 *
 * Por que não guardar os templates numa tabela: template é aprovado, pausado e
 * reprovado dentro da Meta, sem avisar ninguém. Uma cópia aqui envelheceria em
 * silêncio, e o sintoma seria a tela oferecer um template que a Meta recusa na
 * hora do envio. A tela cacheia por alguns minutos, que é o suficiente.
 */

function json(dados: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const corsHeaders = resolveCors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const autorizacao = req.headers.get("Authorization") ?? "";
  if (!autorizacao) return json({ error: "Não autenticado" }, 401, corsHeaders);

  // Mesmo arranjo da whatsapp-enviar: o JWT de quem chamou, e o RLS decide qual
  // linha ele enxerga. Uma empresa não lista os templates da outra.
  const comoUsuario = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: autorizacao } }, auth: { persistSession: false } },
  );

  const { data: auth } = await comoUsuario.auth.getUser();
  const usuario = auth?.user;
  if (!usuario) return json({ error: "Não autenticado" }, 401, corsHeaders);

  // A listagem bate na Meta a cada chamada; o limite existe para a tela aberta
  // em cinco abas não virar cinco vezes o tráfego lá.
  const passou = await checkRateLimit({
    key: clientKey(req, usuario.id, "whatsapp-templates"),
    limit: 30,
    windowSeconds: 60,
  });
  if (!passou) return json({ error: "Muitas consultas seguidas. Aguarde um instante." }, 429, corsHeaders);

  const { data: config } = await comoUsuario
    .from("whatsapp_config")
    .select("waba_id")
    .limit(1)
    .maybeSingle();

  // O secret é a saída para quem tem uma empresa só e não quer preencher a
  // coluna; a coluna ganha dele porque é por empresa.
  const wabaId = (config as { waba_id: string | null } | null)?.waba_id
    || Deno.env.get("WHATSAPP_WABA_ID")
    || "";

  if (!wabaId) {
    return json(
      {
        error: "waba_nao_configurado",
        detalhe:
          "Falta o identificador da conta do WhatsApp Business (WABA) da empresa. " +
          "Ele aparece no painel da Meta, em WhatsApp → Configuração da API, e se preenche na configuração da linha.",
      },
      400,
      corsHeaders,
    );
  }

  try {
    const templates = await listarTemplatesAprovados(wabaId);
    return json({ templates }, 200, corsHeaders);
  } catch (e) {
    console.error("[whatsapp-templates] falha ao listar", e);
    return json({ error: (e as Error).message || "Falha ao consultar a Meta" }, 502, corsHeaders);
  }
});
