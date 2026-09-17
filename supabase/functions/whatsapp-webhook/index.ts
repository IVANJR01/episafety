import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { resolverProvedorIa, SEM_PROVEDOR } from "../_shared/provedorIa.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import {
  assinaturaConfere,
  enviarTexto,
  extrairMensagens,
  extrairStatus,
  marcarComoLida,
  variantesBrasil,
  type MensagemRecebida,
} from "../_shared/whatsapp.ts";

/**
 * Webhook do WhatsApp Cloud API — a automação inteira, sem orquestrador.
 *
 * Fluxo: a Meta faz POST aqui -> confere a assinatura -> grava a mensagem ->
 * decide se responde -> pergunta para a IA com o histórico -> envia pelo Graph
 * -> grava a resposta. Não há n8n, fila nem worker: o estado da conversa é a
 * tabela `whatsapp_mensagens`.
 *
 * Três coisas que a Meta impõe e que explicam o formato deste arquivo:
 *
 * 1. O GET de verificação. A Meta só aceita cadastrar a URL depois de receber
 *    de volta o `hub.challenge` em texto puro.
 * 2. `verify_jwt = false` no config.toml. Quem chama é a Meta, sem JWT do
 *    Supabase. O controle de acesso é a assinatura HMAC do corpo — por isso
 *    ela é obrigatória, e sem o segredo a function recusa tudo.
 * 3. O 200 tem que sair rápido. A Meta reenvia o mesmo POST quando demora, e
 *    responder a IA leva segundos. Por isso o trabalho pesado vai para
 *    `EdgeRuntime.waitUntil` e a resposta HTTP sai na frente; o `wa_message_id`
 *    único no banco é o que garante que o reenvio não vire resposta repetida.
 */

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const PROMPT_BASE = `Você é o atendente virtual de uma consultoria de Segurança e Saúde do Trabalho (SST) no Brasil, falando por WhatsApp.

COMO RESPONDER
- Português do Brasil, tom cordial e direto, como um profissional atende no WhatsApp.
- Mensagens CURTAS: no máximo 4 linhas. Se o assunto for longo, responda o essencial e pergunte se pode detalhar.
- Nada de markdown pesado: WhatsApp não renderiza tabela nem título. No máximo *negrito* e listas com hífen.
- Uma pergunta por vez. Atendimento é conversa, não formulário.

O QUE VOCÊ FAZ
- Tira dúvidas sobre NRs, documentos obrigatórios (PGR, PCMSO, LTCAT, ASO, APR), EPIs, CA e treinamentos.
- Entende o que a empresa do cliente precisa: ramo, número de funcionários, quais documentos já tem.
- Encaminha para fechar: quando o cliente demonstrar interesse, ofereça o próximo passo concreto (enviar proposta, agendar conversa).

REGRAS QUE NÃO SE QUEBRAM
- NUNCA invente número de item de norma. Na dúvida, cite só a NR ("a NR-35 trata disso") sem o item.
- NUNCA prometa preço, prazo ou desconto que não esteja nas instruções da empresa abaixo. Diga que vai confirmar com a equipe.
- NUNCA dê orientação médica, nem interprete exame ou ASO de pessoa específica.
- Se pedirem algo que exige decisão humana — contrato, reclamação, acidente em andamento — diga que vai chamar alguém da equipe.`;

/** Quantas mensagens do histórico vão para a IA. */
const MENSAGENS_DE_CONTEXTO = 12;

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

interface ConfigLinha {
  id: string;
  empresa_id: string;
  phone_number_id: string;
  automacao_ativa: boolean;
  prompt_extra: string | null;
  saudacao: string | null;
  palavras_atendente: string[] | null;
}

interface ContatoLinha {
  id: string;
  empresa_id: string;
  wa_id: string;
  nome: string | null;
  cliente_comercial_id: string | null;
  automacao_ativa: boolean;
}

