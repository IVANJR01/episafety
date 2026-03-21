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

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const normalized = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  const binary = Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0));

  return await crypto.subtle.importKey(
    "pkcs8",
    binary,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function createSignedJwt(clientEmail: string, privateKey: CryptoKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const encoder = new TextEncoder();

  const header = base64url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = base64url(encoder.encode(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })));

  const unsignedToken = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    encoder.encode(unsignedToken),
  );

  return `${unsignedToken}.${base64url(new Uint8Array(signature))}`;
}

function parseGoogleServiceAccount(raw: string): Record<string, string> {
  console.log("SA_JSON first 100 chars:", JSON.stringify(raw.slice(0, 100)));
  console.log("SA_JSON length:", raw.length);
  console.log("SA_JSON char codes [0..5]:", Array.from(raw.slice(0, 6)).map(c => c.charCodeAt(0)));

  // Try direct parse first
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.client_email) {
      return parsed as Record<string, string>;
    }
  } catch (e) {
    console.log("Direct parse failed:", (e as Error).message);
  }

  // Try trimming
  const trimmed = raw.replace(/^\uFEFF/, "").trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && parsed.client_email) {
      return parsed as Record<string, string>;
    }
  } catch (e) {
    console.log("Trimmed parse failed:", (e as Error).message);
  }

  // Try unwrapping double-stringified
  try {
    const unwrapped = JSON.parse(trimmed);
    if (typeof unwrapped === "string") {
      const parsed = JSON.parse(unwrapped);
      if (parsed && typeof parsed === "object" && parsed.client_email) {
        return parsed as Record<string, string>;
      }
    }
  } catch (e) {
    console.log("Double-unwrap parse failed:", (e as Error).message);
  }

  // Try base64 decode
  try {
    const decoded = atob(trimmed);
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed === "object" && parsed.client_email) {
      return parsed as Record<string, string>;
    }
  } catch (e) {
    console.log("Base64 decode failed:", (e as Error).message);
  }

  throw new Error("Invalid GOOGLE_SERVICE_ACCOUNT_JSON format. First 50 chars: " + raw.slice(0, 50));
  }

  return current as Record<string, string>;
}

async function readJsonSafely(response: Response) {
  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function getAccessToken(serviceAccount: Record<string, string>): Promise<string> {
  const privateKey = await importPrivateKey(serviceAccount.private_key);
  const jwt = await createSignedJwt(serviceAccount.client_email, privateKey);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await readJsonSafely(response);
  if (!response.ok) {
    throw new Error(`Google Auth error: ${JSON.stringify(data)}`);
  }

  if (!data?.access_token) {
    throw new Error(`Google Auth missing access_token: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

async function findOrCreateFolder(accessToken: string, parentId: string, name: string): Promise<string> {
  const query = encodeURIComponent(
    `'${parentId}' in parents and name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );

  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  const searchData = await readJsonSafely(searchResponse);
  if (!searchResponse.ok) {
    throw new Error(`Drive search error: ${JSON.stringify(searchData)}`);
  }

  if (searchData?.files?.length) {
    return searchData.files[0].id;
  }

  const createResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
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

  const createdFolder = await readJsonSafely(createResponse);
  if (!createResponse.ok) {
    throw new Error(`Drive folder create error: ${JSON.stringify(createdFolder)}`);
  }

  if (!createdFolder?.id) {
    throw new Error(`Drive folder create missing id: ${JSON.stringify(createdFolder)}`);
  }

  return createdFolder.id;
}

async function uploadFile(accessToken: string, folderId: string, fileName: string, content: string) {
  const boundary = "----BackupBoundary";
  const metadata = { name: fileName, parents: [folderId] };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${content}\r\n` +
    `--${boundary}--`;

  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  const responseData = await readJsonSafely(response);
  if (!response.ok) {
    throw new Error(`Upload failed for ${fileName}: ${JSON.stringify(responseData)}`);
  }

  return responseData;
}

async function buildBackupForEmpresa(serviceClient: ReturnType<typeof createClient>, empresaId: string) {
  const backup: Record<string, unknown[]> = {};
  const log: { table: string; rows: number; status: string }[] = [];

  for (const table of TABLES) {
    let query = serviceClient.from(table).select("*");

    if (table === "empresa_config") {
      query = query.eq("id", empresaId);
    } else {
      query = query.eq("empresa_id", empresaId);
    }

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
    const serviceAccountRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      throw new Error("Supabase environment variables are missing");
    }

    if (!serviceAccountRaw) {
      throw new Error("Google service account not configured");
    }

    const serviceAccount = parseGoogleServiceAccount(serviceAccountRaw);
    if (!serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error("Google service account inválida");
    }

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

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", authData.user.id)
      .single();

    if (profileError || !profile?.empresa_id) {
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
    const { backup, log } = await buildBackupForEmpresa(serviceClient, profile.empresa_id);

    const accessToken = await getAccessToken(serviceAccount);
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toISOString().slice(11, 19).replace(/:/g, "-");
    const backupFolderName = `backup_${dateStr}_${timeStr}`;

    const empresaFolderId = await findOrCreateFolder(accessToken, DRIVE_FOLDER_ID, empresaNome);
    const backupFolderId = await findOrCreateFolder(accessToken, empresaFolderId, backupFolderName);

    let uploadedTables = 0;

    for (const [table, rows] of Object.entries(backup)) {
      const fileName = `${TABLE_LABELS[table] || table}.json`;
      await uploadFile(accessToken, backupFolderId, fileName, JSON.stringify(rows, null, 2));
      uploadedTables += 1;
    }

    await uploadFile(
      accessToken,
      backupFolderId,
      "backup_completo.json",
      JSON.stringify({
        generated_at: now.toISOString(),
        empresa_id: profile.empresa_id,
        empresa_nome: empresaNome,
        tables: backup,
        table_labels: TABLE_LABELS,
      }, null, 2),
    );

    await uploadFile(
      accessToken,
      backupFolderId,
      "log_backup.json",
      JSON.stringify({
        generated_at: now.toISOString(),
        empresa_id: profile.empresa_id,
        empresa_nome: empresaNome,
        total_tables: TABLES.length,
        uploaded_tables: uploadedTables,
        details: log,
      }, null, 2),
    );

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
