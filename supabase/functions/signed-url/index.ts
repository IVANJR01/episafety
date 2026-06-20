// supabase/functions/signed-url/index.ts
// Emite Signed URLs para buckets sensíveis, validando auth + tenant + bucket allowlist + rate limit + TTL curto.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { resolveCors } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const ALLOWED_BUCKETS = new Set([
  "inspecoes",
  "conformidades",
  "videos-treinamento",
  "fotos-reconhecimento",
]);
const DEFAULT_TTL = 60;          // segundos
const MAX_TTL = 300;             // 5 min — TTL curto obrigatório
const RATE_LIMIT = 120;          // 120 reqs / 60s por usuário
const RATE_WINDOW = 60;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

Deno.serve(async (req) => {
  const cors = resolveCors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "method_not_allowed" }), {
        status: 405,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Identifica o usuário sem privilégios elevados
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const userId = userRes.user.id;

    // Rate limit por usuário
    const rl = await checkRateLimit({ key: `signed-url:${userId}`, limit: RATE_LIMIT, windowSeconds: RATE_WINDOW });
    if (!rl) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const bucket = String(body?.bucket ?? "");
    const path = String(body?.path ?? "");
    const ttl = Math.min(Math.max(Number(body?.ttl) || DEFAULT_TTL, 10), MAX_TTL);
    const download = Boolean(body?.download);

    if (!ALLOWED_BUCKETS.has(bucket)) {
      return new Response(JSON.stringify({ error: "bucket_not_allowed" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (!path || path.includes("..") || path.startsWith("/")) {
      return new Response(JSON.stringify({ error: "invalid_path" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Primeiro segmento do path tem que ser um empresa_id válido E pertencer à árvore do usuário
    const empresaSeg = path.split("/")[0] ?? "";
    if (!isUuid(empresaSeg)) {
      return new Response(JSON.stringify({ error: "invalid_tenant_path" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Service client só para validação de tenant e emissão da URL — nunca devolve dados ao client
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Super admin / principal pulam a checagem de árvore
    const [{ data: isSuper }, { data: isPrincipal }] = await Promise.all([
      adminClient.rpc("is_super_admin", { _user_id: userId }),
      adminClient.rpc("is_principal", { _user_id: userId }),
    ]);

    let allowed = Boolean(isSuper) || Boolean(isPrincipal);
    if (!allowed) {
      const { data: inTree, error: treeErr } = await adminClient.rpc(
        "is_in_user_company_tree",
        { _user_id: userId, _empresa_id: empresaSeg },
      );
      if (treeErr) {
        return new Response(JSON.stringify({ error: "tenant_check_failed" }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      allowed = Boolean(inTree);
    }

    if (!allowed) {
      return new Response(JSON.stringify({ error: "forbidden_tenant" }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: signed, error: signErr } = await adminClient
      .storage
      .from(bucket)
      .createSignedUrl(path, ttl, download ? { download: true } : undefined);

    if (signErr || !signed?.signedUrl) {
      return new Response(JSON.stringify({ error: "sign_failed", detail: signErr?.message }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ url: signed.signedUrl, ttl, expires_at: new Date(Date.now() + ttl * 1000).toISOString() }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: "internal", detail: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
