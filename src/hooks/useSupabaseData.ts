import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getCachedData, setCachedData, addToSyncQueue, isOnline } from "@/lib/offlineStorage";
import { isNetworkFailure } from "@/lib/offlineViewCache";

const QUERY_TIMEOUT_MS = 3000;
const QUERY_GC_MS = 24 * 60 * 60 * 1000;

const withTimeout = <T,>(promise: Promise<T>, timeoutMs = QUERY_TIMEOUT_MS) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("timeout")), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  }) as Promise<T>;
};

const getSupabaseQueryKey = (
  table: string,
  orderBy?: string,
  ascending?: boolean,
  columns?: string,
  scopeKey?: string,
) => [
  "supabase",
  table,
  orderBy || null,
  ascending ?? false,
  columns || "*",
  scopeKey || "",
] as const;

// Tabelas que NÃO possuem coluna empresa_id — não aplicar filtro client-side.
const TABLES_WITHOUT_EMPRESA_ID = new Set<string>([
]);

export function useSupabaseQuery<T = any>(table: string, orderBy?: string, ascending?: boolean, columns?: string) {
  const { toast } = useToast();
  const { empresaScopeIds } = useAuth();
  // Aplicamos filtro client-side: garante que o seletor de empresa funcione para todos.
  // Super Admin precisa disso pois a RLS deles libera tudo.
  // Usuarios Principais também precisam para isolar dados de filiais quando desejarem.
  const applyEmpresaFilter = empresaScopeIds.length > 0
    && !TABLES_WITHOUT_EMPRESA_ID.has(table);
  const scopeKey = applyEmpresaFilter ? empresaScopeIds.join(",") : "";
  const filterByEmpresaScope = useCallback((rows?: T[] | null) => {
    if (!rows) return rows;
    if (!applyEmpresaFilter) return rows;
    const allowed = new Set(empresaScopeIds);
    return rows.filter((row: any) => row?.empresa_id && allowed.has(row.empresa_id));
  }, [applyEmpresaFilter, empresaScopeIds]);

  const cachedData = useMemo(() => filterByEmpresaScope(getCachedData<T>(table)) ?? undefined, [filterByEmpresaScope, table]);
  const queryKey = useMemo(
    () => getSupabaseQueryKey(table, orderBy, ascending, columns, scopeKey),
    [table, orderBy, ascending, columns, scopeKey],
  );
  const backgroundRefreshStartedRef = useRef(false);
  const errorToastShownRef = useRef(false);

  const query = useQuery<T[]>({
    queryKey,
    initialData: cachedData,
    staleTime: Infinity,
    gcTime: QUERY_GC_MS,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const cached = filterByEmpresaScope(getCachedData<T>(table));

      if (!isOnline()) {
        return cached || [];
      }

      try {
        let queryBuilder = (supabase.from as any)(table).select(columns || "*");
        if (applyEmpresaFilter) {
          queryBuilder = queryBuilder.in("empresa_id", empresaScopeIds);
        }
        if (orderBy) queryBuilder = queryBuilder.order(orderBy, { ascending: ascending ?? false });

        const { data: rows, error } = await withTimeout(queryBuilder) as any;
        if (error) throw error;

        const result = filterByEmpresaScope((rows as T[]) || []) || [];
        setCachedData(table, result);
        return result;
      } catch (error) {
        if (cached && isNetworkFailure(error)) {
          return cached;
        }

        if (cached) {
          return cached;
        }

        if (isNetworkFailure(error)) {
          return [];
        }

        throw error;
      }
    },
  });

  const fetch = useCallback(async () => query.refetch(), [query]);

  useEffect(() => {
    if (!cachedData || !isOnline() || backgroundRefreshStartedRef.current) return;

    backgroundRefreshStartedRef.current = true;
    // Stagger background refresh with a random delay (0-2s) to avoid flooding
    const delay = Math.floor(Math.random() * 2000);
    const timer = setTimeout(() => void query.refetch(), delay);
    return () => clearTimeout(timer);
  }, [cachedData, query]);

  useEffect(() => {
    backgroundRefreshStartedRef.current = false;
  }, [table, orderBy, ascending, columns]);

  useEffect(() => {
    if (!query.error) {
      errorToastShownRef.current = false;
      return;
    }

    if (isNetworkFailure(query.error) || errorToastShownRef.current) {
      return;
    }

    errorToastShownRef.current = true;
    console.warn(`[useSupabaseQuery] Erro ao carregar dados da tabela "${table}":`, query.error);
  }, [query.error, table]);

  return {
    data: query.data || [],
    loading: query.isLoading && query.data === undefined,
    refetch: fetch,
  };
}

export function useSupabaseCrud<T extends { id: string } = any>(table: string, orderBy?: string, ascending?: boolean) {
  const { data, loading, refetch } = useSupabaseQuery<T>(table, orderBy, ascending);
  const { toast } = useToast();
  const { empresaId } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => getSupabaseQueryKey(table, orderBy, ascending, undefined), [table, orderBy, ascending]);

  const syncLocalState = useCallback((nextData: T[]) => {
    setCachedData(table, nextData);
    queryClient.setQueryData(queryKey, nextData);
  }, [queryClient, queryKey, table]);

  const add = async (item: Partial<T>) => {
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { ...item, empresa_id: empresaId, created_by: user?.id || null } as any;

    if (!isOnline()) {
      // Generate temp id and save locally
      const tempId = crypto.randomUUID();
      payload.id = tempId;
      addToSyncQueue({ table, type: "insert", payload });
      // Update local cache optimistically
      const cached = getCachedData<T>(table) || [];
      const nextData = [payload as T, ...cached];
      syncLocalState(nextData);
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
      syncLocalState(updated);
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
      syncLocalState(cached.filter(item => (item as any).id !== id));
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
