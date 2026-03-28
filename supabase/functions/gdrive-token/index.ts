import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ROOT_FOLDER_NAME = "EPI-Safety-Backup";

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_OAUTH_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) throw new Error("Google OAuth credentials missing");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(`OAuth error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function findOrCreateFolder(token: string, parentId: string, name: string): Promise<string> {
  const q = encodeURIComponent(
    `'${parentId}' in parents and name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (data?.files?.length) return data.files[0].id;

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  const created = await createRes.json();
  if (!createRes.ok || !created?.id) throw new Error(`Folder create error: ${JSON.stringify(created)}`);
  return created.id;
}

async function getRootFolderId(token: string): Promise<string> {
  const q = encodeURIComponent(
    `name='${ROOT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (data?.files?.length) return data.files[0].id;

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: ROOT_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  const created = await createRes.json();
  if (!createRes.ok || !created?.id) throw new Error(`Root folder create error: ${JSON.stringify(created)}`);
  return created.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) throw new Error("Unauthorized");

    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: profile } = await serviceClient
      .from("profiles").select("empresa_id").eq("user_id", authData.user.id).single();
    if (!profile?.empresa_id) throw new Error("Empresa não encontrada");

    const { data: empresa } = await serviceClient
      .from("empresa_config").select("nome").eq("id", profile.empresa_id).single();
    const empresaNome = empresa?.nome || profile.empresa_id;

    // Get Google access token
    const driveToken = await getAccessToken();

    // Parse request body for folder
    let folder = "geral";
    try {
      const body = await req.json();
      if (body?.folder) folder = body.folder;
    } catch { /* no body */ }

    // Ensure folder hierarchy exists: EPISafety > Empresa > folder/sub/paths
    const rootId = await getRootFolderId(driveToken);
    const empresaFolderId = await findOrCreateFolder(driveToken, rootId, empresaNome);
    
    // Support multi-level folder paths (e.g. "Colaborador/Certificados")
    const folderParts = folder.split("/").filter(Boolean);
    let targetFolderId = empresaFolderId;
    for (const part of folderParts) {
      targetFolderId = await findOrCreateFolder(driveToken, targetFolderId, part);
    }

    return new Response(JSON.stringify({
      accessToken: driveToken,
      folderId: targetFolderId,
      empresaNome,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: err instanceof Error && message === "Unauthorized" ? 401 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
