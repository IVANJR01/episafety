import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-action, x-folder, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ROOT_FOLDER_NAME = "EPI-Safety-Backup";

// ── OAuth ──────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_OAUTH_REFRESH_TOKEN");

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google OAuth credentials missing");
  }

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
  if (!res.ok || !data.access_token) {
    throw new Error(`OAuth error: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

// ── Drive helpers ──────────────────────────────────────────────────

async function findOrCreateFolder(token: string, parentId: string, name: string): Promise<string> {
  const q = encodeURIComponent(
    `'${parentId}' in parents and name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const searchData = await searchRes.json();
  if (searchData?.files?.length) return searchData.files[0].id;

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  const created = await createRes.json();
  if (!createRes.ok || !created?.id) throw new Error(`Folder create error: ${JSON.stringify(created)}`);
  return created.id;
}

// Cache root folder ID per request
let _rootFolderId: string | null = null;

async function getRootFolderId(token: string): Promise<string> {
  if (_rootFolderId) return _rootFolderId;

  // Use "My Drive" root
  const q = encodeURIComponent(
    `name='${ROOT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (data?.files?.length) {
    _rootFolderId = data.files[0].id;
    return _rootFolderId!;
  }

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: ROOT_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  const created = await createRes.json();
  if (!createRes.ok || !created?.id) throw new Error(`Root folder create error: ${JSON.stringify(created)}`);
  _rootFolderId = created.id;
  return _rootFolderId!;
}

async function ensureFolderPath(token: string, path: string): Promise<string> {
  const rootId = await getRootFolderId(token);
  const parts = path.split("/").filter(Boolean);
  let currentId = rootId;
  for (const part of parts) {
    currentId = await findOrCreateFolder(token, currentId, part);
  }
  return currentId;
}

async function uploadFileToDrive(
  token: string,
  folderId: string,
  fileName: string,
  fileBytes: Uint8Array,
  mimeType: string
): Promise<{ id: string; webViewLink: string }> {
  const boundary = "----GDriveUploadBoundary";
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
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink",
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

  // Make the file readable by anyone with the link
  await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });

  return {
    id: data.id,
    webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
  };
}

async function deleteFileFromDrive(token: string, fileId: string) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Delete error: ${text}`);
  }
}

async function listFilesInFolder(token: string, folderId: string) {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,createdTime,size,webViewLink)&orderBy=createdTime desc&pageSize=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`List error: ${JSON.stringify(data)}`);
  return data.files || [];
}

// ── Auth helper ────────────────────────────────────────────────────

async function authenticateUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Missing authorization");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error("Unauthorized");

  const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", data.user.id)
    .single();

  if (!profile?.empresa_id) throw new Error("Empresa não encontrada");

  const { data: empresa } = await serviceClient
    .from("empresa_config")
    .select("nome")
    .eq("id", profile.empresa_id)
    .single();

  return {
    userId: data.user.id,
    empresaId: profile.empresa_id,
    empresaNome: empresa?.nome || profile.empresa_id,
  };
}

// ── Main handler ───────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { empresaId, empresaNome } = await authenticateUser(req);
    const token = await getAccessToken();

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ── UPLOAD ────────────────────────────────────────────────
    if (action === "upload" && req.method === "POST") {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      const folder = formData.get("folder") as string || "geral";

      if (!file) throw new Error("No file provided");

      const folderPath = `${empresaNome}/${folder}`;
      const folderId = await ensureFolderPath(token, folderPath);

      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await uploadFileToDrive(token, folderId, file.name, bytes, file.type || "application/octet-stream");

      const publicUrl = `https://drive.google.com/uc?export=view&id=${result.id}`;

      return new Response(JSON.stringify({
        success: true,
        fileId: result.id,
        webViewLink: result.webViewLink,
        publicUrl,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── DELETE ────────────────────────────────────────────────
    if (action === "delete" && req.method === "POST") {
      const { fileId } = await req.json();
      if (!fileId) throw new Error("No fileId provided");
      await deleteFileFromDrive(token, fileId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── LIST ─────────────────────────────────────────────────
    if (action === "list") {
      const folder = url.searchParams.get("folder") || "geral";
      const folderPath = `${empresaNome}/${folder}`;
      const folderId = await ensureFolderPath(token, folderPath);
      const files = await listFilesInFolder(token, folderId);
      return new Response(JSON.stringify({ success: true, files }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── GET URL (generate view/download link) ────────────────
    if (action === "url") {
      const fileId = url.searchParams.get("fileId");
      if (!fileId) throw new Error("No fileId provided");
      const publicUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      return new Response(JSON.stringify({ success: true, publicUrl, downloadUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use: upload, delete, list, url" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("gdrive-storage error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: err instanceof Error && err.message === "Unauthorized" ? 401 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
