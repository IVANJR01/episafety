import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ROOT_FOLDER_NAME = "EPISafety";
const BACKUP_FOLDER_NAME = "EPISafety_SYSTEM_BACKUPS";

const TABLES = [
  "funcionarios", "epis", "entregas", "fichas_entrega",
  "dds", "dds_participantes", "inspecoes", "inspecao_itens",
  "inspecoes_subestacao", "treinamentos", "treinamento_participantes",
  "controle_treinamentos", "cursos_documentos", "exames", "medicos",
  "ordens_servico", "conformidades", "empresa_config",
  "contratos", "contrato_epis", "contrato_epis_movimentacoes",
  "requisitos_cliente", "cursos_video", "usuarios_liberados",
  "profiles", "user_roles",
];

// ── OAuth ──────────────────────────────────────────────────────────
async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_OAUTH_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) throw new Error("Google OAuth credentials missing");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: refreshToken, grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(`OAuth error: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ── Drive helpers ──────────────────────────────────────────────────
async function findOrCreateFolder(token: string, parentId: string, name: string): Promise<string> {
  const q = encodeURIComponent(
    `'${parentId}' in parents and name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
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
  if (!createRes.ok || !created?.id) throw new Error(`Root folder error: ${JSON.stringify(created)}`);
  return created.id;
}

async function uploadFileToDrive(
  token: string, folderId: string, fileName: string, content: string, mimeType: string
): Promise<{ id: string; webViewLink: string }> {
  const boundary = "----BackupBoundary";
  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
  const encoder = new TextEncoder();
  const body = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n--${boundary}--`
  );

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Upload error: ${JSON.stringify(data)}`);
  return { id: data.id, webViewLink: data.webViewLink || "" };
}

// ── Cleanup old backups (keep last 8) ──────────────────────────────
async function cleanupOldBackups(token: string, folderId: string) {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,createdTime)&orderBy=createdTime desc&pageSize=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  const files = data?.files || [];

  // Keep the 8 most recent, delete the rest
  for (let i = 8; i < files.length; i++) {
    await fetch(`https://www.googleapis.com/drive/v3/files/${files[i].id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

// ── Main handler ───────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const log: string[] = [];

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, serviceKey);

    log.push("🔐 Autenticando com Google Drive...");
    const token = await getAccessToken();

    log.push("📁 Criando pasta de backup...");
    const rootId = await getRootFolderId(token);
    const systemBackupFolderId = await findOrCreateFolder(token, rootId, BACKUP_FOLDER_NAME);

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "_");
    const backupFileName = `backup_episafety_${dateStr}.json`;

    // Get all empresas (matrizes)
    const { data: empresas } = await serviceClient
      .from("empresa_config")
      .select("id, nome")
      .is("empresa_pai_id", null);

    if (!empresas?.length) throw new Error("Nenhuma empresa encontrada");

    log.push(`📊 ${empresas.length} empresa(s) encontrada(s)`);

    const fullBackup: Record<string, unknown> = {
      generated_at: now.toISOString(),
      version: "1.0",
      type: "scheduled_weekly",
      empresas_count: empresas.length,
      tables: TABLES,
      data: {},
    };

    let totalRecords = 0;

    // For each empresa (matriz + filiais)
    for (const empresa of empresas) {
      const { data: filiais } = await serviceClient
        .from("empresa_config")
        .select("id, nome")
        .eq("empresa_pai_id", empresa.id);

      const allIds = [empresa.id, ...(filiais || []).map((f: any) => f.id)];
      const empresaData: Record<string, unknown[]> = {};

      for (const table of TABLES) {
        try {
          let query = serviceClient.from(table).select("*");

          if (table === "empresa_config") {
            query = query.in("id", allIds);
          } else if (table === "profiles" || table === "user_roles") {
            // These don't have empresa_id filter easily, get all
            if (table === "profiles") {
              query = query.in("empresa_id", allIds);
            } else {
              // user_roles: get all (small table)
              query = query;
            }
          } else {
            query = query.in("empresa_id", allIds);
          }

          const { data: rows } = await query.limit(5000);
          empresaData[table] = rows || [];
          totalRecords += (rows || []).length;
        } catch {
          empresaData[table] = [];
        }
      }

      (fullBackup.data as Record<string, unknown>)[empresa.nome || empresa.id] = {
        empresa_id: empresa.id,
        empresa_nome: empresa.nome,
        filiais: filiais?.map((f: any) => ({ id: f.id, nome: f.nome })) || [],
        tables: empresaData,
      };

      log.push(`✅ ${empresa.nome}: ${Object.values(empresaData).reduce((s, r) => s + r.length, 0)} registros`);
    }

    (fullBackup as any).total_records = totalRecords;

    // Upload to Drive
    log.push("⬆️ Enviando backup para Google Drive...");
    const uploadResult = await uploadFileToDrive(
      token, systemBackupFolderId, backupFileName,
      JSON.stringify(fullBackup, null, 2), "application/json"
    );

    log.push(`✅ Upload concluído: ${backupFileName}`);

    // Cleanup old backups
    await cleanupOldBackups(token, systemBackupFolderId);
    log.push("🧹 Backups antigos removidos (mantendo últimos 8)");

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log.push(`⏱️ Tempo total: ${elapsed}s`);

    return new Response(JSON.stringify({
      success: true,
      fileName: backupFileName,
      fileId: uploadResult.id,
      totalRecords,
      empresas: empresas.length,
      elapsed: `${elapsed}s`,
      log,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("scheduled-backup error:", message);
    log.push(`❌ ERRO: ${message}`);
    return new Response(JSON.stringify({ success: false, error: message, log }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
