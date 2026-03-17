import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

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
}

const AuthContext = createContext<AuthContextType>({
  user: null, session: null, loading: true, authorized: true, modulosPermitidos: [], empresaId: null, contratoId: null, isSuperAdmin: false, isPrincipal: false, signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const AUTH_CACHE_KEY_PREFIX = "offline_auth_cache";

type AuthCache = {
  authorized: boolean;
  modulos: string[];
  empresaId: string | null;
  contratoId: string | null;
  isSuperAdmin: boolean;
  isPrincipal: boolean;
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

async function checkAuthorized(email: string | undefined): Promise<{ authorized: boolean; modulos: string[]; isPrincipal: boolean; contratoId: string | null }> {
  if (!email) return { authorized: false, modulos: [], isPrincipal: false, contratoId: null };
  try {
    const { data, error } = await (supabase.from as any)("usuarios_liberados")
      .select("id, modulos_permitidos, is_principal, contrato_id")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (error) throw error;

    if (data) {
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
    // Fallback: try to get empresa_id from usuarios_liberados
    if (email) {
      const { data: ulData } = await (supabase.from as any)("usuarios_liberados")
        .select("empresa_id")
        .eq("email", email.toLowerCase())
        .limit(1);
      if (ulData && ulData.length > 0 && ulData[0].empresa_id) {
        // Also update profile so it's correct next time
        await (supabase.from as any)("profiles")
          .update({ empresa_id: ulData[0].empresa_id })
          .eq("user_id", userId);
        return { empresaId: ulData[0].empresa_id };
      }
    }
  } catch {}
  return { empresaId: null };
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
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isPrincipal, setIsPrincipal] = useState(false);

  const handleAuthCheck = useCallback(async (currentUser: User | null) => {
    const applyCachedState = (cached: AuthCache | null) => {
      if (!cached) {
        setAuthorized(false);
        setModulosPermitidos([]);
        setEmpresaId(null);
        setIsSuperAdmin(false);
        setIsPrincipal(false);
        return;
      }

      setAuthorized(cached.authorized);
      setModulosPermitidos(cached.modulos);
      setEmpresaId(cached.empresaId);
      setIsSuperAdmin(cached.isSuperAdmin);
      setIsPrincipal(cached.isPrincipal || false);
    };

    clearLegacyAuthCache();

    if (currentUser) {
      try {
        if (!navigator.onLine) {
          applyCachedState(loadAuthCache(currentUser.email));
        } else {
          const [authResult, profileResult, superAdmin] = await Promise.all([
            checkAuthorized(currentUser.email),
            loadProfile(currentUser.id, currentUser.email),
            checkSuperAdmin(currentUser.id),
          ]);

          const nextState: AuthCache = {
            authorized: superAdmin || authResult.authorized,
            modulos: (superAdmin || authResult.isPrincipal) ? [] : authResult.modulos,
            empresaId: profileResult.empresaId,
            isSuperAdmin: superAdmin,
            isPrincipal: authResult.isPrincipal,
          };

          setAuthorized(nextState.authorized);
          setModulosPermitidos(nextState.modulos);
          setEmpresaId(nextState.empresaId);
          setIsSuperAdmin(nextState.isSuperAdmin);
          setIsPrincipal(nextState.isPrincipal);
          saveAuthCache(currentUser.email, nextState);
        }
      } catch {
        applyCachedState(loadAuthCache(currentUser.email));
      }
    } else {
      setAuthorized(true);
      setModulosPermitidos([]);
      setEmpresaId(null);
      setIsSuperAdmin(false);
      setIsPrincipal(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(true);
      setTimeout(() => {
        handleAuthCheck(session?.user ?? null);
      }, 0);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      handleAuthCheck(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [handleAuthCheck]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, authorized, modulosPermitidos, empresaId, isSuperAdmin, isPrincipal, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}