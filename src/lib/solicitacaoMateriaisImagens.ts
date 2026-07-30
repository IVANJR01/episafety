import { supabase } from "@/integrations/supabase/client";

export const SOLIC_MAT_IMG_BUCKET = "solicitacoes-materiais-imagens";
export const MAX_IMG_BYTES = 20 * 1024 * 1024; // 20MB antes da compressão
export const ACCEPTED_IMG_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Reduz um bitmap ja decodificado para `maxSide` e devolve o canvas pronto. */
function desenharReduzido(bitmap: ImageBitmap, maxSide: number) {
  const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Descarta o buffer do canvas — em alguns navegadores so sai da memoria assim. */
function liberarCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

export type ImagemPreparada = { blob: Blob; type: string; ext: string; thumb: string };

/**
 * Decodifica a foto UMA vez e produz, do mesmo bitmap, o arquivo que sobe e a
 * miniatura da tela.
 *
 * Antes eram duas decodificacoes por foto — uma na escolha (miniatura) e outra
 * no salvamento (compressao) — e nenhuma liberava o bitmap. Uma foto de celular
 * de 12 MP ocupa mais de 48 MB decodificada; com varias fotos na mesma
 * solicitacao isso somava centenas de MB presos ate o coletor de lixo passar,
 * e a aba ficava em branco.
 */
export async function prepararImagemItem(
  file: File, maxSide = 1600, quality = 0.85, thumbSide = 480, thumbQuality = 0.7,
): Promise<ImagemPreparada> {
  const semImagem = () => ({
    blob: file as Blob, type: file.type, ext: (file.name.split(".").pop() || "bin").toLowerCase(),
    thumb: URL.createObjectURL(file),
  });
  if (!file.type.startsWith("image/")) return semImagem();

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const grande = desenharReduzido(bitmap, maxSide);
    const blob: Blob = await new Promise((res) => grande.toBlob((b) => res(b || file), "image/jpeg", quality));
    const pequeno = desenharReduzido(bitmap, thumbSide);
    const thumb = pequeno.toDataURL("image/jpeg", thumbQuality);
    liberarCanvas(grande);
    liberarCanvas(pequeno);
    return { blob, type: "image/jpeg", ext: "jpg", thumb };
  } catch {
    return semImagem();
  } finally {
    bitmap?.close?.();
  }
}

/** Comprime imagem para no máximo `maxSide` px no maior lado, retornando JPEG blob. */
export async function compressImage(file: File, maxSide = 1600, quality = 0.85): Promise<{ blob: Blob; type: string; ext: string }> {
  if (!file.type.startsWith("image/")) return { blob: file, type: file.type, ext: (file.name.split(".").pop() || "bin").toLowerCase() };
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const canvas = desenharReduzido(bitmap, maxSide);
    const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b || file), "image/jpeg", quality));
    liberarCanvas(canvas);
    return { blob, type: "image/jpeg", ext: "jpg" };
  } catch {
    return { blob: file, type: file.type, ext: (file.name.split(".").pop() || "jpg").toLowerCase() };
  } finally {
    bitmap?.close?.();
  }
}

/** Gera thumbnail leve (dataURL) para preview em tela, sem travar mobile. */
export async function makeThumbnailDataUrl(file: File, maxSide = 480, quality = 0.7): Promise<string> {
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const canvas = desenharReduzido(bitmap, maxSide);
    const url = canvas.toDataURL("image/jpeg", quality);
    liberarCanvas(canvas);
    return url;
  } catch {
    return URL.createObjectURL(file);
  } finally {
    bitmap?.close?.();
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
