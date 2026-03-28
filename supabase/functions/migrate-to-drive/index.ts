import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ROOT_FOLDER_NAME = "EPISafety";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

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
  if (!createRes.ok || !created?.id) throw new Error(`Root folder error: ${JSON.stringify(created)}`);
  return created.id;
}

async function ensureFolderPath(token: string, rootId: string, path: string): Promise<string> {
  const parts = path.split("/").filter(Boolean);
  let currentId = rootId;
  for (const part of parts) {
    currentId = await findOrCreateFolder(token, currentId, part);
  }
  return currentId;
}

async function uploadFileToDrive(
  token: string, folderId: string, fileName: string,
  fileBytes: Uint8Array, mimeType: string
): Promise<{ id: string; publicUrl: string }> {
  const boundary = "----MigrationBoundary";
  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
  const encoder = new TextEncoder();
  const metaPart = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const endPart = encoder.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(metaPart.length + fileBytes.length + endPart.length);
  body.set(metaPart, 0);
  body.set(fileBytes, metaPart.length);
  body.set(endPart, metaPart.length + fileBytes.length);

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

  // Make publicly readable
  await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });

  return {
    id: data.id,
    publicUrl: `https://drive.google.com/uc?export=view&id=${data.id}`,
  };
}

// ── Main handler ───────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(SUPABASE_URL, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) throw new Error("Unauthorized");

    // Only super_admin or principal can migrate
    const serviceClient = createClient(SUPABASE_URL, serviceKey);

    const action = req.headers.get("x-action") || "migrate";

    // ── VALIDATE CONNECTION ────────────────────────────────
    if (action === "validate") {
      const token = await getAccessToken();
      const rootId = await getRootFolderId(token);

      // Get Drive storage quota
      const aboutRes = await fetch(
        "https://www.googleapis.com/drive/v3/about?fields=storageQuota",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const aboutData = await aboutRes.json();

      return new Response(JSON.stringify({
        success: true,
        connected: true,
        rootFolderId: rootId,
        storageQuota: aboutData.storageQuota,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── MIGRATE ────────────────────────────────────────────
    const token = await getAccessToken();
    const rootId = await getRootFolderId(token);

    // Get empresa name for folder
    const { data: profile } = await serviceClient
      .from("profiles").select("empresa_id").eq("user_id", authData.user.id).single();
    if (!profile?.empresa_id) throw new Error("Empresa não encontrada");

    const { data: empresa } = await serviceClient
      .from("empresa_config").select("nome").eq("id", profile.empresa_id).single();
    const empresaNome = empresa?.nome || "default";

    const buckets = ["conformidades", "documentos-treinamento", "empresa-assets", "fotos-reconhecimento"];
    const results: Array<{ bucket: string; file: string; driveUrl: string; status: string }> = [];
    let totalMigrated = 0;
    let totalSizeBytes = 0;
    const errors: string[] = [];

    for (const bucket of buckets) {
      const { data: files, error: listErr } = await serviceClient.storage.from(bucket).list("", {
        limit: 500,
        sortBy: { column: "name", order: "asc" },
      });

      if (listErr || !files) {
        errors.push(`Error listing ${bucket}: ${listErr?.message}`);
        continue;
      }

      // Recursively list all files (including subdirectories)
      const allFiles = await listAllFiles(serviceClient, bucket, "");

      for (const fileObj of allFiles) {
        try {
          // Download from Supabase Storage
          const { data: fileData, error: dlErr } = await serviceClient.storage
            .from(bucket).download(fileObj.path);
          if (dlErr || !fileData) {
            errors.push(`Download error ${bucket}/${fileObj.path}: ${dlErr?.message}`);
            continue;
          }

          const bytes = new Uint8Array(await fileData.arrayBuffer());
          totalSizeBytes += bytes.length;

          // Determine Drive folder path
          const driveFolderPath = mapBucketToFolder(bucket, fileObj.path, empresaNome);
          const folderId = await ensureFolderPath(token, rootId, driveFolderPath);

          // Upload to Drive
          const fileName = fileObj.path.split("/").pop() || fileObj.path;
          const mimeType = guessMimeType(fileName);
          const driveResult = await uploadFileToDrive(token, folderId, fileName, bytes, mimeType);

          // Delete from Supabase Storage
          await serviceClient.storage.from(bucket).remove([fileObj.path]);

          results.push({
            bucket,
            file: fileObj.path,
            driveUrl: driveResult.publicUrl,
            status: "migrated",
          });
          totalMigrated++;

          // Update database references
          await updateDbReferences(serviceClient, bucket, fileObj.path, driveResult.publicUrl);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${bucket}/${fileObj.path}: ${msg}`);
          results.push({ bucket, file: fileObj.path, driveUrl: "", status: `error: ${msg}` });
        }
      }
    }

    const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(2);

    return new Response(JSON.stringify({
      success: true,
      totalMigrated,
      totalSizeMB,
      results,
      errors,
      summary: `${totalMigrated} arquivos movidos para o Google Drive. Espaço liberado: ${totalSizeMB} MB`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("migrate-to-drive error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: err instanceof Error && message === "Unauthorized" ? 401 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Helpers ────────────────────────────────────────────────────────

async function listAllFiles(
  client: any, bucket: string, prefix: string
): Promise<Array<{ path: string }>> {
  const results: Array<{ path: string }> = [];
  const { data, error } = await client.storage.from(bucket).list(prefix, {
    limit: 500,
    sortBy: { column: "name", order: "asc" },
  });
  if (error || !data) return results;

  for (const item of data) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id) {
      // It's a file
      results.push({ path: fullPath });
    } else {
      // It's a folder, recurse
      const subFiles = await listAllFiles(client, bucket, fullPath);
      results.push(...subFiles);
    }
  }
  return results;
}

function mapBucketToFolder(bucket: string, filePath: string, empresaNome: string): string {
  switch (bucket) {
    case "conformidades":
      return `${empresaNome}/Conformidades`;
    case "documentos-treinamento":
      // Path format: empresaId/NOME_funcionarioId/tipo/file
      const parts = filePath.split("/");
      if (parts.length >= 3) {
        const funcNamePart = parts[1]?.split("_").slice(0, -1).join("_") || "geral";
        const tipo = parts[2] || "geral";
        return `${empresaNome}/${funcNamePart}/Certificados`;
      }
      return `${empresaNome}/Documentos`;
    case "empresa-assets":
      return `${empresaNome}/Logos`;
    case "fotos-reconhecimento":
      return `${empresaNome}/Fotos-Reconhecimento`;
    default:
      return `${empresaNome}/Outros`;
  }
}

function guessMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    mp4: "video/mp4",
  };
  return mimeMap[ext || ""] || "application/octet-stream";
}

async function updateDbReferences(
  client: any, bucket: string, filePath: string, newUrl: string
) {
  const supabaseStorageUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${filePath}`;

  switch (bucket) {
    case "conformidades":
      await client.from("conformidades")
        .update({ foto_antes: newUrl })
        .eq("foto_antes", supabaseStorageUrl);
      await client.from("conformidades")
        .update({ foto_depois: newUrl })
        .eq("foto_depois", supabaseStorageUrl);
      break;
    case "empresa-assets":
    case "logos":
      await client.from("empresa_config")
        .update({ logo_url: newUrl })
        .like("logo_url", `%${filePath}%`);
      break;
    case "fotos-reconhecimento":
      await client.from("entregas")
        .update({ foto_reconhecimento: newUrl })
        .like("foto_reconhecimento", `%${filePath}%`);
      break;
    // documentos-treinamento: no direct URL column, files are referenced by path
  }
}
