// Offline cache and sync queue for Supabase data

import { supabase } from "@/integrations/supabase/client";

const CACHE_PREFIX = "offline_cache_";
const SYNC_QUEUE_KEY = "offline_sync_queue";

export interface SyncOperation {
  id: string;
  table: string;
  type: "insert" | "update" | "delete";
  payload: any;
  timestamp: number;
}

const getEntityId = (payload: any): string | null => {
  const id = payload?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
};

const persistQueue = (queue: SyncOperation[]): boolean => {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    return true;
  } catch (error) {
    console.error("Offline sync queue full or unavailable:", error);
    return false;
  }
};

// --- Cache ---
export function getCachedData<T>(key: string): T[] | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { data, expiry } = JSON.parse(raw);
    if (expiry && Date.now() > expiry) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return data as T[];
  } catch {
    return null;
  }
}

export function setCachedData<T>(key: string, data: T[], ttlMs = 7 * 24 * 60 * 60 * 1000) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, expiry: Date.now() + ttlMs }));
  } catch {
    // storage full – silently fail
  }
}

// --- Cached Query Helper ---
// Wraps any supabase query with automatic caching and offline fallback
export async function cachedQuery<T = any>(
  cacheKey: string,
  queryFn: () => Promise<{ data: T[] | null; error: any }>,
): Promise<{ data: T[]; error: any; offline: boolean }> {
  if (!isOnline()) {
    const cached = getCachedData<T>(cacheKey);
    return { data: cached || [], error: null, offline: true };
  }

  try {
    const result = await queryFn();
    if (result.error) {
      // Network/server error — use cache
      const cached = getCachedData<T>(cacheKey);
      if (cached) {
        return { data: cached, error: result.error, offline: true };
      }
      return { data: [], error: result.error, offline: false };
    }
    const data = (result.data as T[]) || [];
    setCachedData(cacheKey, data);
    return { data, error: null, offline: false };
  } catch (err) {
    const cached = getCachedData<T>(cacheKey);
    return { data: cached || [], error: err, offline: true };
  }
}

// --- Cached RPC Helper ---
export async function cachedRpc<T = any>(
  cacheKey: string,
  fnName: string,
  params?: Record<string, any>,
): Promise<{ data: T | null; error: any; offline: boolean }> {
  if (!isOnline()) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + cacheKey);
      if (raw) {
        const { data } = JSON.parse(raw);
        return { data: data as T, error: null, offline: true };
      }
    } catch {}
    return { data: null, error: null, offline: true };
  }

  try {
    const result = await (supabase.rpc as any)(fnName, params || {});
    if (result.error) {
      try {
        const raw = localStorage.getItem(CACHE_PREFIX + cacheKey);
        if (raw) {
          const { data } = JSON.parse(raw);
          return { data: data as T, error: result.error, offline: true };
        }
      } catch {}
      return { data: null, error: result.error, offline: false };
    }
    // Cache the result
    try {
      localStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify({ data: result.data, expiry: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
    } catch {}
    return { data: result.data as T, error: null, offline: false };
  } catch (err) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + cacheKey);
      if (raw) {
        const { data } = JSON.parse(raw);
        return { data: data as T, error: err, offline: true };
      }
    } catch {}
    return { data: null, error: err, offline: true };
  }
}

// --- Pre-cache all critical tables ---
const CRITICAL_TABLES = [
  "epis",
  "funcionarios",
  "entregas",
  "empresa_config",
  "contratos",
  "contrato_epis",
  "contrato_epis_movimentacoes",
  "contrato_responsaveis",
  "dds",
  "dds_participantes",
  "treinamentos",
  "treinamento_participantes",
  "controle_treinamentos",
  "cursos_documentos",
  "exames",
  "medicos",
  "inspecoes",
  "inspecao_itens",
  "inspecoes_subestacao",
  "conformidades",
  "ordens_servico",
  "fichas_entrega",
  "solicitacoes_epi",
  "usuarios_liberados",
  "profiles",
];

export async function preCacheAllData(): Promise<{ cached: number; failed: number }> {
  if (!isOnline()) return { cached: 0, failed: 0 };

  let cached = 0;
  let failed = 0;

  // Process in parallel batches of 8 with a small delay between batches
  for (let i = 0; i < CRITICAL_TABLES.length; i += 8) {
    const batch = CRITICAL_TABLES.slice(i, i + 8);
    const results = await Promise.allSettled(
      batch.map(async (table) => {
        const { data, error } = await (supabase.from as any)(table).select("*");
        if (!error && data) {
          setCachedData(table, data);
          return true;
        }
        throw error;
      })
    );
    results.forEach(r => {
      if (r.status === "fulfilled") cached++;
      else failed++;
    });
    // Small yield between batches to avoid blocking the main thread
    if (i + 8 < CRITICAL_TABLES.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Also cache RPC results
  try {
    const { data } = await (supabase.rpc as any)("get_consolidated_epi_stock", {});
    if (data) {
      localStorage.setItem(CACHE_PREFIX + "rpc_consolidated_stock", JSON.stringify({ data, expiry: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
    }
  } catch {}

  console.log(`[Offline] Pre-cached ${cached} tables, ${failed} failed`);
  return { cached, failed };
}

// --- Sync Queue ---
export function getSyncQueue(): SyncOperation[] {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToSyncQueue(op: Omit<SyncOperation, "id" | "timestamp">): boolean {
  const queue = getSyncQueue();
  const entityId = getEntityId(op.payload);

  if (entityId && op.type === "update") {
    // Merge update into pending insert to keep queue small and fast
    const pendingInsertIndex = queue.findIndex(
      (item) => item.table === op.table && item.type === "insert" && getEntityId(item.payload) === entityId,
    );

    if (pendingInsertIndex >= 0) {
      queue[pendingInsertIndex] = {
        ...queue[pendingInsertIndex],
        payload: { ...queue[pendingInsertIndex].payload, ...op.payload },
        timestamp: Date.now(),
      };
      return persistQueue(queue);
    }

    // Merge consecutive updates for same row
    let latestUpdateIndex = -1;
    for (let i = queue.length - 1; i >= 0; i--) {
      const item = queue[i];
      if (item.table === op.table && item.type === "update" && getEntityId(item.payload) === entityId) {
        latestUpdateIndex = i;
        break;
      }
    }

    if (latestUpdateIndex >= 0) {
      queue[latestUpdateIndex] = {
        ...queue[latestUpdateIndex],
        payload: { ...queue[latestUpdateIndex].payload, ...op.payload },
        timestamp: Date.now(),
      };
      return persistQueue(queue);
    }
  }

  if (entityId && op.type === "delete") {
    const withoutTargetOps = queue.filter(
      (item) => !(item.table === op.table && getEntityId(item.payload) === entityId),
    );

    // If it was never synced (pending insert), just drop queue ops instead of adding delete
    const hadPendingInsert = queue.some(
      (item) => item.table === op.table && item.type === "insert" && getEntityId(item.payload) === entityId,
    );

    if (hadPendingInsert) {
      return persistQueue(withoutTargetOps);
    }

    withoutTargetOps.push({ ...op, id: crypto.randomUUID(), timestamp: Date.now() });
    return persistQueue(withoutTargetOps);
  }

  queue.push({
    ...op,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  });

  return persistQueue(queue);
}

export function removeFromSyncQueue(id: string) {
  const queue = getSyncQueue().filter(op => op.id !== id);
  persistQueue(queue);
}

export function clearSyncQueue() {
  localStorage.removeItem(SYNC_QUEUE_KEY);
}

export function isOnline(): boolean {
  return navigator.onLine;
}
