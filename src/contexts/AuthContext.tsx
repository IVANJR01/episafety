import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { preCacheAllData } from "@/lib/offlineStorage";
import { clearCachedSession, loadCachedSession, saveCachedSession } from "@/lib/authSessionCache";
import { resolveOfflineSession } from "@/lib/authState";
import { prefetchDashboardOfflineData, prefetchStockOfflineData } from "@/lib/stockOfflinePrefetch";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authorized: boolean;
  modulosPermitidos: string[];
  empresaId: string | null;
  contratoId: string | null;
  isSuperAdmin: boolean;
  isPrincipal: boolean;
  signOut: () => Promise<void>;
  /** All empresa IDs this user can access (multi-empresa) */
  empresasIds: string[];
  /** Switch the active empresa context */
  setActiveEmpresaId: (id: string) => void;
  /** Effective empresa scope for client-side filtering (matriz + filiais).
   *  Used mainly for Super Admin (whose RLS policy returns everything).
   *  Empty array = sem filtro adicional. */
  empresaScopeIds: string[];
}

const AuthContext = createContext<AuthContextType>({
  user: null, session: null, loading: true, authorized: true, modulosPermitidos: [], empresaId: null, contratoId: null, isSuperAdmin: false, isPrincipal: false, signOut: async () => {},
  empresasIds: [], setActiveEmpresaId: () => {}, empresaScopeIds: [],
});

export const useAuth = () => useContext(AuthContext);

const AUTH_CACHE_KEY_PREFIX = "offline_auth_cache";
const ACTIVE_EMPRESA_KEY = "active_empresa_id";

type AuthCache = {
  authorized: boolean;
  modulos: string[];
  empresaId: string | null;
  contratoId: string | null;
  isSuperAdmin: boolean;
  isPrincipal: boolean;
  empresasIds?: string[];
};

function getAuthCacheKey(email?: string | null) {
  return `${AUTH_CACHE_KEY_PREFIX}:${email?.toLowerCase().trim() || "anonymous"}`;
}

function saveAuthCache(email: string | undefined, data: AuthCache) {
  if (!email) return;
  try { localStorage.setItem(getAuthCacheKey(email), JSON.stringify(data)); } catch {}
}

function loadAuthCache(email: string | undefined): AuthCache | null {
  if (!email) return null;
  try {
    const raw = localStorage.getItem(getAuthCacheKey(email));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearLegacyAuthCache() {
  try { localStorage.removeItem(AUTH_CACHE_KEY_PREFIX); } catch {}
}

function loadActiveEmpresaId(): string | null {
  try { return localStorage.getItem(ACTIVE_EMPRESA_KEY); } catch { return null; }
}

function saveActiveEmpresaId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_EMPRESA_KEY, id);
    else localStorage.removeItem(ACTIVE_EMPRESA_KEY);
  } catch {}
}

async function checkAuthorized(email: string | undefined): Promise<{ authorized: boolean; modulos: string[]; isPrincipal: boolean; contratoId: string | null }> {
  if (!email) return { authorized: false, modulos: [], isPrincipal: false, contratoId: null };
  try {
    const { data, error } = await (supabase.from as any)("usuarios_liberados")
      .select("id, modulos_permitidos, is_principal, contrato_id, ativo")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (error) throw error;

    if (data) {
      if (data.ativo === false) {
        return { authorized: false, modulos: [], isPrincipal: false, contratoId: null };
      }
      return {
        authorized: true,
        modulos: data.modulos_permitidos || [],
        isPrincipal: !!data.is_principal,
        contratoId: data.contrato_id || null,
      };
    }

    return { authorized: false, modulos: [], isPrincipal: false, contratoId: null };
  } catch {
    const cached = loadAuthCache(email);
    if (cached) return { authorized: cached.authorized, modulos: cached.modulos, isPrincipal: cached.isPrincipal || false, contratoId: cached.contratoId || null };
    return { authorized: false, modulos: [], isPrincipal: false, contratoId: null };
  }
}

