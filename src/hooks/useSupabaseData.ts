import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useSupabaseQuery<T>(table: string, orderBy?: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetch = useCallback(async () => {
    setLoading(true);
    let query = supabase.from(table).select("*");
    if (orderBy) query = query.order(orderBy, { ascending: false });
    const { data: rows, error } = await query;
    if (error) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    } else {
      setData((rows as T[]) || []);
    }
    setLoading(false);
  }, [table, orderBy]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useSupabaseCrud<T extends { id: string }>(table: string, orderBy?: string) {
  const { data, loading, refetch } = useSupabaseQuery<T>(table, orderBy);
  const { toast } = useToast();

  const add = async (item: Omit<T, "id" | "created_at" | "updated_at" | "created_by">) => {
    const { error } = await supabase.from(table).insert(item as any);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return false;
    }
    await refetch();
    return true;
  };

  const update = async (id: string, updates: Partial<T>) => {
    const { error } = await supabase.from(table).update(updates as any).eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return false;
    }
    await refetch();
    return true;
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return false;
    }
    await refetch();
    return true;
  };

  return { data, loading, refetch, add, update, remove };
}
