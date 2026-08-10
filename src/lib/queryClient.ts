import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

export const QUERY_PERSIST_MAX_AGE = 24 * 60 * 60 * 1000;

/**
 * Quanto tempo um dado já buscado vale sem precisar buscar de novo.
 *
 * Era `Infinity`, com atualização ao voltar o foco e ao reconectar
 * desligadas. Na prática cada tela buscava do servidor uma vez e nunca
 * mais — e como o cache é gravado no aparelho, a defasagem atravessava até
 * o fechamento do aplicativo. No celular instalado, que fica aberto em
 * segundo plano, dava para passar horas olhando a lista de quando a tela
 * foi aberta: cadastro feito no computador não aparecia lá.
 *
 * Trinta segundos é o meio-termo. Trocar de tela e voltar não dispara
 * busca nova; voltar ao aplicativo depois de um tempo, ou recuperar o
 * sinal, sim. Consulta que realmente não muda (catálogo, tipos de
 * documento) continua podendo declarar `staleTime: Infinity` por conta
 * própria — opção local vence o padrão.
 */
export const QUERY_STALE_MS = 30_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_MS,
      gcTime: QUERY_PERSIST_MAX_AGE,
      retry: false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: { retry: false },
  },
});

export const QUERY_PERSIST_KEY = "safetysolucoes-react-query-cache";

export const storagePersister = typeof window !== "undefined"
  ? createSyncStoragePersister({
      storage: window.localStorage,
      key: QUERY_PERSIST_KEY,
    })
  : undefined;

/**
 * Wipe every trace of React-Query cache (memory + persisted localStorage).
 * Call on sign-out and when the authenticated user changes to prevent
 * cross-tenant data leaks.
 */
export function purgeQueryCache() {
  try {
    queryClient.clear();
    queryClient.removeQueries();
  } catch {}
  try {
    storagePersister?.removeClient();
  } catch {}
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(QUERY_PERSIST_KEY);
    }
  } catch {}
}