// ============================================================================
// Verificação do webhook (GET) — só acontece no cadastro da URL na Meta.
// ============================================================================
function responderVerificacao(url: URL): Response {
  const modo = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const desafio = url.searchParams.get("hub.challenge") ?? "";
  const esperado = Deno.env.get("WHATSAPP_VERIFY_TOKEN");

  if (modo === "subscribe" && esperado && token === esperado) {
    // Texto puro, sem JSON: a Meta compara byte a byte.
    return new Response(desafio, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  console.warn("[whatsapp-webhook] verificação recusada", { modo, temEsperado: Boolean(esperado) });
  return new Response("forbidden", { status: 403 });
}

// ============================================================================
// Contato: acha ou cria, e já tenta ligar ao cliente do comercial.
// ============================================================================
interface ContatoAchado {
  contato: ContatoLinha;
  /** Primeira vez que este número aparece. Decide se cabe saudação. */
  novo: boolean;
}

async function acharOuCriarContato(
  config: ConfigLinha,
  msg: MensagemRecebida,
): Promise<ContatoAchado | null> {
  const { data: existente } = await admin
    .from("whatsapp_contatos")
    .select("id, empresa_id, wa_id, nome, cliente_comercial_id, automacao_ativa")
    .eq("empresa_id", config.empresa_id)
    .eq("wa_id", msg.waId)
    .maybeSingle();

  if (existente) {
    await admin
      .from("whatsapp_contatos")
      .update({
        // O nome do perfil pode ter mudado; e um contato criado por um envio
        // nosso ainda não tem nome nenhum.
        nome: msg.nome ?? (existente as ContatoLinha).nome,
        ultima_entrada_em: msg.recebidaEm,
        ultima_mensagem_em: msg.recebidaEm,
      })
      .eq("id", (existente as ContatoLinha).id);
    return { contato: existente as ContatoLinha, novo: false };
  }

  // Número novo: vale procurar na carteira antes de criar, para o atendimento
  // já começar sabendo quem é.
  const { data: clienteId } = await admin.rpc("whatsapp_cliente_por_telefone", {
    _empresa_id: config.empresa_id,
    _variantes: variantesBrasil(msg.waId),
  });

  const { data: criado, error } = await admin
    .from("whatsapp_contatos")
    .insert({
      empresa_id: config.empresa_id,
      wa_id: msg.waId,
      nome: msg.nome,
      cliente_comercial_id: clienteId ?? null,
      ultima_entrada_em: msg.recebidaEm,
      ultima_mensagem_em: msg.recebidaEm,
    })
    .select("id, empresa_id, wa_id, nome, cliente_comercial_id, automacao_ativa")
    .single();

  if (error) {
    // Duas mensagens ao mesmo tempo do mesmo número novo: a segunda bate na
    // restrição de unicidade. Basta reler.
    console.warn("[whatsapp-webhook] insert de contato falhou, relendo", error.message);
    const { data: relido } = await admin
      .from("whatsapp_contatos")
      .select("id, empresa_id, wa_id, nome, cliente_comercial_id, automacao_ativa")
      .eq("empresa_id", config.empresa_id)
      .eq("wa_id", msg.waId)
      .maybeSingle();
    return relido ? { contato: relido as ContatoLinha, novo: false } : null;
  }
  return { contato: criado as ContatoLinha, novo: true };
}

/**
 * Grava a mensagem que chegou. Devolve false quando ela JÁ estava gravada —
 * é o reenvio da Meta, e responder de novo seria mandar a mesma coisa duas
 * vezes para o cliente.
 */
async function gravarEntrada(contato: ContatoLinha, msg: MensagemRecebida): Promise<boolean> {
  const { data, error } = await admin
    .from("whatsapp_mensagens")
    .upsert(
      {
        empresa_id: contato.empresa_id,
        contato_id: contato.id,
        direcao: "entrada",
        wa_message_id: msg.waMessageId,
        tipo: msg.tipo,
        texto: msg.texto,
        payload: msg.bruto,
        created_at: msg.recebidaEm,
      },
      { onConflict: "wa_message_id", ignoreDuplicates: true },
    )
    .select("id");

  if (error) {
    console.error("[whatsapp-webhook] falha ao gravar entrada", error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

// ============================================================================
// Resposta
// ============================================================================
function pediuAtendente(texto: string, palavras: string[] | null): boolean {
  const alvo = (texto || "").toLowerCase();
  if (!alvo) return false;
  return (palavras ?? []).some((p) => p && alvo.includes(p.toLowerCase()));
}

async function montarPromptDoSistema(config: ConfigLinha, contato: ContatoLinha): Promise<string> {
  const partes = [PROMPT_BASE];

  if (config.prompt_extra) {
    partes.push(`\n=== INSTRUÇÕES DESTA EMPRESA ===\n${config.prompt_extra}`);
  }

  // "Consultar o cliente no banco" é isto: o que o sistema já sabe sobre quem
  // está do outro lado entra no prompt. Sem isso a IA pergunta o nome da
  // empresa para um cliente que está na carteira há dois anos.
  if (contato.cliente_comercial_id) {
    const { data: cliente } = await admin
      .from("clientes_comerciais")
      .select("nome, razao_social, segmento, cidade, uf, contato_responsavel")
      .eq("id", contato.cliente_comercial_id)
      .maybeSingle();
    if (cliente) {
      const c = cliente as Record<string, string | null>;
      partes.push(
        `\n=== QUEM ESTÁ FALANDO ===\n` +
        `É um cliente já cadastrado: ${c.nome ?? "—"}` +
        (c.razao_social ? ` (${c.razao_social})` : "") +
        (c.segmento ? `, ramo ${c.segmento}` : "") +
        (c.cidade ? `, ${c.cidade}${c.uf ? `/${c.uf}` : ""}` : "") +
        (c.contato_responsavel ? `. Contato: ${c.contato_responsavel}` : "") +
        `.\nNão peça dados que já estão aqui.`,
      );
    }
  } else if (contato.nome) {
    partes.push(`\n=== QUEM ESTÁ FALANDO ===\nNão é cliente cadastrado. O perfil do WhatsApp diz "${contato.nome}".`);
  }

  return partes.join("\n");
}

async function historico(contatoId: string): Promise<Array<{ role: string; content: string }>> {
  const { data } = await admin
    .from("whatsapp_mensagens")
    .select("direcao, texto")
    .eq("contato_id", contatoId)
    .not("texto", "is", null)
    .order("created_at", { ascending: false })
    .limit(MENSAGENS_DE_CONTEXTO);

  // Veio do mais novo para o mais velho porque o LIMIT precisa das últimas; a
  // IA lê na ordem em que a conversa aconteceu.
  return (data ?? [])
    .reverse()
    .map((m: Record<string, string>) => ({
      role: m.direcao === "entrada" ? "user" : "assistant",
      content: m.texto,
    }));
}

async function pensarResposta(
  config: ConfigLinha,
  contato: ContatoLinha,
): Promise<string | null> {
  const provedor = resolverProvedorIa();
  if (!provedor) {
    console.error("[whatsapp-webhook]", SEM_PROVEDOR);
    return null;
  }

  const mensagens = [
    { role: "system", content: await montarPromptDoSistema(config, contato) },
    ...(await historico(contato.id)),
  ];

  const resposta = await fetch(provedor.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${provedor.chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: provedor.modelo,
      messages: mensagens,
      // Teto baixo de propósito: resposta de WhatsApp é curta, e o teto é o
      // que segura a conta quando a conversa vira um debate de norma.
      max_tokens: 400,
      temperature: 0.4,
    }),
  });

  if (!resposta.ok) {
    console.error("[whatsapp-webhook] IA respondeu", resposta.status, await resposta.text());
    return null;
  }

  const dados = await resposta.json();
  const texto = dados?.choices?.[0]?.message?.content;
  return typeof texto === "string" && texto.trim() ? texto.trim() : null;
}

async function responder(
  config: ConfigLinha,
  contato: ContatoLinha,
  texto: string,
  origem: "ia" | "sistema",
): Promise<void> {
  const envio = await enviarTexto(config.phone_number_id, contato.wa_id, texto);

  await admin.from("whatsapp_mensagens").insert({
    empresa_id: contato.empresa_id,
    contato_id: contato.id,
    direcao: "saida",
    wa_message_id: envio.waMessageId,
    tipo: "text",
    texto,
    origem,
    status: envio.ok ? "enviado" : "falhou",
    erro: envio.erro,
  });

  if (envio.ok) {
    await admin
      .from("whatsapp_contatos")
      .update({ ultima_mensagem_em: new Date().toISOString() })
      .eq("id", contato.id);
  }
}

async function chamarHumano(config: ConfigLinha, contato: ContatoLinha): Promise<void> {
  // Desliga a automação ANTES de avisar: se o envio falhar, a conversa já está
  // com a pessoa, que é o lado seguro do erro.
  await admin.from("whatsapp_contatos").update({ automacao_ativa: false }).eq("id", contato.id);
  await responder(
    config,
    contato,
    "Certo! Já estou passando seu contato para alguém da equipe. " +
    "Responda por aqui mesmo que a pessoa continua daqui.",
    "sistema",
  );
}

// ============================================================================
// Uma mensagem, do começo ao fim.
// ============================================================================
async function processar(msg: MensagemRecebida): Promise<void> {
  const { data: config } = await admin
    .from("whatsapp_config")
    .select("id, empresa_id, phone_number_id, automacao_ativa, prompt_extra, saudacao, palavras_atendente")
    .eq("phone_number_id", msg.phoneNumberId)
    .maybeSingle();

  if (!config) {
    // Linha que não está cadastrada em whatsapp_config. Pode ser um segundo
    // número do mesmo app da Meta: não é erro, é uma conversa que não é nossa.
    console.warn("[whatsapp-webhook] phone_number_id sem empresa", msg.phoneNumberId);
    return;
  }
  const cfg = config as ConfigLinha;

  const achado = await acharOuCriarContato(cfg, msg);
  if (!achado) return;
  const { contato, novo } = achado;

  const primeiraMensagem = await gravarEntrada(contato, msg);
  if (!primeiraMensagem) {
    console.log("[whatsapp-webhook] reenvio da Meta ignorado", msg.waMessageId);
    return;
  }

  if (!cfg.automacao_ativa) return;
  if (!contato.automacao_ativa) return;

  if (pediuAtendente(msg.texto, cfg.palavras_atendente)) {
    await chamarHumano(cfg, contato);
    return;
  }

  // Teto por número: uma conversa não pode, sozinha, consumir a conta de IA.
  // Vinte mensagens por minuto é muito mais do que gente digita, e pouco o
  // bastante para um script travar.
  const passou = await checkRateLimit({
    key: `whatsapp:${contato.empresa_id}:${msg.waId}`,
    limit: 20,
    windowSeconds: 60,
  });
  if (!passou) {
    console.warn("[whatsapp-webhook] rate limit do contato", msg.waId);
    return;
  }

  await marcarComoLida(cfg.phone_number_id, msg.waMessageId);

  // Quem nunca falou com a linha recebe a saudação antes da resposta: é a
  // apresentação da empresa, e ela não deve depender do humor da IA.
  if (novo && cfg.saudacao) {
    await responder(cfg, contato, cfg.saudacao, "sistema");
  }

  const resposta = await pensarResposta(cfg, contato);
  if (!resposta) {
    // A IA caiu. Calar é pior do que avisar: o cliente fica olhando o visto.
    await responder(
      cfg,
      contato,
      "Recebi sua mensagem! Estou com uma instabilidade aqui e já vou chamar alguém da equipe para te responder.",
      "sistema",
    );
    await admin.from("whatsapp_contatos").update({ automacao_ativa: false }).eq("id", contato.id);
    return;
  }

  await responder(cfg, contato, resposta, "ia");
}

/** Confirmações de entrega das mensagens que enviamos. */
async function atualizarStatus(payload: unknown): Promise<void> {
  for (const s of extrairStatus(payload)) {
    await admin
      .from("whatsapp_mensagens")
      .update({ status: s.status, erro: s.erro })
      .eq("wa_message_id", s.waMessageId);
  }
}

serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET") return responderVerificacao(url);
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const segredo = Deno.env.get("WHATSAPP_APP_SECRET");
  if (!segredo) {
    // Falha fechada: sem o segredo não dá para saber se o POST veio da Meta, e
    // este endpoint é público. Aceitar "só até configurar" é como fica.
    console.error("[whatsapp-webhook] WHATSAPP_APP_SECRET não configurado — recusando tudo");
    return new Response("misconfigured", { status: 500 });
  }

  // O corpo CRU, antes de qualquer parse: é sobre ele que a assinatura é feita.
  const corpoCru = await req.text();
  const ok = await assinaturaConfere(corpoCru, req.headers.get("x-hub-signature-256"), segredo);
  if (!ok) {
    console.warn("[whatsapp-webhook] assinatura inválida");
    return new Response("invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(corpoCru);
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const mensagens = extrairMensagens(payload);

  const trabalho = (async () => {
    try {
      await atualizarStatus(payload);
      for (const msg of mensagens) {
        try {
          await processar(msg);
        } catch (e) {
          // Uma mensagem com problema não pode derrubar as outras do mesmo POST.
          console.error("[whatsapp-webhook] erro ao processar", msg.waMessageId, e);
        }
      }
    } catch (e) {
      console.error("[whatsapp-webhook] erro no processamento", e);
    }
  })();

  // O 200 sai agora; o resto continua rodando. Sem isto a Meta considera a
  // entrega falha em 10s e reenvia o POST enquanto a IA ainda está pensando.
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(trabalho);
  } else {
    await trabalho;
  }

  return new Response(JSON.stringify({ recebidas: mensagens.length }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
