import { supabase } from "@/integrations/supabase/client";

export interface DriveUploadResult {
  fileId: string;
  publicUrl: string;
  webViewLink: string;
}

/**
 * Upload a file to Google Drive via the gdrive-storage edge function.
 * @param file - File or Blob to upload
 * @param folder - Subfolder inside the company's root (e.g. "logos", "fotos-reconhecimento")
 * @param fileName - Optional custom file name
 */
export async function uploadToDrive(
  file: File | Blob,
  folder: string,
  fileName?: string
): Promise<DriveUploadResult> {
  const formData = new FormData();

  if (file instanceof File) {
    formData.append("file", file);
  } else {
    formData.append("file", new File([file], fileName || `${Date.now()}.bin`, { type: file.type || "application/octet-stream" }));
  }
  formData.append("folder", folder);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const url = `https://${projectId}.supabase.co/functions/v1/gdrive-storage?action=upload`;

  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: formData,
  });

  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "Upload to Drive failed");

  return {
    fileId: data.fileId,
    publicUrl: data.publicUrl,
    webViewLink: data.webViewLink,
  };
}

/**
 * Delete a file from Google Drive
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
 * List files in a Drive folder
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
