import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getCachedData, setCachedData, addToSyncQueue, isOnline } from "@/lib/offlineStorage";
import { isNetworkFailure } from "@/lib/offlineViewCache";

const QUERY_TIMEOUT_MS = 10000;
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

/**
 * Gaveta do cache local: a tabela, mais a lista de colunas quando ela é
 * parcial.
 *
 * A chave do react-query já separava consultas por `columns`; a do cache no
 * aparelho, não — era só o nome da tabela. Duas telas lendo a MESMA tabela com
 * colunas diferentes dividiam a mesma gaveta, e a mais estreita apagava a
 * mais completa.
 *
 * Foi o que aconteceu com as entregas. O Dashboard busca
 * "id, funcionario_id, epi_id, quantidade, data, created_at, tipo,
 * created_by, empresa_id" — sem `assinatura_colaborador` e sem `status`. Esse
 * retrato mutilado virava o conteúdo de `entregas`, e a tela de Entregas
 * abria com ele: sem o campo da assinatura, TODA entrega parecia pendente.
 * Daí "Assinar (24)" e a coluna Status em branco por um ou dois segundos, até
 * a busca completa chegar e corrigir tudo.
 *
 * Consulta sem `columns` traz a linha inteira e continua na gaveta com o nome
 * puro da tabela — é a mesma chave que as telas usam ao gravar direto, para
 * edição offline.
 */
function chaveDeCache(table: string, columns?: string): string {
  return columns && columns.trim() && columns.trim() !== "*"
    ? `${table}::${columns.replace(/\s+/g, "")}`
    : table;
}

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

  const cacheKey = chaveDeCache(table, columns);

  /**
   * Retrato local que serve de `initialData` — ou nada, quando não serve.
   *
   * Filtrar por empresa pode esvaziar um retrato que existe e tem linhas: é o
   * que acontece quando ele é de OUTRA empresa. Devolver `[]` nesse caso é o
   * pior dos mundos, porque lista vazia não é estado de carregando: a tela
   * abre pronta, com zero registros, e as buscas por id caem no vazio — o
   * colaborador vira "—" e o EPI vira "EPI não localizado no cadastro", como
   * se os cadastros tivessem sumido.
   *
   * `[]` só é resposta legítima vinda do servidor. Vindo do filtro, significa
   * "este retrato não é desta empresa" — e aí o certo é não ter retrato
   * nenhum, deixando a tela em carregando até a busca real responder.
   */
  const lerRetratoLocal = useCallback((): T[] | undefined => {
    const bruto = getCachedData<T>(cacheKey);
    if (!bruto || bruto.length === 0) return undefined;
    const noEscopo = filterByEmpresaScope(bruto);
    if (!noEscopo || noEscopo.length === 0) return undefined;
    return noEscopo;
  }, [filterByEmpresaScope, cacheKey]);

  const cachedData = useMemo(() => lerRetratoLocal(), [lerRetratoLocal]);
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
    // Falha de rede sem cache local vira erro permanente sem isto: a linha
    // 100-104 só devolve `cached` quando existe um `cached` — na primeira
    // carga num aparelho novo (ou depois de limpar dados), ou quando essa
    // tabela nunca sincronizou nele antes, não existe nada para devolver, e
    // o erro sobe. Com retry:false a consulta desistia de vez no primeiro
    // soluço de sinal — sobrava lista vazia para sempre, sem aviso nenhum,
    // parecendo dado corrompido (nome de colaborador e de EPI sumindo da
    // tela) quando era só a rede tropeçando uma vez.
    //
    // Só reage a falha de rede: erro de permissão/RLS repetir não resolve, e
    // insistir nesses só atrasa mostrar o estado de erro real.
    retry: (failureCount, error) => isNetworkFailure(error) && failureCount < 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const cached = lerRetratoLocal();

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
        setCachedData(cacheKey, result);
        return result;
      } catch (error) {
        if (cached && isNetworkFailure(error)) {
          return cached;
        }

        if (cached) {
          return cached;
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
    refreshing: query.isFetching,
    /**
     * O servidor já confirmou estes dados DESDE que a tela abriu?
     *
     * Com retrato guardado no aparelho, `initialData` entrega a lista de
     * imediato e o react-query não busca sozinho — então `refreshing` fica
     * FALSO durante os 0-2s até a atualização em segundo plano começar. Quem
     * usasse só `refreshing` para saber se pode confiar no que está na tela
     * teria um buraco exatamente nessa janela, que é onde o usuário olha.
     *
     * `isFetchedAfterMount` não tem esse buraco: só vira verdadeiro quando
     * uma resposta do servidor chega depois da montagem.
     */
    verificado: query.isFetchedAfterMount,
    error: query.error,
    refetch: fetch,
  };
}

export function useSupabaseCrud<T extends { id: string } = any>(table: string, orderBy?: string, ascending?: boolean) {
  // `refreshing` sinaliza a atualização em segundo plano que roda logo após a
  // tela abrir com o retrato guardado no aparelho. Sem repassá-lo, quem
  // consome este hook não tem como saber que o que está na tela ainda pode
  // estar velho — e acaba anunciando número como se fosse definitivo.
  const { data, loading, refreshing, verificado, refetch } = useSupabaseQuery<T>(table, orderBy, ascending);
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

  return { data, loading, refreshing, verificado, refetch, add, update, remove };
}
