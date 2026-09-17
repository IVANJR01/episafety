import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { resolveCors } from "../_shared/cors.ts";
import {
  apenasDigitos,
  enviarTemplate,
  listarTemplatesAprovados,
  marcadoresDoTexto,
  parametrosParaMarcadores,
  type TemplateAprovado,
} from "../_shared/whatsapp.ts";

/**
 * Só o cron pode chamar esta function — não tem sessão de usuário por
 * trás. verify_jwt está desligado pra ela em config.toml; a autorização
 * real é este segredo, gerado uma vez no Vault pela migration
 * 20260808050000 e copiado manualmente para este secret.
 */
const CRON_SECRET = Deno.env.get("CRON_ALERTAS_SECRET");

/** Mesmo remetente/fallback de todas as outras functions de email do produto. */
const REMETENTE = Deno.env.get("RESEND_FROM") || "EpiSafety <onboarding@resend.dev>";

interface DocumentoSituacao {
  empresa_id: string;
  colaborador_id: string | null;
  tipo_nome: string;
  dias_aviso: number[] | null;
  data_validade: string | null;
  situacao: string;
  dias_para_vencer: number | null;
}

function partirEmails(texto?: string | null): string[] {
  return (texto || "")
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function dataBr(iso?: string | null): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

function linhaTabela(nome: string, tipo: string, validade: string, dias: string): string {
  return `<tr>
    <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${nome}</td>
    <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${tipo}</td>
    <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${validade}</td>
    <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${dias}</td>
  </tr>`;
}

function gerarHtml(empresaNome: string, vencidos: DocumentoSituacao[], vencendo: DocumentoSituacao[], nomePorColaborador: Map<string, string>): string {
  const linhas = (lista: DocumentoSituacao[], cor: string) =>
    lista.map((d) =>
      linhaTabela(
        (d.colaborador_id && nomePorColaborador.get(d.colaborador_id)) || "—",
        d.tipo_nome,
        dataBr(d.data_validade),
        `<span style="color:${cor};font-weight:bold;">${d.dias_para_vencer === null ? "—" : d.dias_para_vencer}</span>`,
      )
    ).join("");

  const secao = (titulo: string, lista: DocumentoSituacao[], cor: string) => {
    if (lista.length === 0) return "";
    return `
    <h3 style="margin:20px 0 8px;color:#1f2937;font-size:15px;">${titulo} (${lista.length})</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="background:#f3f4f6;">
        <th style="padding:8px;text-align:left;">Colaborador</th>
        <th style="padding:8px;text-align:left;">Documento</th>
        <th style="padding:8px;text-align:left;">Validade</th>
        <th style="padding:8px;text-align:right;">Dias</th>
      </tr></thead>
      <tbody>${linhas(lista, cor)}</tbody>
    </table>`;
  };

  return `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#333;margin:0;padding:0;">
  <div style="max-width:640px;margin:0 auto;padding:20px;background:#f9fafb;">
    <div style="background:#1f2937;color:white;padding:24px;border-radius:8px 8px 0 0;">
      <h1 style="margin:0;font-size:20px;">🔔 Vencimentos — Arquivo Digital SST</h1>
      <p style="margin:6px 0 0;opacity:0.8;font-size:13px;">${empresaNome}</p>
    </div>
    <div style="background:white;padding:24px;border-radius:0 0 8px 8px;">
      ${secao("Vencidos", vencidos, "#dc2626")}
      ${secao("Vencendo em breve", vencendo, "#d97706")}
      <p style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;">
        Resumo automático diário do Arquivo Digital SST (ASO, capacitações, ficha de EPI, ordem de serviço).
        Para ajustar quem recebe, acesse Cadastro → Empresas → E-mails para Alertas de Vencimento SST.
      </p>
    </div>
  </div>
</body></html>`.trim();
}

async function enviarEmail(to: string[], subject: string, html: string): Promise<{ enviado: boolean; erro?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.log("📧 ALERTA (MODO DEBUG - sem RESEND_API_KEY):", subject, "→", to.join(", "));
    return { enviado: true };
  }
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: REMETENTE, to, subject, html }),
  });
  if (!resp.ok) {
    const erro = await resp.text();
    return { enviado: false, erro };
  }
  return { enviado: true };
}

// ============================================================================
// O mesmo aviso, por WhatsApp
//
// Por que template e não texto: quem recebe o resumo quase nunca escreveu para
// a linha nas últimas 24 horas, e fora dessa janela a Meta só aceita template
// aprovado. Por isso o nome do template é configuração, não constante.
//
// Por que os valores são casados com os marcadores do template, em vez de
// mandar sempre três: o template é aprovado dentro da Meta, e cada empresa
// aprova o seu. Consultar quantos campos ele tem custa uma chamada e evita o
// erro mais chato daqui — o aviso do dia que não sai porque o template tinha
// dois campos em vez de três.
//
// A ordem dos campos numerados é fixa e está documentada em
// WHATSAPP_AUTOMACAO.md: {{1}} empresa, {{2}} vencidos, {{3}} vencendo,
// {{4}} total, {{5}} data.
// ============================================================================

