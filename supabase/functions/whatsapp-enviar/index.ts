import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { resolveCors } from "../_shared/cors.ts";
import { checkRateLimit, clientKey } from "../_shared/rateLimit.ts";
import {
  apenasDigitos,
  dentroDaJanela24h,
  enviarTemplate,
  enviarTexto,
  variantesBrasil,
  type ParametroTemplate,
} from "../_shared/whatsapp.ts";

/**
 * Envio de WhatsApp a partir do sistema.
 *
 * É o outro lado do `whatsapp-webhook`: serve para a tela de atendimento
 * responder um cliente, e para o sistema avisar de documento vencendo pelo
 * WhatsApp em vez de e-mail.
 *
 * Por que a function e não a API da Meta direto do navegador: o token da Meta
 * é permanente e dá acesso a mandar mensagem em nome da empresa. Ele não pode
 * ir para o front em hipótese nenhuma.
 *
 * A REGRA DAS 24 HORAS, que é onde todo mundo tropeça: a Meta só deixa mandar
 * texto livre até 24h depois da última mensagem DA PESSOA. Passou disso, só
 * template aprovado por ela, e a tentativa de texto livre volta como erro
 * cobrado em tentativa. Por isso esta function checa a janela antes de gastar
 * a chamada, e diz na resposta o que fazer.
 */

