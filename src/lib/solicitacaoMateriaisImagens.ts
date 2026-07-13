import { supabase } from "@/integrations/supabase/client";

export const SOLIC_MAT_IMG_BUCKET = "solicitacoes-materiais-imagens";
export const MAX_IMG_BYTES = 5 * 1024 * 1024; // 5MB
export const ACCEPTED_IMG_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Comprime imagem para no máximo `maxSide` px no maior lado, retornando JPEG blob. */
export async function compressImage(file: File, maxSide = 1600, quality = 0.85): Promise<{ blob: Blob; type: string; ext: string }> {
  if (!file.type.startsWith("image/")) return { blob: file, type: file.type, ext: (file.name.split(".").pop() || "bin").toLowerCase() };
  try {
    const bitmap = await createImageBitmap(file);
    const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * ratio);
    const h = Math.round(bitmap.height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b || file), "image/jpeg", quality));
    return { blob, type: "image/jpeg", ext: "jpg" };
  } catch {
    return { blob: file, type: file.type, ext: (file.name.split(".").pop() || "jpg").toLowerCase() };
  }
}

export function buildItemImagePath(empresaId: string, solicitacaoId: string, itemKey: string, ext: string) {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  const stamp = Date.now();
  return `${empresaId}/solicitacoes/${solicitacaoId}/itens/${itemKey}/${stamp}.${safeExt}`;
}

export async function uploadItemImage(path: string, blob: Blob, contentType: string) {
  const { error } = await supabase.storage
    .from(SOLIC_MAT_IMG_BUCKET)
    .upload(path, blob, { contentType, upsert: true, cacheControl: "3600" });
  if (error) throw error;
  return path;
}

export async function getSignedImageUrl(path: string, ttl = 600): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(SOLIC_MAT_IMG_BUCKET).createSignedUrl(path, ttl);
  if (error) {
    console.warn("[solic-mat-img] signed url failed", error.message);
    return null;
  }
  return data?.signedUrl || null;
}

export async function removeItemImage(path?: string | null) {
  if (!path) return;
  try {
    const { error } = await supabase.storage.from(SOLIC_MAT_IMG_BUCKET).remove([path]);
    if (error) console.warn("[solic-mat-img] remove failed", error.message);
  } catch (e) {
    console.warn("[solic-mat-img] remove threw", e);
  }
}

/** Lista recursivamente e apaga todas as imagens de uma solicitação. */
export async function removeSolicitacaoImages(empresaId: string, solicitacaoId: string) {
  const base = `${empresaId}/solicitacoes/${solicitacaoId}/itens`;
  try {
    const { data: itemDirs } = await supabase.storage.from(SOLIC_MAT_IMG_BUCKET).list(base, { limit: 1000 });
    if (!itemDirs?.length) return;
    const toRemove: string[] = [];
    for (const d of itemDirs) {
      const sub = `${base}/${d.name}`;
      const { data: files } = await supabase.storage.from(SOLIC_MAT_IMG_BUCKET).list(sub, { limit: 1000 });
      files?.forEach((f) => toRemove.push(`${sub}/${f.name}`));
    }
    if (toRemove.length) await supabase.storage.from(SOLIC_MAT_IMG_BUCKET).remove(toRemove);
  } catch (e) {
    console.warn("[solic-mat-img] cleanup falhou", e);
  }
}

/** Fetch signed URL and convert to dataURL (para embutir no PDF). */
export async function loadImageAsDataUrl(path: string): Promise<string | null> {
  const url = await getSignedImageUrl(path, 300);
  if (!url) return null;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("[solic-mat-img] dataurl fetch failed", e);
    return null;
  }
}