const ORDEM_CAMPOS_ALERTA = ["empresa", "vencidos", "vencendo", "total", "data"];

/** O cliente de service role que a própria function já cria. */
type ClienteAdmin = ReturnType<typeof createClient>;

interface ConfigAlerta {
  phone_number_id: string;
  waba_id: string | null;
  alertas_ativos: boolean;
  numeros_alerta: string[] | null;
  template_alerta: string | null;
  template_alerta_idioma: string | null;
}

/**
 * O contato onde a mensagem enviada vai ser registrada.
 *
 * O aviso entra no histórico como qualquer outra mensagem, de propósito: quem
 * receber e responder cai na tela de atendimento, com o aviso logo acima da
 * resposta. Sem isso, a resposta chegaria sem contexto nenhum.
 */
async function garantirContato(
  client: ClienteAdmin,
  empresaId: string,
  waId: string,
): Promise<string | null> {
  const { data: criado } = await client
    .from("whatsapp_contatos")
    .upsert({ empresa_id: empresaId, wa_id: waId }, { onConflict: "empresa_id,wa_id", ignoreDuplicates: true })
    .select("id");
  const primeiro = (criado as Array<{ id: string }> | null)?.[0];
  if (primeiro) return primeiro.id;

  const { data: existente } = await client
    .from("whatsapp_contatos")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("wa_id", waId)
    .maybeSingle();
  return (existente as { id: string } | null)?.id ?? null;
}

async function avisarPorWhatsapp(
  client: ClienteAdmin,
  empresaId: string,
  empresaNome: string,
  vencidos: number,
  vencendo: number,
): Promise<{ enviados: number; motivo?: string }> {
  const { data } = await client
    .from("whatsapp_config")
    .select("phone_number_id, waba_id, alertas_ativos, numeros_alerta, template_alerta, template_alerta_idioma")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  const cfg = data as ConfigAlerta | null;
  if (!cfg || !cfg.alertas_ativos) return { enviados: 0 };

  const numeros = (cfg.numeros_alerta ?? []).map(apenasDigitos).filter((n) => n.length >= 10);
  if (numeros.length === 0) return { enviados: 0, motivo: "aviso por WhatsApp ligado, mas sem número cadastrado" };
  if (!cfg.template_alerta) return { enviados: 0, motivo: "aviso por WhatsApp ligado, mas sem template escolhido" };
  if (!cfg.waba_id) return { enviados: 0, motivo: "aviso por WhatsApp ligado, mas sem o WABA ID da empresa" };

  let template: TemplateAprovado | undefined;
  try {
    const aprovados = await listarTemplatesAprovados(cfg.waba_id);
    template = aprovados.find((t) => t.nome === cfg.template_alerta);
  } catch (e) {
    return { enviados: 0, motivo: `falha ao consultar templates: ${(e as Error).message}` };
  }
  if (!template) {
    // Pode ter sido pausado ou reprovado depois de escolhido. Enviar assim
    // mesmo seria gastar a tentativa para receber erro da Meta.
    return { enviados: 0, motivo: `template "${cfg.template_alerta}" não está aprovado na Meta` };
  }

  const valores: Record<string, string> = {
    empresa: empresaNome,
    vencidos: String(vencidos),
    vencendo: String(vencendo),
    total: String(vencidos + vencendo),
    data: new Date().toLocaleDateString("pt-BR"),
  };

  const corpo = template.componentes.find((c) => c.tipo === "BODY");
  const cabecalho = template.componentes.find((c) => c.tipo === "HEADER" && (!c.formato || c.formato === "TEXT"));

  const paramsCorpo = parametrosParaMarcadores(marcadoresDoTexto(corpo?.texto), valores, ORDEM_CAMPOS_ALERTA);
  const paramsCabecalho = parametrosParaMarcadores(marcadoresDoTexto(cabecalho?.texto), valores, ORDEM_CAMPOS_ALERTA);
  if (paramsCorpo === null || paramsCabecalho === null) {
    return { enviados: 0, motivo: `template "${template.nome}" pede um campo que o aviso não tem` };
  }

  const resumoTexto =
    `Vencimentos SST — ${empresaNome}: ${vencidos} vencido(s) e ${vencendo} vencendo.`;

  let enviados = 0;
  for (const numero of numeros) {
    const waId = numero.startsWith("55") ? numero : `55${numero}`;
    const envio = await enviarTemplate(
      cfg.phone_number_id,
      waId,
      template.nome,
      cfg.template_alerta_idioma || template.idioma || "pt_BR",
      { corpo: paramsCorpo, cabecalho: paramsCabecalho },
    );
    if (envio.ok) enviados++;

    const contatoId = await garantirContato(client, empresaId, waId);
    if (contatoId) {
      await client.from("whatsapp_mensagens").insert({
        empresa_id: empresaId,
        contato_id: contatoId,
        direcao: "saida",
        wa_message_id: envio.waMessageId,
        tipo: "template",
        texto: resumoTexto,
        origem: "sistema",
        status: envio.ok ? "enviado" : "falhou",
        erro: envio.erro,
      });
    }
  }

  return { enviados };
}

