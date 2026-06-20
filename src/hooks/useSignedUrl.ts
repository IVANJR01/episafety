import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SensitiveBucket =
  | "inspecoes"
  | "conformidades"
  | "videos-treinamento"
  | "fotos-reconhecimento";

interface Options {
  /** Time-to-live em segundos (10–300). Default 60. */
  ttl?: number;
  /** Força download em vez de inline view. */
  download?: boolean;
  /** Renova a URL automaticamente alguns segundos antes de expirar. */
  autoRefresh?: boolean;
  /** Se false, pula a chamada (útil quando o path ainda não está pronto). */
  enabled?: boolean;
}

interface State {
  url: string | null;
  loading: boolean;
  error: string | null;
  expiresAt: string | null;
}

/**
 * Gera Signed URLs curtas para buckets privados sensíveis via Edge Function `signed-url`.
 * Usa o token do usuário logado — a edge valida tenant, bucket allowlist e rate limit.
 */
export function useSignedUrl(
  bucket: SensitiveBucket | null,
  path: string | null,
  options: Options = {},
): State & { refresh: () => void } {
  const { ttl = 60, download = false, autoRefresh = true, enabled = true } = options;
  const [state, setState] = useState<State>({
    url: null,
    loading: false,
    error: null,
    expiresAt: null,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled || !bucket || !path) {
      setState({ url: null, loading: false, error: null, expiresAt: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      const { data, error } = await supabase.functions.invoke("signed-url", {
        body: { bucket, path, ttl, download },
      });
      if (cancelled) return;
      if (error || !data?.url) {
        setState({
          url: null,
          loading: false,
          error: error?.message ?? data?.error ?? "Falha ao gerar URL",
          expiresAt: null,
        });
        return;
      }
      setState({ url: data.url, loading: false, error: null, expiresAt: data.expires_at ?? null });
    })();

    return () => {
      cancelled = true;
    };
  }, [bucket, path, ttl, download, enabled, tick]);

  // Auto-refresh ~5s antes do TTL expirar
  useEffect(() => {
    if (!autoRefresh || !state.url) return;
    const ms = Math.max((ttl - 5) * 1000, 5000);
    const t = setTimeout(() => setTick((n) => n + 1), ms);
    return () => clearTimeout(t);
  }, [state.url, ttl, autoRefresh]);

  return { ...state, refresh: () => setTick((n) => n + 1) };
}
