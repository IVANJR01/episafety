import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSyncQueue, removeFromSyncQueue, preCacheAllData, SyncOperation } from "@/lib/offlineStorage";
import { useToast } from "@/hooks/use-toast";
import { uploadInspecaoPhoto } from "@/lib/inspecoesStorage";
import {
  isOfflinePhotoMarker,
  getOfflinePhotoBlob,
  deleteOfflinePhoto,
} from "@/lib/inspecoesOfflinePhotos";

// Tables that may contain base64 photo fields needing upload
const PHOTO_FIELDS: Record<string, string[]> = {
  inspecoes_subestacao: ["fotos"],
  dds_participantes: ["assinatura"],
};

async function uploadBase64ToDrive(base64: string, folder: string): Promise<string | null> {
  try {
    const { uploadToDrive } = await import("@/lib/googleDriveStorage");
    const res = await fetch(base64);
    const blob = await res.blob();
    const ext = blob.type.includes("png") ? "png" : "jpg";
    const file = new File([blob], `sync_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`, { type: blob.type });
    const result = await uploadToDrive(file, folder, file.name);
    return result.publicUrl;
  } catch (err) {
    console.error("[useOfflineSync] Failed to upload base64 photo to Drive:", err);
    return null;
  }
}

async function uploadBase64ToInspecoesStorage(
  base64: string,
  empresaId: string,
  inspectionId: string,
  label: "antes" | "depois",
): Promise<string | null> {
  try {
    const res = await fetch(base64);
    const blob = await res.blob();
    const ext = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
    const file = new File([blob], `${label}_${Date.now()}.${ext}`, { type: blob.type || "image/jpeg" });
    const { path } = await uploadInspecaoPhoto(file, empresaId, inspectionId, label);
    return path;
  } catch (err) {
    console.error("[useOfflineSync] Failed to upload inspecao photo to Supabase Storage:", err);
    return null;
  }
}

function isBase64DataUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:");
}

async function processPhotoFields(op: SyncOperation): Promise<SyncOperation> {
  if (!op.payload) return op;

  const updatedPayload = { ...op.payload };
  let changed = false;

  // Conformidades (Inspeções) → Storage privado, com paths gravados em foto_*_path
  if (op.table === "conformidades") {
    const empresaId = updatedPayload.empresa_id;
    const inspectionId = updatedPayload.id;
    if (!empresaId || !inspectionId) return op;

    for (const field of ["foto_antes", "foto_depois"] as const) {
      const value = updatedPayload[field];

      // Caso 1: marcador IndexedDB (novo formato offline)
      if (isOfflinePhotoMarker(value)) {
        const label = field === "foto_antes" ? "antes" : "depois";
        try {
          const blob = await getOfflinePhotoBlob(value);
          if (!blob) {
            // Sem blob correspondente — descarta marcador para não travar o sync.
            updatedPayload[field] = null;
            changed = true;
            continue;
          }
          const { path } = await uploadInspecaoPhoto(blob, empresaId, inspectionId, label);
          updatedPayload[`${field}_path`] = path;
          updatedPayload[field] = null;
          changed = true;
          // Blob subiu com sucesso — libera espaço no IDB.
          await deleteOfflinePhoto(value);
        } catch (err) {
          console.error("[useOfflineSync] Falha ao subir foto IDB da inspeção:", err);
          return op; // mantém para retry
        }
        continue;
      }

      // Caso 2 (legado): base64 direto no payload
      if (isBase64DataUrl(value)) {
        const label = field === "foto_antes" ? "antes" : "depois";
        const path = await uploadBase64ToInspecoesStorage(value, empresaId, inspectionId, label);
        if (path) {
          updatedPayload[`${field}_path`] = path;
          updatedPayload[field] = null;
          changed = true;
        } else {
          return op; // retry later
        }
      }
    }
    return changed ? { ...op, payload: updatedPayload } : op;
  }

  const fields = PHOTO_FIELDS[op.table];
  if (!fields) return op;

  for (const field of fields) {
    const value = updatedPayload[field];

    // Handle single base64 field
    if (isBase64DataUrl(value)) {
      const url = await uploadBase64ToDrive(value, op.table);
      if (url) {
        updatedPayload[field] = url;
        changed = true;
      } else {
        // Upload failed — keep base64 so it can retry later
        return op;
      }
    }

    // Handle array of base64 (e.g. inspecoes_subestacao.fotos)
    if (Array.isArray(value)) {
      const newArr = [...value];
      for (let i = 0; i < newArr.length; i++) {
        if (isBase64DataUrl(newArr[i])) {
          const url = await uploadBase64ToDrive(newArr[i], op.table);
          if (url) {
            newArr[i] = url;
            changed = true;
          } else {
            return op; // retry later
          }
        }
      }
      if (changed) updatedPayload[field] = newArr;
    }
  }

  return changed ? { ...op, payload: updatedPayload } : op;
}

export function useOfflineSync() {
  const { toast } = useToast();
  const syncingRef = useRef(false);

  const processQueue = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    const queue = getSyncQueue();
    if (queue.length === 0) return;

    syncingRef.current = true;
    let synced = 0;
    let failed = 0;

    for (const rawOp of queue) {
      try {
        // Upload any base64 photos before syncing
        const op = await processPhotoFields(rawOp);

        let error: any = null;
        if (op.type === "insert") {
          const res = await (supabase.from as any)(op.table).insert(op.payload);
          error = res.error;
        } else if (op.type === "update") {
          const { id, ...updates } = op.payload;
          const res = await (supabase.from as any)(op.table).update(updates).eq("id", id);
          error = res.error;
        } else if (op.type === "delete") {
          const res = await (supabase.from as any)(op.table).delete().eq("id", op.payload.id);
          error = res.error;
        }

        if (error) {
          console.error("Sync error:", error);
          failed++;
        } else {
          removeFromSyncQueue(op.id);
          synced++;
        }
      } catch {
        failed++;
      }
    }

    if (synced > 0) {
      toast({
        title: "Dados sincronizados",
        description: `${synced} operação(ões) sincronizada(s) com sucesso.`,
      });
      preCacheAllData().catch(() => {});
    }
    if (failed > 0) {
      toast({
        title: "Erro na sincronização",
        description: `${failed} operação(ões) falharam. Serão tentadas novamente.`,
        variant: "destructive",
      });
    }

    syncingRef.current = false;
  }, [toast]);

  useEffect(() => {
    const handleOnline = () => {
      setTimeout(processQueue, 1000);
    };

    /*
     * Também ao voltar para o aplicativo.
     *
     * Só o evento `online` não basta no celular: o sistema suspende a página
     * quando o aplicativo vai para segundo plano, e a volta da conexão pode
     * acontecer sem que esse evento chegue à página adormecida. O que estava
     * na fila ficava lá parado até alguém reabrir a tela do zero — gravação
     * feita em campo, sem sinal, esperando indefinidamente para subir.
     */
    const handleVisible = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        setTimeout(processQueue, 500);
      }
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisible);

    if (navigator.onLine) {
      processQueue();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [processQueue]);

  return { processQueue, pendingCount: getSyncQueue().length };
}