Deno.serve(async (req) => {
  const corsHeaders = resolveCors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const secretRecebido = req.headers.get("x-cron-secret");
  if (!CRON_SECRET || secretRecebido !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const resumo: Array<{
    empresa_id: string;
    empresa_nome: string;
    documentos: number;
    enviado: boolean;
    motivo?: string;
    whatsapp?: number;
    whatsapp_motivo?: string;
  }> = [];

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient(supabaseUrl, serviceKey);

    // OR entre situacao='vencido' e (situacao='vence_em_breve' AND dias_para_vencer
    // é um dos marcos de dias_aviso) não dá pra expressar em filtro simples do
    // PostgREST (compara duas colunas, não coluna-com-constante) — traz os dois
    // status candidatos e filtra o marco exato aqui.
    const { data: candidatos, error } = await (client.from as any)("internal_documents_situacao")
      .select("empresa_id, colaborador_id, tipo_nome, dias_aviso, data_validade, situacao, dias_para_vencer")
      .in("situacao", ["vencido", "vence_em_breve"]);
    if (error) throw error;

    const documentos = ((candidatos || []) as DocumentoSituacao[]).filter((d) =>
      d.situacao === "vencido" ||
      (d.situacao === "vence_em_breve" && Array.isArray(d.dias_aviso) && d.dias_aviso.includes(d.dias_para_vencer ?? -1))
    );

    const porEmpresa = new Map<string, DocumentoSituacao[]>();
    documentos.forEach((d) => {
      const lista = porEmpresa.get(d.empresa_id) || [];
      lista.push(d);
      porEmpresa.set(d.empresa_id, lista);
    });

    for (const [empresaId, lista] of porEmpresa) {
      const { data: empresa } = await client.from("empresa_config")
        .select("nome, email, email_sst").eq("id", empresaId).maybeSingle();
      const empresaNome = empresa?.nome || "Empresa";

      const emailsSst = partirEmails(empresa?.email_sst);
      const destinatarios = emailsSst.length > 0 ? emailsSst : partirEmails(empresa?.email);
      // Antes, sem e-mail cadastrado a empresa saía do laço aqui e pronto.
      // Agora não: ela pode ter só o WhatsApp configurado, e nesse caso o aviso
      // do dia existe — só não vai por e-mail.
      const semEmail = destinatarios.length === 0;

      const colaboradorIds = [...new Set(lista.map((d) => d.colaborador_id).filter(Boolean))] as string[];
      const { data: funcionarios } = colaboradorIds.length
        ? await client.from("funcionarios").select("id, nome").in("id", colaboradorIds)
        : { data: [] as any[] };
      const nomePorColaborador = new Map((funcionarios || []).map((f: any) => [f.id, f.nome]));

      const vencidos = lista.filter((d) => d.situacao === "vencido").sort((a, b) => (a.dias_para_vencer ?? 0) - (b.dias_para_vencer ?? 0));
      const vencendo = lista.filter((d) => d.situacao === "vence_em_breve").sort((a, b) => (a.dias_para_vencer ?? 0) - (b.dias_para_vencer ?? 0));

      const html = gerarHtml(empresaNome, vencidos, vencendo, nomePorColaborador);
      const subject = `[${empresaNome}] ${vencidos.length ? `${vencidos.length} vencido(s)` : ""}${vencidos.length && vencendo.length ? " · " : ""}${vencendo.length ? `${vencendo.length} vencendo` : ""} — Arquivo Digital SST`;

      const { enviado, erro } = semEmail
        ? { enviado: false, erro: "sem e-mail configurado" }
        : await enviarEmail(destinatarios, subject, html);

      // O WhatsApp é um extra: se ele falhar, o e-mail já foi, e o aviso do dia
      // não pode deixar de existir por causa da Meta estar fora do ar.
      let whatsapp = 0;
      let whatsappMotivo: string | undefined;
      try {
        const r = await avisarPorWhatsapp(client, empresaId, empresaNome, vencidos.length, vencendo.length);
        whatsapp = r.enviados;
        whatsappMotivo = r.motivo;
      } catch (e) {
        whatsappMotivo = (e as Error).message;
        console.error("[alertas] falha no aviso por WhatsApp", empresaId, e);
      }

      resumo.push({
        empresa_id: empresaId,
        empresa_nome: empresaNome,
        documentos: lista.length,
        enviado,
        motivo: erro,
        whatsapp,
        whatsapp_motivo: whatsappMotivo,
      });
    }

    return new Response(JSON.stringify({ success: true, empresas_com_pendencia: porEmpresa.size, resumo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("alertas-vencimento-sst error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e), resumo }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