interface Corpo {
  /** Número do destinatário, em qualquer formato. Ignorado se vier contato_id. */
  telefone?: string;
  contato_id?: string;
  texto?: string;
  /**
   * Fora da janela de 24h, o template é obrigatório.
   *
   * `corpo` e `cabecalho` são a forma completa, que aceita marcador nomeado.
   * `parametros` continua aceito para o corpo com marcador numerado — é o que
   * uma chamada antiga manda, e quebrá-la não traria nada.
   */
  template?: {
    nome: string;
    idioma?: string;
    parametros?: string[];
    corpo?: ParametroTemplate[];
    cabecalho?: ParametroTemplate[];
  };
}

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function json(dados: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const corsHeaders = resolveCors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405, corsHeaders);

  const autorizacao = req.headers.get("Authorization") ?? "";
  if (!autorizacao) return json({ error: "Não autenticado" }, 401, corsHeaders);

  // Cliente com o JWT de quem chamou: o RLS decide qual empresa ele enxerga.
  // É assim que uma empresa não manda mensagem pela linha da outra — a regra
  // fica no banco, não numa conferência escrita aqui e esquecida depois.
  const comoUsuario = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: autorizacao } }, auth: { persistSession: false } },
  );

  const { data: auth } = await comoUsuario.auth.getUser();
  const usuario = auth?.user;
  if (!usuario) return json({ error: "Não autenticado" }, 401, corsHeaders);

  const passou = await checkRateLimit({
    key: clientKey(req, usuario.id, "whatsapp-enviar"),
    limit: 60,
    windowSeconds: 60,
  });
  if (!passou) return json({ error: "Muitos envios seguidos. Aguarde um instante." }, 429, corsHeaders);

  let corpo: Corpo;
  try {
    corpo = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400, corsHeaders);
  }

  const { data: config } = await comoUsuario
    .from("whatsapp_config")
    .select("id, empresa_id, phone_number_id")
    .limit(1)
    .maybeSingle();

  if (!config) {
    return json(
      { error: "Esta empresa não tem linha de WhatsApp configurada. Cadastre o phone_number_id em whatsapp_config." },
      400,
      corsHeaders,
    );
  }
  const cfg = config as { empresa_id: string; phone_number_id: string };

  // ---- destinatário ----
  interface ContatoLinha {
    id: string;
    wa_id: string;
    empresa_id: string;
    ultima_entrada_em: string | null;
  }
  let contato: ContatoLinha | null = null;

  if (corpo.contato_id) {
    const { data } = await admin
      .from("whatsapp_contatos")
      .select("id, wa_id, empresa_id, ultima_entrada_em")
      .eq("id", corpo.contato_id)
      .eq("empresa_id", cfg.empresa_id)
      .maybeSingle();
    contato = data as ContatoLinha | null;
    if (!contato) return json({ error: "Contato não encontrado nesta empresa." }, 404, corsHeaders);
  } else {
    const digitos = apenasDigitos(corpo.telefone ?? "");
    if (digitos.length < 10) return json({ error: "Informe telefone ou contato_id." }, 400, corsHeaders);

    // Com DDI quando quem digitou não pôs: a Meta exige o código do país.
    const waId = digitos.startsWith("55") ? digitos : `55${digitos}`;

    // Procura pelas variantes porque o contato pode ter sido criado pelo
    // webhook, com o número no formato da Meta (sem o nono dígito).
    const { data: achados } = await admin
      .from("whatsapp_contatos")
      .select("id, wa_id, empresa_id, ultima_entrada_em")
      .eq("empresa_id", cfg.empresa_id)
      .in("wa_id", variantesBrasil(waId));
    contato = (achados?.[0] as ContatoLinha | undefined) ?? null;

    if (!contato) {
      const { data: clienteId } = await admin.rpc("whatsapp_cliente_por_telefone", {
        _empresa_id: cfg.empresa_id,
        _variantes: variantesBrasil(waId),
      });
      const { data: criado, error } = await admin
        .from("whatsapp_contatos")
        .insert({ empresa_id: cfg.empresa_id, wa_id: waId, cliente_comercial_id: clienteId ?? null })
        .select("id, wa_id, empresa_id, ultima_entrada_em")
        .single();
      if (error) return json({ error: `Falha ao registrar o contato: ${error.message}` }, 500, corsHeaders);
      contato = criado as ContatoLinha;
    }
  }

  // ---- janela de 24h ----
  const naJanela = dentroDaJanela24h(contato!.ultima_entrada_em);
  const texto = (corpo.texto ?? "").trim();

  if (!corpo.template && !texto) {
    return json({ error: "Informe texto ou template." }, 400, corsHeaders);
  }
  if (!corpo.template && !naJanela) {
    return json(
      {
        error: "janela_24h_fechada",
        detalhe:
          "A última mensagem deste contato tem mais de 24 horas. A Meta só aceita texto livre dentro da janela; " +
          "envie um template aprovado (campo `template`) para reabrir a conversa.",
      },
      409,
      corsHeaders,
    );
  }

  // ---- envio ----
  const envio = corpo.template
    ? await enviarTemplate(
        cfg.phone_number_id,
        contato!.wa_id,
        corpo.template.nome,
        corpo.template.idioma ?? "pt_BR",
        {
          corpo: corpo.template.corpo ?? (corpo.template.parametros ?? []).map((valor) => ({ valor })),
          cabecalho: corpo.template.cabecalho,
        },
      )
    : await enviarTexto(cfg.phone_number_id, contato!.wa_id, texto);

  await admin.from("whatsapp_mensagens").insert({
    empresa_id: cfg.empresa_id,
    contato_id: contato!.id,
    direcao: "saida",
    wa_message_id: envio.waMessageId,
    tipo: corpo.template ? "template" : "text",
    // Com template, o que se grava é o texto JÁ com os valores no lugar — é o
    // que o cliente leu. Guardar "[template aviso_vencimento]" deixaria o
    // histórico ilegível justamente na mensagem que abriu a conversa.
    texto: corpo.template ? (texto || `[template ${corpo.template.nome}]`) : texto,
    origem: "humano",
    status: envio.ok ? "enviado" : "falhou",
    erro: envio.erro,
    payload: { enviado_por: usuario.id },
  });

  if (!envio.ok) return json({ error: envio.erro ?? "Falha no envio" }, 502, corsHeaders);

  await admin
    .from("whatsapp_contatos")
    .update({ ultima_mensagem_em: new Date().toISOString() })
    .eq("id", contato!.id);

  return json({ ok: true, wa_message_id: envio.waMessageId, contato_id: contato!.id }, 200, corsHeaders);
});
