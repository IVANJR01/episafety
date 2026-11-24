/**
 * Liga o backup ao Google Drive do dono da conta (OAuth do Google).
 *
 *  - POST { acao: "iniciar" } (super admin logado): devolve o endereço do
 *    Google onde a pessoa clica em "Permitir";
 *  - GET ?code=…&state=… : é a volta do Google. Troca o código pelo token
 *    de longa duração, guarda no Vault e devolve a pessoa para a tela de
 *    Backups. O "state" confere que a volta é de um pedido feito por aqui.
 *
 * verify_jwt desligado porque a volta do Google não traz login; a
 * autorização é conferida aqui dentro.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { resolveCors } from "../_shared/cors.ts";
import { ESCOPO, lerSegredos } from "../_shared/googleDrive.ts";

const TELA = "https://safetysolucoes.com/admin/backups";
const VALIDADE_DO_PEDIDO_MS = 15 * 60_000;

Deno.serve(async (req) => {
  const cors = resolveCors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const retorno = `${url}/functions/v1/google-drive`;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const voltar = (q: string) => Response.redirect(`${TELA}?${q}`, 302);

  // ── Volta do Google ──
  if (req.method === "GET") {
    const p = new URL(req.url).searchParams;
    if (p.get("error")) return voltar(`drive=erro&motivo=${encodeURIComponent(p.get("error")!)}`);
    const code = p.get("code"), estado = p.get("state");
    if (!code || !estado) return voltar("drive=erro&motivo=resposta-incompleta");
    const { data: pedido } = await admin.from("backup_drive_estados").delete().eq("estado", estado).select("criado_em").maybeSingle();
    if (!pedido || Date.now() - Date.parse(pedido.criado_em) > VALIDADE_DO_PEDIDO_MS) {
      return voltar("drive=erro&motivo=pedido-expirado");
    }
    try {
      const s = await lerSegredos(admin);
      const r = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code, client_id: s.client_id!, client_secret: s.client_secret!,
          redirect_uri: retorno, grant_type: "authorization_code",
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.refresh_token) throw new Error(d.error_description || d.error || "sem token de longa duração");
      const { error } = await admin.rpc("drive_salvar_refresh", { token: d.refresh_token });
      if (error) throw new Error(error.message);
      // E-mail da conta, só para mostrar na tela qual Drive está ligado.
      let email: string | null = null;
      try { email = JSON.parse(atob(d.id_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).email ?? null; } catch { /* sem e-mail */ }
      await admin.from("backup_drive_config").update({
        conectado_em: new Date().toISOString(), conta_email: email, ultimo_erro: null,
        pasta_id: null, pasta_diario_id: null, pasta_arquivos_id: null,
      }).eq("id", true);
      // Conta nova: o que foi enviado para a anterior não está nesta.
      await admin.from("backup_drive_enviados").delete().neq("caminho", "");
      return voltar("drive=ok");
    } catch (e) {
      return voltar(`drive=erro&motivo=${encodeURIComponent((e as Error).message.slice(0, 120))}`);
    }
  }

  // ── Início, pela tela de Backups ──
  const auth = req.headers.get("Authorization");
  const usuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth ?? "" } } });
  const { data: u } = await usuario.auth.getUser();
  const { data: ehAdmin } = u?.user ? await admin.rpc("is_super_admin", { _user_id: u.user.id }) : { data: false };
  if (!ehAdmin) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

  const s = await lerSegredos(admin);
  if (!s.client_id) {
    return new Response(JSON.stringify({ error: "Cole o Client ID e o Client Secret primeiro." }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const estado = crypto.randomUUID() + crypto.randomUUID();
  await admin.from("backup_drive_estados").delete().lt("criado_em", new Date(Date.now() - VALIDADE_DO_PEDIDO_MS).toISOString());
  await admin.from("backup_drive_estados").insert({ estado });
  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.search = new URLSearchParams({
    client_id: s.client_id, redirect_uri: retorno, response_type: "code", scope: ESCOPO,
    access_type: "offline", prompt: "consent", state: estado, include_granted_scopes: "true",
  }).toString();
  return new Response(JSON.stringify({ url: google.toString(), endereco_de_retorno: retorno }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
