import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { resolveCors } from "../_shared/cors.ts";

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

Deno.serve(async (req) => {
  const corsHeaders = resolveCors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const secretRecebido = req.headers.get("x-cron-secret");
  if (!CRON_SECRET || secretRecebido !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const resumo: Array<{ empresa_id: string; empresa_nome: string; documentos: number; enviado: boolean; motivo?: string }> = [];

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
      if (destinatarios.length === 0) {
        resumo.push({ empresa_id: empresaId, empresa_nome: empresaNome, documentos: lista.length, enviado: false, motivo: "sem e-mail configurado" });
        continue;
      }

      const colaboradorIds = [...new Set(lista.map((d) => d.colaborador_id).filter(Boolean))] as string[];
      const { data: funcionarios } = colaboradorIds.length
        ? await client.from("funcionarios").select("id, nome").in("id", colaboradorIds)
        : { data: [] as any[] };
      const nomePorColaborador = new Map((funcionarios || []).map((f: any) => [f.id, f.nome]));

      const vencidos = lista.filter((d) => d.situacao === "vencido").sort((a, b) => (a.dias_para_vencer ?? 0) - (b.dias_para_vencer ?? 0));
      const vencendo = lista.filter((d) => d.situacao === "vence_em_breve").sort((a, b) => (a.dias_para_vencer ?? 0) - (b.dias_para_vencer ?? 0));

      const html = gerarHtml(empresaNome, vencidos, vencendo, nomePorColaborador);
      const subject = `[${empresaNome}] ${vencidos.length ? `${vencidos.length} vencido(s)` : ""}${vencidos.length && vencendo.length ? " · " : ""}${vencendo.length ? `${vencendo.length} vencendo` : ""} — Arquivo Digital SST`;

      const { enviado, erro } = await enviarEmail(destinatarios, subject, html);
      resumo.push({ empresa_id: empresaId, empresa_nome: empresaNome, documentos: lista.length, enviado, motivo: erro });
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
