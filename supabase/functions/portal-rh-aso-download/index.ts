// Portal RH — ASO download gate
// Valida tenant + permissão portal_rh:aso:baixar + flag liberado_portal_rh
// antes de devolver a URL do PDF (GDrive BYOK) e registra audit log.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface DownloadRequest {
  aso_id: string;
  acao?: "download" | "view";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "unauthorized" }, 401);
    }

    // 1. Identifica usuário a partir do JWT
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "unauthorized" }, 401);
    }
    const uid = userData.user.id;

    // 2. Valida body
    let body: DownloadRequest;
    try {
      body = await req.json();
    } catch {
      return json({ error: "invalid_body" }, 400);
    }
    if (!body?.aso_id || typeof body.aso_id !== "string") {
      return json({ error: "aso_id_required" }, 400);
    }
    const acao = body.acao === "view" ? "view" : "download";

    // 3. Lê o ASO via service role (bypass RLS para checar tenant manualmente)
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: aso, error: asoErr } = await admin
      .from("asos")
      .select("id, empresa_id, pdf_url, status, liberado_portal_rh, funcionario_id")
      .eq("id", body.aso_id)
      .maybeSingle();

    if (asoErr) {
      return json({ error: "db_error", detail: asoErr.message }, 500);
    }
    if (!aso) {
      return json({ error: "not_found" }, 404);
    }

    // 4. Checa tenant (árvore de empresa) OU super admin/principal
    const [tenantRes, superRes, princRes, permRes] = await Promise.all([
      admin.rpc("is_in_user_company_tree", {
        _user_id: uid,
        _empresa_id: aso.empresa_id,
      }),
      admin.rpc("is_super_admin", { _user_id: uid }),
      admin.rpc("is_principal", { _user_id: uid }),
      admin.rpc("has_permission", {
        _user_id: uid,
        _permission: "portal_rh:aso:baixar",
      }),
    ]);

    const isSuper = !!superRes.data;
    const isPrincipal = !!princRes.data;
    const inTenant = !!tenantRes.data;
    const hasRhPerm = !!permRes.data;

    if (!isSuper && !inTenant) {
      await logAccess(admin, {
        empresa_id: aso.empresa_id,
        aso_id: aso.id,
        funcionario_id: aso.funcionario_id,
        usuario_id: uid,
        perfil_usuario: "rh",
        acao: `${acao}_denied_tenant`,
        req,
      });
      return json({ error: "forbidden_tenant" }, 403);
    }

    // 5. Se é RH puro (não super/principal), exige permissão + liberação
    if (!isSuper && !isPrincipal) {
      if (!hasRhPerm) {
        return json({ error: "forbidden_permission" }, 403);
      }
      if (!aso.liberado_portal_rh) {
        return json({ error: "aso_nao_liberado" }, 403);
      }
    }

    // 6. Só agora valida disponibilidade do PDF (após autorização)
    if (!aso.pdf_url) {
      return json({ error: "pdf_unavailable" }, 404);
    }


    // 6. Log + devolve a URL do PDF (link gdrive-proxy já privado)
    await logAccess(admin, {
      empresa_id: aso.empresa_id,
      aso_id: aso.id,
      funcionario_id: aso.funcionario_id,
      usuario_id: uid,
      perfil_usuario: isSuper ? "super_admin" : isPrincipal ? "principal" : "rh",
      acao,
      req,
    });

    return json({ pdf_url: aso.pdf_url, expires_in: null }, 200);
  } catch (e) {
    return json({ error: "internal", detail: String(e) }, 500);
  }
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function logAccess(
  admin: ReturnType<typeof createClient>,
  args: {
    empresa_id: string;
    aso_id: string;
    funcionario_id: string | null;
    usuario_id: string;
    perfil_usuario: string;
    acao: string;
    req: Request;
  },
) {
  try {
    await admin.from("aso_download_logs").insert({
      empresa_id: args.empresa_id,
      aso_id: args.aso_id,
      funcionario_id: args.funcionario_id,
      usuario_id: args.usuario_id,
      perfil_usuario: args.perfil_usuario,
      acao: args.acao,
      ip: args.req.headers.get("x-forwarded-for"),
      user_agent: args.req.headers.get("user-agent"),
    });
  } catch {
    // log é best-effort; não bloqueia
  }
}
