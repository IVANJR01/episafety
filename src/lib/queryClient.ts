import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

export const QUERY_PERSIST_MAX_AGE = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      gcTime: QUERY_PERSIST_MAX_AGE,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
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
