// Shared rate-limit helper for Edge Functions.
// Calls the public.check_rate_limit RPC using the service role key.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface RateLimitOptions {
  /** Unique identifier (function name + user id / ip). */
  key: string;
  /** Max calls allowed in the window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

let _admin: ReturnType<typeof createClient> | null = null;
function admin() {
  if (_admin) return _admin;
  _admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  return _admin;
}

/**
 * Returns true if the request is allowed, false if rate-limited.
 * On internal errors (DB down) returns true (fail-open) to avoid lockout.
 */
export async function checkRateLimit(opts: RateLimitOptions): Promise<boolean> {
  try {
    const { data, error } = await admin().rpc("check_rate_limit", {
      _key: opts.key,
      _limit: opts.limit,
      _window_seconds: opts.windowSeconds,
    });
    if (error) {
      console.error("[rate-limit] rpc error", error);
      return true;
    }
    return data === true;
  } catch (e) {
    console.error("[rate-limit] exception", e);
    return true;
  }
}

export function clientKey(req: Request, userId: string | null, fnName: string): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return `${fnName}:${userId ?? `ip:${ip}`}`;
}
