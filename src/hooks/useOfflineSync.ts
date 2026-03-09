import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSyncQueue, removeFromSyncQueue, SyncOperation } from "@/lib/offlineStorage";
import { useToast } from "@/hooks/use-toast";

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

    for (const op of queue) {
      try {
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
    // Sync when coming back online
    const handleOnline = () => {
      setTimeout(processQueue, 1000);
    };

    window.addEventListener("online", handleOnline);

    // Try to sync on mount
    if (navigator.onLine) {
      processQueue();
    }

    return () => window.removeEventListener("online", handleOnline);
  }, [processQueue]);

  return { processQueue, pendingCount: getSyncQueue().length };
}
