import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TABLES = [
  "funcionarios", "epis", "entregas", "fichas_entrega",
  "dds", "dds_participantes", "inspecoes", "inspecao_itens",
  "inspecoes_subestacao", "treinamentos", "treinamento_participantes",
  "controle_treinamentos", "cursos_documentos", "exames", "medicos",
  "ordens_servico", "conformidades", "empresa_config",
];

const TABLE_LABELS: Record<string, string> = {
  funcionarios: "Funcionários",
  epis: "EPIs",
  entregas: "Entregas",
  fichas_entrega: "Fichas de Entrega",
  dds: "DDS",
  dds_participantes: "DDS Participantes",
  inspecoes: "Inspeções",
  inspecao_itens: "Itens de Inspeção",
  inspecoes_subestacao: "Inspeções Subestação",
  treinamentos: "Treinamentos",
  treinamento_participantes: "Participantes Treinamento",
  controle_treinamentos: "Controle Treinamentos",
  cursos_documentos: "Cursos/Documentos",
  exames: "Exames",
  medicos: "Médicos",
  ordens_servico: "Ordens de Serviço",
  conformidades: "Conformidades",
  empresa_config: "Empresa",
};

const DRIVE_FOLDER_ID = "1b0ct6P0v3bVdSC4fSIf9k-pj1owtzVE5";

// ── OAuth helpers (Gmail pessoal) ──────────────────────────────────

async function getAccessTokenViaOAuth(): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_OAUTH_REFRESH_TOKEN");

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Google OAuth credentials missing. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REFRESH_TOKEN.",
    );
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Google OAuth token error: ${JSON.stringify(data)}`);
  }

  if (!data.access_token) {
    throw new Error(`Google OAuth missing access_token: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

// ── Drive helpers ──────────────────────────────────────────────────

async function findOrCreateFolder(accessToken: string, parentId: string, name: string): Promise<string> {
  const query = encodeURIComponent(
    `'${parentId}' in parents and name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  const searchData = await searchRes.json();
  if (!searchRes.ok) {
    throw new Error(`Drive search error: ${JSON.stringify(searchData)}`);
  }

  if (searchData?.files?.length) {
    return searchData.files[0].id;
  }

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });

  const created = await createRes.json();
  if (!createRes.ok || !created?.id) {
    throw new Error(`Drive folder create error: ${JSON.stringify(created)}`);
  }

  return created.id;
}

async function uploadFile(accessToken: string, folderId: string, fileName: string, content: string) {
  const boundary = "----BackupBoundary";
  const metadata = { name: fileName, parents: [folderId] };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n${content}\r\n` +
    `--${boundary}--`;

  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  const responseData = await response.json();
  if (!response.ok) {
    throw new Error(`Upload failed for ${fileName}: ${JSON.stringify(responseData)}`);
  }

  return responseData;
}

// ── Backup builder ─────────────────────────────────────────────────

async function buildBackupForEmpresa(serviceClient: ReturnType<typeof createClient>, empresaId: string) {
  const backup: Record<string, unknown[]> = {};
  const log: { table: string; rows: number; status: string }[] = [];

  for (const table of TABLES) {
    let query = serviceClient.from(table).select("*");
    query = table === "empresa_config" ? query.eq("id", empresaId) : query.eq("empresa_id", empresaId);

    const { data, error } = await query;

    if (error) {
      log.push({ table, rows: 0, status: error.message });
      continue;
    }

    backup[table] = data ?? [];
    log.push({ table, rows: data?.length ?? 0, status: "ok" });
  }

  return { backup, log };
}

// ── Main handler ───────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      throw new Error("Supabase environment variables are missing");
    }

    // Authenticate user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get empresa
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", authData.user.id)
      .single();

    if (!profile?.empresa_id) {
      return new Response(JSON.stringify({ error: "Empresa não encontrada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: empresa } = await serviceClient
      .from("empresa_config")
      .select("nome")
      .eq("id", profile.empresa_id)
      .single();

    const empresaNome = empresa?.nome || profile.empresa_id;

    // Build backup data
    const { backup, log } = await buildBackupForEmpresa(serviceClient, profile.empresa_id);

    // Get OAuth access token (Gmail pessoal)
    const accessToken = await getAccessTokenViaOAuth();

    // Create folder structure
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toISOString().slice(11, 19).replace(/:/g, "-");
    const backupFolderName = `backup_${dateStr}_${timeStr}`;

    const empresaFolderId = await findOrCreateFolder(accessToken, DRIVE_FOLDER_ID, empresaNome);
    const backupFolderId = await findOrCreateFolder(accessToken, empresaFolderId, backupFolderName);

    // Upload individual tables
    let uploadedTables = 0;
    for (const [table, rows] of Object.entries(backup)) {
      const fileName = `${TABLE_LABELS[table] || table}.json`;
      await uploadFile(accessToken, backupFolderId, fileName, JSON.stringify(rows, null, 2));
      uploadedTables += 1;
    }

    // Upload consolidated backup
    await uploadFile(accessToken, backupFolderId, "backup_completo.json", JSON.stringify({
      generated_at: now.toISOString(),
      empresa_id: profile.empresa_id,
      empresa_nome: empresaNome,
      tables: backup,
      table_labels: TABLE_LABELS,
    }, null, 2));

    // Upload log
    await uploadFile(accessToken, backupFolderId, "log_backup.json", JSON.stringify({
      generated_at: now.toISOString(),
      empresa_id: profile.empresa_id,
      empresa_nome: empresaNome,
      total_tables: TABLES.length,
      uploaded_tables: uploadedTables,
      details: log,
    }, null, 2));

    return new Response(JSON.stringify({
      success: true,
      folder: backupFolderName,
      tables: uploadedTables,
      log,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Backup to Drive error:", err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
