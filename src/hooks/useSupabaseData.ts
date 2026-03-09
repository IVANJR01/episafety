import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type TableName = keyof Database["public"]["Tables"];
type Row<T extends TableName> = Database["public"]["Tables"][T]["Row"];
type Insert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];
type Update<T extends TableName> = Database["public"]["Tables"][T]["Update"];

export function useSupabaseQuery<T extends TableName>(table: T, orderBy?: string) {
  const [data, setData] = useState<Row<T>[]>([]);
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
      setData((rows as Row<T>[]) || []);
    }
    setLoading(false);
  }, [table, orderBy]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useSupabaseCrud<T extends TableName>(table: T, orderBy?: string) {
  const { data, loading, refetch } = useSupabaseQuery<T>(table, orderBy);
  const { toast } = useToast();

  const add = async (item: Insert<T>) => {
    const { error } = await supabase.from(table).insert(item as any);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return false;
    }
    await refetch();
    return true;
  };

  const update = async (id: string, updates: Update<T>) => {
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