async function loadProfile(userId: string, email?: string): Promise<{ empresaId: string | null }> {
  try {
    const { data } = await (supabase.from as any)("profiles")
      .select("empresa_id")
      .eq("user_id", userId)
      .limit(1);
    if (data && data.length > 0 && data[0].empresa_id) {
      return { empresaId: data[0].empresa_id };
    }
    if (email) {
      const { data: ulData } = await (supabase.from as any)("usuarios_liberados")
        .select("empresa_id")
        .eq("email", email.toLowerCase())
        .limit(1);
      if (ulData && ulData.length > 0 && ulData[0].empresa_id) {
        await (supabase.from as any)("profiles")
          .update({ empresa_id: ulData[0].empresa_id })
          .eq("user_id", userId);
        return { empresaId: ulData[0].empresa_id };
      }
    }
  } catch {}
  return { empresaId: null };
}

async function loadUserEmpresas(email: string | undefined): Promise<string[]> {
  if (!email) return [];
  try {
    const { data } = await (supabase.from as any)("usuario_empresas")
      .select("empresa_id")
      .eq("email", email.toLowerCase());
    if (data && data.length > 0) {
      return data.map((d: any) => d.empresa_id).filter(Boolean);
    }
  } catch {}
  return [];
}

async function checkSuperAdmin(userId: string): Promise<boolean> {
  try {
    const { data } = await (supabase.from as any)("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .limit(1);
    return data && data.length > 0;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(true);
  const [modulosPermitidos, setModulosPermitidos] = useState<string[]>([]);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [contratoId, setContratoId] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isPrincipal, setIsPrincipal] = useState(false);
  const [empresasIds, setEmpresasIds] = useState<string[]>([]);

  const setActiveEmpresaId = useCallback((id: string) => {
    if (empresasIds.includes(id) || isSuperAdmin) {
      setEmpresaId(id);
      saveActiveEmpresaId(id);
    }
  }, [empresasIds, isSuperAdmin]);

  const applySignedOutState = useCallback(() => {
    setUser(null);
    setSession(null);
    setAuthorized(true);
    setModulosPermitidos([]);
    setEmpresaId(null);
    setContratoId(null);
    setIsSuperAdmin(false);
    setIsPrincipal(false);
    setEmpresasIds([]);
  }, []);

  const handleAuthCheck = useCallback(async (currentUser: User | null) => {
    const applyCachedState = (cached: AuthCache | null) => {
      if (!cached) {
        setAuthorized(false);
        setModulosPermitidos([]);
        setEmpresaId(null);
        setContratoId(null);
        setIsSuperAdmin(false);
        setIsPrincipal(false);
        setEmpresasIds([]);
        return;
      }

      const cachedEmpresas = cached.empresasIds || (cached.empresaId ? [cached.empresaId] : []);
      setAuthorized(cached.authorized);
      setModulosPermitidos(cached.modulos);
      setContratoId(cached.contratoId || null);
      setIsSuperAdmin(cached.isSuperAdmin);
      setIsPrincipal(cached.isPrincipal || false);
      setEmpresasIds(cachedEmpresas);

      // Resolve active empresa
      const saved = loadActiveEmpresaId();
      if (saved && cachedEmpresas.includes(saved)) {
        setEmpresaId(saved);
      } else {
        setEmpresaId(cached.empresaId);
      }
    };

    clearLegacyAuthCache();

    if (currentUser) {
      try {
        if (!navigator.onLine) {
          applyCachedState(loadAuthCache(currentUser.email));
        } else {
          const authCheckTimeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("auth check timeout")), 5000)
          );
          const [authResult, profileResult, superAdmin, userEmpresas] = await Promise.race([
            Promise.all([
              checkAuthorized(currentUser.email),
              loadProfile(currentUser.id, currentUser.email),
              checkSuperAdmin(currentUser.id),
              loadUserEmpresas(currentUser.email),
            ]),
            authCheckTimeout.then(() => { throw new Error("timeout"); }),
          ]) as [Awaited<ReturnType<typeof checkAuthorized>>, Awaited<ReturnType<typeof loadProfile>>, boolean, string[]];

          // Build empresas list: merge profile empresa + usuario_empresas
          const allEmpresas = Array.from(new Set([
            ...(profileResult.empresaId ? [profileResult.empresaId] : []),
            ...userEmpresas,
          ]));

          // Resolve active empresa
          const saved = loadActiveEmpresaId();
          const activeEmpresa = (saved && allEmpresas.includes(saved))
            ? saved
            : profileResult.empresaId;

          const nextState: AuthCache = {
            authorized: superAdmin || authResult.authorized,
            modulos: superAdmin ? [] : authResult.modulos,
            empresaId: activeEmpresa,
            contratoId: authResult.contratoId,
            isSuperAdmin: superAdmin,
            isPrincipal: authResult.isPrincipal,
            empresasIds: allEmpresas,
          };

          setAuthorized(nextState.authorized);
          setModulosPermitidos(nextState.modulos);
          setEmpresaId(nextState.empresaId);
          setContratoId(nextState.contratoId);
          setIsSuperAdmin(nextState.isSuperAdmin);
          setIsPrincipal(nextState.isPrincipal);
          setEmpresasIds(allEmpresas);
          saveAuthCache(currentUser.email, nextState);

          // Pre-cache — same logic as before
          const isVideoOnly = !nextState.isSuperAdmin && !nextState.isPrincipal &&
            nextState.modulos.length > 0 && nextState.modulos.every(p => p.startsWith("video_treinamentos"));
          if (!isVideoOnly) {
            const deferPrefetch = () => {
              preCacheAllData().catch(() => {});
              setTimeout(() => prefetchDashboardOfflineData().catch(() => {}), 3000);

              const hasGestaoEstoque = nextState.isSuperAdmin || nextState.isPrincipal ||
                nextState.modulos.includes("epis:gestao_estoque") || nextState.modulos.includes("epis");
              const hasEstoqueContrato = nextState.modulos.includes("estoque_contrato") ||
                nextState.modulos.some((modulo) => modulo.startsWith("estoque_contrato:"));
              const canAccessStock = hasGestaoEstoque || hasEstoqueContrato || !!nextState.contratoId;

              if (canAccessStock) {
                setTimeout(() => prefetchStockOfflineData({
                  empresaId: nextState.empresaId,
                  contratoId: nextState.contratoId,
                  restricted: !hasGestaoEstoque && (hasEstoqueContrato || !!nextState.contratoId),
                }).catch(() => {}), 6000);
              }
            };

            if (typeof requestIdleCallback === "function") {
              requestIdleCallback(() => deferPrefetch(), { timeout: 8000 });
            } else {
              setTimeout(deferPrefetch, 2000);
            }
          }
        }
      } catch {
        applyCachedState(loadAuthCache(currentUser.email));
      }
    } else {
      applySignedOutState();
    }
    setLoading(false);
  }, [applySignedOutState]);

  useEffect(() => {
    const cached = loadCachedSession();

    if (cached.user) {
      setSession(cached.session);
      setUser(cached.user);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const next = resolveOfflineSession(session, session?.user ?? null);

      if (event === "SIGNED_OUT") {
        clearCachedSession();
        saveActiveEmpresaId(null);
        setLoading(false);
        applySignedOutState();
        return;
      }

      if (next.session) {
        saveCachedSession(next.session);
      }

      setSession(next.session);
      setUser(next.user);

      if (event === "TOKEN_REFRESHED") {
        return;
      }

      setLoading(true);
      setTimeout(() => {
        handleAuthCheck(next.user ?? null);
      }, 0);
    });

    Promise.race([
      supabase.auth.getSession(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000)),
    ])
      .then(({ data: { session } }: any) => {
        const next = resolveOfflineSession(session, session?.user ?? null);

        if (next.session) {
          saveCachedSession(next.session);
        }

        setSession(next.session);
        setUser(next.user);
        handleAuthCheck(next.user ?? null);
      })
      .catch(() => {
        const fallback = loadCachedSession();
        setSession(fallback.session);
        setUser(fallback.user);
        handleAuthCheck(fallback.user ?? null);
      });

    const handleOnline = () => {
      supabase.auth.refreshSession().then(({ data: { session } }) => {
        if (session) {
          saveCachedSession(session);
          setSession(session);
          setUser(session.user);
          handleAuthCheck(session.user);
        }
      }).catch(() => {});
    };

    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
      subscription.unsubscribe();
    };
  }, [applySignedOutState, handleAuthCheck]);

  const signOut = async () => {
    clearCachedSession();
    saveActiveEmpresaId(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, authorized, modulosPermitidos, empresaId, contratoId, isSuperAdmin, isPrincipal, signOut, empresasIds, setActiveEmpresaId }}>
      {children}
    </AuthContext.Provider>
  );
}
