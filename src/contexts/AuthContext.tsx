import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { setCacheUserScope, clearAllCachedData } from "@/lib/offlineStorage";
import { clearCachedSession, loadCachedSession, saveCachedSession } from "@/lib/authSessionCache";
import { resolveOfflineSession } from "@/lib/authState";
import { purgeQueryCache } from "@/lib/queryClient";

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

async function checkSuperAdmin(userId: string, email?: string): Promise<boolean> {
  try {
    const { data } = await (supabase.from as any)("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["super_admin", "superadmin", "admin"])
      .limit(1);
    if (data && data.length > 0) return true;

    if (email) {
      const { data: ul } = await (supabase.from as any)("usuarios_liberados")
        .select("is_principal")
        .eq("email", email.toLowerCase())
        .eq("is_principal", true)
        .limit(1);
      if (ul && ul.length > 0) return true;
    }
  } catch {}
  return false;
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
  const [empresaScopeIds, setEmpresaScopeIds] = useState<string[]>([]);

  const setActiveEmpresaId = useCallback((id: string) => {
    if (!id) return;
    if (!(empresasIds.includes(id) || isSuperAdmin || isPrincipal)) return;
    if (id === empresaId) return;
    saveActiveEmpresaId(id);
    setEmpresaId(id);
    try { purgeQueryCache(); } catch {}
    try { clearAllCachedData(); } catch {}
  }, [empresasIds, isSuperAdmin, isPrincipal, empresaId]);

  // Resolve empresa scope (matriz + todas as filiais da mesma árvore) para isolamento estrito por empresa.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!empresaId) { setEmpresaScopeIds([]); return; }
      try {
        const { data: current } = await (supabase.from as any)("empresa_config")
          .select("id, empresa_pai_id")
          .eq("id", empresaId)
          .limit(1);
        if (cancelled) return;
        const rootId = current?.[0]?.empresa_pai_id || empresaId;

        const { data: tree } = await (supabase.from as any)("empresa_config")
          .select("id")
          .or(`id.eq.${rootId},empresa_pai_id.eq.${rootId}`);
        if (cancelled) return;
        const scope = (tree || []).map((f: any) => f.id as string);
        setEmpresaScopeIds(scope.length > 0 ? Array.from(new Set([empresaId, rootId, ...scope])) : [empresaId]);
      } catch {
        if (!cancelled) setEmpresaScopeIds([empresaId]);
      }
    })();
    return () => { cancelled = true; };
  }, [empresaId]);

  // Sincroniza empresa ativa no banco (tabela user_active_empresa) para que
  // a RLS "ciente da empresa ativa" (is_active_empresa) veja a mesma coisa
  // que o header. Sem isso, o banco não sabe qual empresa está selecionada
  // e módulos migrados (Exames) ficariam vazios ou com fallback.
  useEffect(() => {
    if (!user?.id || !empresaId) return;
    let cancelled = false;
    (async () => {
      try {
        await (supabase.from as any)("user_active_empresa").upsert(
          { user_id: user.id, empresa_id: empresaId },
          { onConflict: "user_id" }
        );
      } catch { /* best effort — fallback do banco cuida do resto */ }
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [user?.id, empresaId]);

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
        setEmpresaId(cached.empresaId || cachedEmpresas[0] || null);
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
              checkSuperAdmin(currentUser.id, currentUser.email),
              loadUserEmpresas(currentUser.email),
            ]),
            authCheckTimeout.then(() => { throw new Error("timeout"); }),
          ]) as [Awaited<ReturnType<typeof checkAuthorized>>, Awaited<ReturnType<typeof loadProfile>>, boolean, string[]];

          // Build empresas list: merge profile empresa + usuario_empresas
          let allEmpresas = Array.from(new Set([
            ...(profileResult.empresaId ? [profileResult.empresaId] : []),
            ...userEmpresas,
          ]));

          const isSuper = superAdmin || authResult.isPrincipal;
          if (isSuper || allEmpresas.length === 0) {
            try {
              const { data: allEmp } = await (supabase.from as any)("empresa_config")
                .select("id")
                .order("nome");
              if (allEmp && allEmp.length > 0) {
                allEmpresas = Array.from(new Set([...allEmpresas, ...allEmp.map((e: any) => e.id as string)]));
              }
            } catch {}
          }

          // Resolve active empresa
          const saved = loadActiveEmpresaId();
          const activeEmpresa = (saved && allEmpresas.includes(saved))
            ? saved
            : (profileResult.empresaId || allEmpresas[0] || null);

          const nextState: AuthCache = {
            authorized: isSuper || authResult.authorized,
            modulos: isSuper ? [] : authResult.modulos,
            empresaId: activeEmpresa,
            contratoId: authResult.contratoId,
            isSuperAdmin: isSuper,
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

          // Each visited screen now warms its own scoped cache. Preloading the whole
          // application here created dozens of concurrent requests during login and
          // competed with the dashboard's critical data.
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
      setCacheUserScope(cached.user.id);
      setSession(cached.session);
      setUser(cached.user);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const next = resolveOfflineSession(session, session?.user ?? null);

      if (event === "SIGNED_OUT") {
        clearCachedSession();
        saveActiveEmpresaId(null);
        setCacheUserScope(null);
        setLoading(false);
        applySignedOutState();
        return;
      }

      if (next.session) {
        saveCachedSession(next.session);
      }

      // CRITICAL: scope offline cache to current user to prevent cross-tenant data leaks.
      const scopeChanged = setCacheUserScope(next.user?.id ?? null);
      if (scopeChanged) {
        // New user (or sign-out) — purge React Query cache too.
        purgeQueryCache();
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

        setCacheUserScope(next.user?.id ?? null);
        setSession(next.session);
        setUser(next.user);
        handleAuthCheck(next.user ?? null);
      })
      .catch(() => {
        const fallback = loadCachedSession();
        setCacheUserScope(fallback.user?.id ?? null);
        setSession(fallback.session);
        setUser(fallback.user);
        handleAuthCheck(fallback.user ?? null);
      });

    const handleOnline = () => {
      supabase.auth.refreshSession().then(({ data: { session } }) => {
        if (session) {
          saveCachedSession(session);
          setCacheUserScope(session.user?.id ?? null);
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
    // Limpa estado local PRIMEIRO para garantir que a UI reage mesmo se o
    // servidor retornar 403 (sessão já invalidada) ou estiver offline.
    clearCachedSession();
    saveActiveEmpresaId(null);
    clearAllCachedData();
    purgeQueryCache();
    setCacheUserScope(null);
    applySignedOutState();

    // scope: 'local' evita chamar /logout no servidor; remove apenas a sessão
    // local. Evita o loop de 403 "session_not_found" visto nos logs.
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // ignora qualquer erro: o estado local já foi limpo acima.
    }

    // Força navegação dura para descartar qualquer estado em memória de
    // contextos/queries de outros componentes.
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, authorized, modulosPermitidos, empresaId, contratoId, isSuperAdmin, isPrincipal, signOut, empresasIds, setActiveEmpresaId, empresaScopeIds }}>
      {children}
    </AuthContext.Provider>
  );
}
