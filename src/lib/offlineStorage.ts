// Offline cache and sync queue for Supabase data

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
export function getCachedData<T>(table: string): T[] | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + table);
    if (!raw) return null;
    const { data, expiry } = JSON.parse(raw);
    if (expiry && Date.now() > expiry) {
      localStorage.removeItem(CACHE_PREFIX + table);
      return null;
    }
    return data as T[];
  } catch {
    return null;
  }
}

export function setCachedData<T>(table: string, data: T[], ttlMs = 7 * 24 * 60 * 60 * 1000) {
  try {
    localStorage.setItem(CACHE_PREFIX + table, JSON.stringify({ data, expiry: Date.now() + ttlMs }));
  } catch {
    // storage full – silently fail
  }
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
