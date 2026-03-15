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
  isSuperAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, session: null, loading: true, authorized: true, modulosPermitidos: [], empresaId: null, isSuperAdmin: false, signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const AUTH_CACHE_KEY = "offline_auth_cache";

function saveAuthCache(data: { authorized: boolean; modulos: string[]; empresaId: string | null; isSuperAdmin: boolean; isPrincipal: boolean }) {
  try { localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(data)); } catch {}
}

function loadAuthCache(): { authorized: boolean; modulos: string[]; empresaId: string | null; isSuperAdmin: boolean; isPrincipal: boolean } | null {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function checkAuthorized(email: string | undefined): Promise<{ authorized: boolean; modulos: string[]; isPrincipal: boolean }> {
  if (!email) return { authorized: false, modulos: [], isPrincipal: false };
  try {
    const { count } = await supabase
      .from("usuarios_liberados")
      .select("id", { count: "exact", head: true });
    if (!count || count === 0) return { authorized: true, modulos: [], isPrincipal: false };
    const { data } = await (supabase.from as any)("usuarios_liberados")
      .select("id, modulos_permitidos, is_principal")
      .eq("email", email.toLowerCase())
      .limit(1);
    if (data && data.length > 0) {
      return { authorized: true, modulos: data[0].modulos_permitidos || [], isPrincipal: !!data[0].is_principal };
    }
    return { authorized: false, modulos: [], isPrincipal: false };
  } catch {
    const cached = loadAuthCache();
    if (cached) return { authorized: cached.authorized, modulos: cached.modulos, isPrincipal: cached.isPrincipal || false };
    return { authorized: true, modulos: [], isPrincipal: false };
  }
}

async function loadProfile(userId: string): Promise<{ empresaId: string | null }> {
  try {
    const { data } = await (supabase.from as any)("profiles")
      .select("empresa_id")
      .eq("user_id", userId)
      .limit(1);
    if (data && data.length > 0) {
      return { empresaId: data[0].empresa_id };
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

  const handleAuthCheck = useCallback(async (currentUser: User | null) => {
    if (currentUser) {
      try {
        if (!navigator.onLine) {
          // Offline: use cached auth data
          const cached = loadAuthCache();
          if (cached) {
            setAuthorized(cached.authorized);
            setModulosPermitidos(cached.modulos);
            setEmpresaId(cached.empresaId);
            setIsSuperAdmin(cached.isSuperAdmin);
          } else {
            // No cache, assume authorized to not block user
            setAuthorized(true);
            setModulosPermitidos([]);
            setEmpresaId(null);
            setIsSuperAdmin(false);
          }
        } else {
          const [authResult, profileResult, superAdmin] = await Promise.all([
            checkAuthorized(currentUser.email),
            loadProfile(currentUser.id),
            checkSuperAdmin(currentUser.id),
          ]);
          setAuthorized(authResult.authorized);
          setModulosPermitidos(authResult.modulos);
          setEmpresaId(profileResult.empresaId);
          setIsSuperAdmin(superAdmin);
          // Save to cache for offline use
          saveAuthCache({
            authorized: authResult.authorized,
            modulos: authResult.modulos,
            empresaId: profileResult.empresaId,
            isSuperAdmin: superAdmin,
          });
        }
      } catch {
        // Network error - try cache
        const cached = loadAuthCache();
        if (cached) {
          setAuthorized(cached.authorized);
          setModulosPermitidos(cached.modulos);
          setEmpresaId(cached.empresaId);
          setIsSuperAdmin(cached.isSuperAdmin);
        } else {
          setAuthorized(true);
          setModulosPermitidos([]);
          setEmpresaId(null);
          setIsSuperAdmin(false);
        }
      }
    } else {
      setAuthorized(true);
      setModulosPermitidos([]);
      setEmpresaId(null);
      setIsSuperAdmin(false);
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
    <AuthContext.Provider value={{ user, session, loading, authorized, modulosPermitidos, empresaId, isSuperAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}