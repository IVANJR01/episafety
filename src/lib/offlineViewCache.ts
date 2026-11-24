const VIEW_CACHE_PREFIX = "offline_view_cache";
/*
 * 90 dias, não 7: a cópia só serve quando falta internet, e obra sem sinal
 * passa de uma semana. Com sinal a tela sempre busca o dado novo.
 */
const DEFAULT_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 3000;

interface CacheEnvelope<T> {
  data: T;
  expiry: number;
}

function getCacheKey(key: string) {
  return `${VIEW_CACHE_PREFIX}:${key}`;
}

export function getOfflineViewCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(getCacheKey(key));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (parsed.expiry && Date.now() > parsed.expiry) {
      localStorage.removeItem(getCacheKey(key));
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}

export function setOfflineViewCache<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS) {
  try {
    localStorage.setItem(
      getCacheKey(key),
      JSON.stringify({ data, expiry: Date.now() + ttlMs } satisfies CacheEnvelope<T>),
    );
  } catch {
    // Ignore quota/storage issues and keep the app usable.
  }
}

export function isNetworkFailure(error: unknown) {
  /*
   * O erro do Supabase não é um Error: é um objeto { message, details }.
   * String(objeto) dava "[object Object]", e "sem internet" virava "Erro ao
   * carregar estoque" na tela. Lê a mensagem de qualquer formato.
   */
  const bruto = error as { message?: unknown; details?: unknown } | null;
  const message = error instanceof Error
    ? error.message
    : typeof bruto?.message === "string"
      ? `${bruto.message} ${typeof bruto.details === "string" ? bruto.details : ""}`
      : String(error ?? "");
  const normalized = message.toLowerCase();

  return (
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("network error") ||
    normalized.includes("load failed") ||
    normalized.includes("timeout") ||
    normalized.includes("aborterror")
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("timeout")), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function fetchWithOfflineFallback<T>({
  cacheKey,
  queryFn,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  ttlMs = DEFAULT_TTL_MS,
  onFreshData,
  preferCache = true,
}: {
  cacheKey: string;
  queryFn: () => Promise<T>;
  timeoutMs?: number;
  ttlMs?: number;
  onFreshData?: (data: T) => void;
  preferCache?: boolean;
}): Promise<{ data: T; fromCache: boolean; offline: boolean }> {
  const cached = getOfflineViewCache<T>(cacheKey);
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  if (preferCache && cached !== null) {
    if (!isOffline) {
      void withTimeout(queryFn(), timeoutMs)
        .then((freshData) => {
          setOfflineViewCache(cacheKey, freshData, ttlMs);
          onFreshData?.(freshData);
        })
        .catch(() => {
          // Silently keep cached data on background refresh failures.
        });
    }

    return { data: cached, fromCache: true, offline: isOffline };
  }

  if (isOffline && cached !== null) {
    return { data: cached, fromCache: true, offline: true };
  }

  try {
    const data = await withTimeout(queryFn(), timeoutMs);
    setOfflineViewCache(cacheKey, data, ttlMs);
    onFreshData?.(data);
    return { data, fromCache: false, offline: false };
  } catch (error) {
    if (cached !== null && isNetworkFailure(error)) {
      return { data: cached, fromCache: true, offline: true };
    }

    throw error;
  }
}
