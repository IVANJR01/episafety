// Storage helpers para fotos do módulo de Inspeções.
// Storage helpers para fotos do módulo de Inspeções.
// Bucket: inspecoes-fotos
// Path canônico: <empresa_id>/inspecoes/<inspection_id>/<label>_<ts>_<rand>.<ext>
import { supabase } from "@/integrations/supabase/client";

export const INSPECOES_BUCKET = "inspecoes-fotos";
export const MAX_INSPECAO_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export function buildInspecaoPath(
  empresaId: string,
  inspectionId: string,
  label: "antes" | "depois",
  ext = "jpg",
): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${empresaId}/inspecoes/${inspectionId}/${label}_${ts}_${rand}.${ext}`;
}

export async function uploadInspecaoPhoto(
  file: File | Blob,
  empresaId: string,
  inspectionId: string,
  label: "antes" | "depois",
): Promise<{ path: string; signedUrl: string | null }> {
  if (!empresaId) throw new Error("empresa_id ausente para upload da foto.");
  if (!inspectionId) throw new Error("inspection_id ausente para upload da foto.");
  if (!file || (file as Blob).size === 0) throw new Error(`Foto ${label} inválida (arquivo vazio).`);
  if ((file as Blob).size > MAX_INSPECAO_PHOTO_BYTES) {
    throw new Error(`Foto ${label} excede o tamanho máximo de 8 MB.`);
  }
  const type = ((file as Blob).type || "image/jpeg").toLowerCase();
  if (!ALLOWED_MIME.has(type)) {
    throw new Error(`Formato de imagem não suportado (${type}). Use JPG, PNG ou WEBP.`);
  }
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  const path = buildInspecaoPath(empresaId, inspectionId, label, ext);

  const { error } = await supabase.storage.from(INSPECOES_BUCKET).upload(path, file, {
    contentType: type,
    upsert: false,
  });
  if (error) {
    console.error("[inspecoesStorage] upload error", error, { path });
    throw new Error(error.message || "Falha no upload ao Supabase Storage");
  }

  const signedUrl = await getInspecaoPhotoSignedUrl(path);
  return { path, signedUrl };
}

export async function getInspecaoPhotoSignedUrl(
  path: string,
  ttlSec = 3600,
): Promise<string | null> {
  if (!path) return null;
  try {
    const { data, error } = await supabase.storage
      .from(INSPECOES_BUCKET)
      .createSignedUrl(path, ttlSec);
    if (error) {
      console.warn("[inspecoesStorage] createSignedUrl failed", error.message, path);
      return null;
    }
    return data?.signedUrl || null;
  } catch (e) {
    console.warn("[inspecoesStorage] createSignedUrl exception", e);
    return null;
  }
}

export async function deleteInspecaoPhoto(path: string): Promise<void> {
  if (!path) return;
  const { error } = await supabase.storage.from(INSPECOES_BUCKET).remove([path]);
  if (error && !/not.*found/i.test(error.message)) {
    console.warn("[inspecoesStorage] delete failed", error.message, path);
  }
}

/** Detecta um path canônico do bucket inspecoes-fotos (não é URL http nem data URI). */
export function isInspecaoStoragePath(value: string | null | undefined): value is string {
  if (!value || typeof value !== "string") return false;
  if (value.startsWith("http://") || value.startsWith("https://")) return false;
  if (value.startsWith("data:") || value.startsWith("blob:")) return false;
  return /^[0-9a-fA-F-]{8,}\/inspecoes\//.test(value);
}
