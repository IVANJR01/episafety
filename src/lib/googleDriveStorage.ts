import { supabase } from "@/integrations/supabase/client";

export interface DriveUploadResult {
  fileId: string;
  publicUrl: string;
  webViewLink: string;
}

interface TokenResponse {
  accessToken: string;
  folderId: string;
  empresaNome: string;
}

/**
 * Get a short-lived Google Drive access token and target folder ID
 * from the lightweight edge function (no file binary transferred).
 */
async function getDriveToken(folder: string): Promise<TokenResponse> {
  // Refresh session to ensure valid JWT before calling edge function
  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    console.error("[getDriveToken] Session refresh failed:", refreshError.message);
  }

  const { data, error } = await supabase.functions.invoke("gdrive-token", {
    body: { folder },
  });
  if (error) {
    const msg = typeof data === "object" && data?.error
      ? data.error
      : error.message || "Failed to get Drive token";
    console.error("[getDriveToken] Error:", msg, "Raw data:", data);
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data as TokenResponse;
}

/**
 * Upload a file DIRECTLY from the browser to Google Drive API.
 * The file binary never passes through Edge Functions, saving network.
 */
export async function uploadToDrive(
  file: File | Blob,
  folder: string,
  fileName?: string
): Promise<DriveUploadResult> {
  // Step 1: Get token + folder ID from lightweight edge function (~1KB network)
  const { accessToken, folderId } = await getDriveToken(folder);

  // Step 2: Upload directly from browser to Google Drive API (0 edge function network)
  const actualFile = file instanceof File
    ? file
    : new File([file], fileName || `${Date.now()}.bin`, { type: file.type || "application/octet-stream" });

  const metadata = {
    name: actualFile.name,
    parents: [folderId],
  };

  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  formData.append("file", actualFile);

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    }
  );

  const uploadData = await uploadRes.json();
  if (!uploadRes.ok) {
    throw new Error(`Drive upload failed: ${uploadData?.error?.message || JSON.stringify(uploadData)}`);
  }

  // Step 3: Set file as public (small request)
  await fetch(`https://www.googleapis.com/drive/v3/files/${uploadData.id}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });

  return {
    fileId: uploadData.id,
    publicUrl: `https://drive.google.com/uc?export=view&id=${uploadData.id}`,
    webViewLink: uploadData.webViewLink || `https://drive.google.com/file/d/${uploadData.id}/view`,
  };
}

/**
 * Delete a file from Google Drive using token from gdrive-token
 */
export async function deleteFromDrive(fileId: string): Promise<void> {
  const { accessToken } = await getDriveToken("geral");

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Delete from Drive failed: ${text}`);
  }
}

/**
 * List files in a Drive folder (uses token from gdrive-token)
 */
export async function listDriveFiles(folder: string) {
  const { accessToken, folderId } = await getDriveToken(folder);

  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,createdTime,size,webViewLink)&orderBy=createdTime desc&pageSize=50`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(`List from Drive failed: ${JSON.stringify(data)}`);
  return data.files || [];
}

/**
 * Get a public view URL for a Drive file
 */
export function getDrivePublicUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

export function getDriveDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}
