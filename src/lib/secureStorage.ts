// ============================================================================
// Storage seguro para PDFs/XMLs de SST.
// - Default: Supabase Storage privado (bucket sst-documentos) — homologação.
// - Alternativo: Google Drive BYOK (mantido como provider opcional).
// Banco recebe apenas: hash SHA-256, bucket, path, tamanho, versão.
// XML/PDF binário nunca trafega via audit log nem é gravado em tabelas.
// ============================================================================
import { supabase } from "@/integrations/supabase/client";
import { uploadToDrive } from "@/lib/googleDriveStorage";

export type StorageProvider = "supabase_storage" | "google_drive_byok";

export const SST_BUCKET = "sst-documentos";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(d))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Resolve o provider configurado para a empresa. Default: supabase_storage. */
export async function getEmpresaStorageProvider(
  empresa_id: string,
): Promise<StorageProvider> {
  try {
    const { data } = await (supabase.from as any)("empresa_config")
      .select("storage_provider")
      .eq("id", empresa_id)
      .maybeSingle();
    const p = (data?.storage_provider as string) || "supabase_storage";
    return p === "google_drive_byok" ? "google_drive_byok" : "supabase_storage";
  } catch {
    return "supabase_storage";
  }
}

export interface UploadDocumentoParams {
  empresa_id: string;
  /** "pdf" ou "xml" */
  kind: "pdf" | "xml";
  /** ex.: "pgr", "cat", "ltcat", "ppp", "s2210", "s2240" */
  modulo: string;
  /** id do documento/evento — base do diretório */
  documento_id: string;
  /** versão do documento (PDFs). XMLs podem omitir. */
  versao?: number;
  /** Nome de arquivo final. */
  fileName: string;
  /** Conteúdo. */
  blob: Blob;
  /** Forçar provider. Default: lê empresa_config. */
  provider?: StorageProvider;
  /** Pasta Drive legada — usada apenas se provider=google_drive_byok. */
  driveFolderFallback?: string;
}

export interface UploadDocumentoResult {
  provider: StorageProvider;
  bucket: string | null;
  path: string | null;
  /** Referência a ser passada ao RPC `_drive_file_id`. Sentinel `sb://...`
   *  para Supabase Storage ou o `fileId` real do Drive. */
  ref: string;
  /** Link visualizável (Drive) ou null (Supabase — usar getSignedUrlSeguro). */
  viewLink: string | null;
  hash: string;
  size: number;
}

/** Faz upload do PDF/XML no provider correto e devolve a referência canônica. */
export async function uploadDocumentoSeguro(
  p: UploadDocumentoParams,
): Promise<UploadDocumentoResult> {
  if (!p.empresa_id || !UUID_RE.test(p.empresa_id)) {
    throw new Error("empresa_id inválido para storage seguro");
  }
  if (!p.documento_id) throw new Error("documento_id é obrigatório");

  const buf = await p.blob.arrayBuffer();
  const hash = await sha256Hex(buf);
  const size = p.blob.size;

  const provider =
    p.provider ?? (await getEmpresaStorageProvider(p.empresa_id));

  // ---------------------- Supabase Storage (default) ----------------------
  if (provider === "supabase_storage") {
    const versaoSeg =
      typeof p.versao === "number" && p.versao > 0 ? `v${p.versao}/` : "";
    const path = `${p.empresa_id}/${p.kind}/${p.modulo}/${p.documento_id}/${versaoSeg}${p.fileName}`;

    if (!path.startsWith(`${p.empresa_id}/`)) {
      throw new Error("Path fora do tenant — abortado");
    }

    const { error } = await supabase.storage
      .from(SST_BUCKET)
      .upload(path, p.blob, {
        upsert: true,
        contentType:
          p.kind === "pdf" ? "application/pdf" : "application/xml",
      });
    if (error) {
      throw new Error(`Falha no upload Supabase Storage: ${error.message}`);
    }
    return {
      provider,
      bucket: SST_BUCKET,
      path,
      ref: `sb://${SST_BUCKET}/${path}`,
      viewLink: null,
      hash,
      size,
    };
  }

  // ---------------------- Google Drive BYOK (legado) ----------------------
  const folder = p.driveFolderFallback || `${p.modulo}/${p.documento_id}`;
  const file =
    p.blob instanceof File
      ? p.blob
      : new File([p.blob], p.fileName, {
          type:
            p.kind === "pdf" ? "application/pdf" : "application/xml",
        });
  const up = await uploadToDrive(file, folder, p.fileName, {
    makePublic: false,
  });
  return {
    provider,
    bucket: null,
    path: folder,
    ref: up.fileId,
    viewLink: up.webViewLink || null,
    hash,
    size,
  };
}

/** Gera signed URL temporária para Supabase Storage (TTL curto, validado server-side). */
export async function getSignedUrlSeguro(opts: {
  bucket?: string;
  path: string;
  ttl?: number; // segundos, 10..300
  download?: boolean;
}): Promise<string> {
  const bucket = opts.bucket || SST_BUCKET;
  const ttl = Math.min(Math.max(opts.ttl ?? 120, 10), 300);
  const { data, error } = await supabase.functions.invoke("signed-url", {
    body: { bucket, path: opts.path, ttl, download: !!opts.download },
  });
  if (error) {
    const msg =
      (data as any)?.error || error.message || "Falha ao gerar signed URL";
    throw new Error(msg);
  }
  const url = (data as any)?.url;
  if (!url) throw new Error("Signed URL ausente na resposta");
  return url as string;
}

/** Helper: para uma referência canônica devolvida pelo upload, abre a URL adequada. */
export async function resolveDocumentoUrl(opts: {
  provider: StorageProvider;
  bucket?: string | null;
  path?: string | null;
  driveViewLink?: string | null;
  ttl?: number;
  download?: boolean;
}): Promise<string> {
  if (opts.provider === "supabase_storage") {
    if (!opts.path) throw new Error("Path ausente para Supabase Storage");
    return getSignedUrlSeguro({
      bucket: opts.bucket || SST_BUCKET,
      path: opts.path,
      ttl: opts.ttl,
      download: opts.download,
    });
  }
  if (!opts.driveViewLink) throw new Error("Link do Drive ausente");
  return opts.driveViewLink;
}
