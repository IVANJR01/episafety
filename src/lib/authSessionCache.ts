import type { Session, User } from "@supabase/supabase-js";

const AUTH_SESSION_CACHE_KEY = "auth_session_cache";

type CachedAuthSession = {
  session: Session | null;
  cachedAt: string;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function saveCachedSession(session: Session | null) {
  if (!canUseStorage()) return;

  try {
    if (!session) {
      window.localStorage.removeItem(AUTH_SESSION_CACHE_KEY);
      return;
    }

    const payload: CachedAuthSession = {
      session,
      cachedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(AUTH_SESSION_CACHE_KEY, JSON.stringify(payload));
  } catch {}
}

export function loadCachedSession(): { session: Session | null; user: User | null } {
  if (!canUseStorage()) {
    return { session: null, user: null };
  }

  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_CACHE_KEY);
    if (!raw) return { session: null, user: null };

    const parsed = JSON.parse(raw) as CachedAuthSession;
    const session = parsed?.session ?? null;

    return {
      session,
      user: session?.user ?? null,
    };
  } catch {
    return { session: null, user: null };
  }
}

export function clearCachedSession() {
  if (!canUseStorage()) return;

  try {
    window.localStorage.removeItem(AUTH_SESSION_CACHE_KEY);
  } catch {}
}