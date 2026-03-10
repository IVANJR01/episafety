import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getCachedData, setCachedData, addToSyncQueue, isOnline } from "@/lib/offlineStorage";

export function useSupabaseQuery<T = any>(table: string, orderBy?: string, ascending?: boolean) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetch = useCallback(async () => {
    setLoading(true);

    if (!isOnline()) {
      // Use cached data when offline
      const cached = getCachedData<T>(table);
      if (cached) {
        setData(cached);
        setLoading(false);
        return;
      }
      toast({ title: "Offline", description: "Sem dados em cache para " + table, variant: "destructive" });
      setLoading(false);
      return;
    }

    let query = (supabase.from as any)(table).select("*");
    if (orderBy) query = query.order(orderBy, { ascending: ascending ?? false });
    const { data: rows, error } = await query;
    if (error) {
      // On network error, try cache
      const cached = getCachedData<T>(table);
      if (cached) {
        setData(cached);
        toast({ title: "Usando dados em cache", description: "Não foi possível conectar ao servidor." });
      } else {
        toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
      }
    } else {
      const result = (rows as T[]) || [];
      setData(result);
      // Cache data for offline use
      setCachedData(table, result);
    }
    setLoading(false);
  }, [table, orderBy, ascending]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useSupabaseCrud<T extends { id: string } = any>(table: string, orderBy?: string, ascending?: boolean) {
  const { data, loading, refetch } = useSupabaseQuery<T>(table, orderBy, ascending);
  const { toast } = useToast();
  const { empresaId } = useAuth();

  const add = async (item: Partial<T>) => {
    const payload = { ...item, empresa_id: empresaId } as any;

    if (!isOnline()) {
      // Generate temp id and save locally
      const tempId = crypto.randomUUID();
      payload.id = tempId;
      addToSyncQueue({ table, type: "insert", payload });
      // Update local cache optimistically
      const cached = getCachedData<T>(table) || [];
      cached.unshift(payload as T);
      setCachedData(table, cached);
      await refetch();
      toast({ title: "Salvo offline", description: "Será sincronizado quando houver conexão." });
      return true;
    }

    const { error } = await (supabase.from as any)(table).insert(payload);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return false;
    }
    await refetch();
    return true;
  };

  const update = async (id: string, updates: Partial<T>) => {
    if (!isOnline()) {
      addToSyncQueue({ table, type: "update", payload: { id, ...updates } });
      // Update local cache optimistically
      const cached = getCachedData<T>(table) || [];
      const updated = cached.map(item => (item as any).id === id ? { ...item, ...updates } : item);
      setCachedData(table, updated);
      await refetch();
      toast({ title: "Atualizado offline", description: "Será sincronizado quando houver conexão." });
      return true;
    }

    const { error } = await (supabase.from as any)(table).update(updates).eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return false;
    }
    await refetch();
    return true;
  };

  const remove = async (id: string) => {
    if (!isOnline()) {
      addToSyncQueue({ table, type: "delete", payload: { id } });
      // Update local cache optimistically
      const cached = getCachedData<T>(table) || [];
      setCachedData(table, cached.filter(item => (item as any).id !== id));
      await refetch();
      toast({ title: "Excluído offline", description: "Será sincronizado quando houver conexão." });
      return true;
    }

    const { error } = await (supabase.from as any)(table).delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return false;
    }
    await refetch();
    return true;
  };

  return { data, loading, refetch, add, update, remove };
}
