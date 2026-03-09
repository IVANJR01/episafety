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

export function addToSyncQueue(op: Omit<SyncOperation, "id" | "timestamp">) {
  const queue = getSyncQueue();
  queue.push({
    ...op,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  });
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

export function removeFromSyncQueue(id: string) {
  const queue = getSyncQueue().filter(op => op.id !== id);
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

export function clearSyncQueue() {
  localStorage.removeItem(SYNC_QUEUE_KEY);
}

export function isOnline(): boolean {
  return navigator.onLine;
}
