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
  funcionarios: "Funcionários", epis: "EPIs", entregas: "Entregas",
  fichas_entrega: "Fichas de Entrega", dds: "DDS",
  dds_participantes: "DDS Participantes", inspecoes: "Inspeções",
  inspecao_itens: "Itens de Inspeção", inspecoes_subestacao: "Inspeções Subestação",
  treinamentos: "Treinamentos", treinamento_participantes: "Participantes Treinamento",
  controle_treinamentos: "Controle Treinamentos", cursos_documentos: "Cursos/Documentos",
  exames: "Exames", medicos: "Médicos", ordens_servico: "Ordens de Serviço",
  conformidades: "Conformidades", empresa_config: "Empresa",
};

const DRIVE_FOLDER_ID = "1b0ct6P0v3bVdSC4fSIf9k-pj1owtzVE5";

// ---- JWT / Google Auth helpers ----

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8", binary,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );
}

async function createSignedJwt(email: string, key: CryptoKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: email,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const enc = new TextEncoder();
  const input = base64url(enc.encode(JSON.stringify(header))) + "." +
    base64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(input));
  return input + "." + base64url(sig);
}

async function getAccessToken(saJson: any): Promise<string> {
  const key = await importPrivateKey(saJson.private_key);
  const jwt = await createSignedJwt(saJson.client_email, key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google Auth error: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ---- Google Drive helpers ----

async function findOrCreateFolder(
  accessToken: string, parentId: string, name: string
): Promise<string> {
  const q = encodeURIComponent(
    `'${parentId}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  if (data.files?.length > 0) return data.files[0].id;

  const create = await fetch("https://www.googleapis.com/drive/v3/files", {
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
  const folder = await create.json();
  return folder.id;
}

async function uploadFile(
  accessToken: string, folderId: string, fileName: string, content: string
) {
  const metadata = { name: fileName, parents: [folderId] };
  const boundary = "----BackupBoundary";
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload failed for ${fileName}: ${err}`);
  }
  return await res.json();
}

// ---- Main handler ----

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const saJsonRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!saJsonRaw) {
      return new Response(JSON.stringify({ error: "Google service account not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const saJson = JSON.parse(saJsonRaw);

    // Auth: verify user
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await serviceClient
      .from("profiles").select("empresa_id").eq("user_id", user.id).single();
    if (!profile?.empresa_id) {
      return new Response(JSON.stringify({ error: "Empresa não encontrada" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get empresa name for folder
    const { data: empresa } = await serviceClient
      .from("empresa_config").select("nome").eq("id", profile.empresa_id).single();
    const empresaNome = empresa?.nome || profile.empresa_id;

    // Export all tables
    const backup: Record<string, unknown[]> = {};
    const log: { table: string; rows: number; status: string }[] = [];

    for (const table of TABLES) {
      let query = serviceClient.from(table).select("*");
      if (table === "empresa_config") {
        query = query.eq("id", profile.empresa_id);
      } else {
        query = query.eq("empresa_id", profile.empresa_id);
      }
      const { data, error } = await query;
      if (!error && data) {
        backup[table] = data;
        log.push({ table, rows: data.length, status: "ok" });
      } else {
        log.push({ table, rows: 0, status: error?.message || "error" });
      }
    }

    // Get Google access token
    const accessToken = await getAccessToken(saJson);

    // Create folder structure: DRIVE_FOLDER_ID / empresaNome / backup_date
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toISOString().slice(11, 19).replace(/:/g, "-");

    const empresaFolderId = await findOrCreateFolder(accessToken, DRIVE_FOLDER_ID, empresaNome);
    const backupFolderName = `backup_${dateStr}_${timeStr}`;
    const backupFolderId = await findOrCreateFolder(accessToken, empresaFolderId, backupFolderName);

    // Upload each table as individual JSON
    let uploadedCount = 0;
    for (const [table, rows] of Object.entries(backup)) {
      if (!Array.isArray(rows) || rows.length === 0) continue;
      const fileName = `${TABLE_LABELS[table] || table}.json`;
      const content = JSON.stringify(rows, null, 2);
      await uploadFile(accessToken, backupFolderId, fileName, content);
      uploadedCount++;
    }

    // Upload full backup JSON
    const fullBackup = JSON.stringify({
      generated_at: now.toISOString(),
      empresa_id: profile.empresa_id,
      empresa_nome: empresaNome,
      tables: backup,
      table_labels: TABLE_LABELS,
    }, null, 2);
    await uploadFile(accessToken, backupFolderId, "backup_completo.json", fullBackup);

    // Upload log
    const logContent = JSON.stringify({
      generated_at: now.toISOString(),
      empresa: empresaNome,
      total_tables: TABLES.length,
      tables_with_data: uploadedCount,
      details: log,
    }, null, 2);
    await uploadFile(accessToken, backupFolderId, "log_backup.json", logContent);

    return new Response(
      JSON.stringify({
        success: true,
        folder: backupFolderName,
        tables: uploadedCount,
        log,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Backup to Drive error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
