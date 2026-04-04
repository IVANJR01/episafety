import type { Session, User } from "@supabase/supabase-js";
import { loadCachedSession } from "@/lib/authSessionCache";

export function resolveOfflineSession(session: Session | null, user: User | null) {
  if (session?.user || user) {
    return {
      session,
      user: session?.user ?? user,
    };
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return loadCachedSession();
  }

  return { session: null, user: null };
}