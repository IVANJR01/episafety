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
  const { data, error } = await supabase.functions.invoke("gdrive-token", {
    body: { folder },
  });
  if (error) throw new Error(error.message || "Failed to get Drive token");
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
 * Delete a file from Google Drive (still uses edge function - tiny payload)
 */
export async function deleteFromDrive(fileId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("gdrive-storage", {
    body: { fileId },
    headers: { "x-action": "delete" },
  });
  if (error) throw new Error(error.message || "Delete from Drive failed");
  if (data?.error) throw new Error(data.error);
}

/**
 * List files in a Drive folder (still uses edge function - tiny payload)
 */
export async function listDriveFiles(folder: string) {
  const { data, error } = await supabase.functions.invoke("gdrive-storage", {
    body: null,
    headers: { "x-action": "list", "x-folder": folder },
  });
  if (error) throw new Error(error.message || "List from Drive failed");
  if (data?.error) throw new Error(data.error);
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
