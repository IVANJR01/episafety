// Shared CORS resolver for all Edge Functions.
// Replaces the wildcard `Access-Control-Allow-Origin: *` with a strict allowlist.

const ALLOWED_ORIGINS: ReadonlySet<string> = new Set([
  "https://safetysolucoes.com",
  "https://www.safetysolucoes.com",
  "https://episafety.lovable.app",
  "capacitor://localhost",
  "http://localhost",
  "http://localhost:5173",
  "http://localhost:3000",
]);

// Allow any Lovable preview subdomain.
const LOVABLE_PREVIEW_RE = /^https:\/\/[a-z0-9-]+\.lovable\.app$/i;
// Allow id-preview hosts used by the in-editor preview.
const LOVABLE_ID_PREVIEW_RE = /^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.lovable\.app$/i;

const ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, range, x-requested-with";

function isAllowed(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (LOVABLE_PREVIEW_RE.test(origin)) return true;
  if (LOVABLE_ID_PREVIEW_RE.test(origin)) return true;
  return false;
}

export function resolveCors(req: Request | null): Record<string, string> {
  const origin = req?.headers.get("origin") ?? "";
  const allowed = isAllowed(origin);
  // When the origin is not allowed we echo back the first allowed origin so
  // the browser will block the request (mismatch) but the response is still well-formed.
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://safetysolucoes.com",
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
