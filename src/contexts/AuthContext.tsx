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
  isPrincipal: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, session: null, loading: true, authorized: true, modulosPermitidos: [], empresaId: null, isSuperAdmin: false, isPrincipal: false, signOut: async () => {},
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
    const { data, error } = await (supabase.from as any)("usuarios_liberados")
      .select("id, modulos_permitidos, is_principal")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (error) throw error;

    if (data) {
      return {
        authorized: true,
        modulos: data.modulos_permitidos || [],
        isPrincipal: !!data.is_principal,
      };
    }

    return { authorized: false, modulos: [], isPrincipal: false };
  } catch {
    const cached = loadAuthCache();
    if (cached) return { authorized: cached.authorized, modulos: cached.modulos, isPrincipal: cached.isPrincipal || false };
    return { authorized: false, modulos: [], isPrincipal: false };
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
    if (currentUser) {
      try {
        if (!navigator.onLine) {
          const cached = loadAuthCache();
          if (cached) {
            setAuthorized(cached.authorized);
            setModulosPermitidos(cached.modulos);
            setEmpresaId(cached.empresaId);
            setIsSuperAdmin(cached.isSuperAdmin);
            setIsPrincipal(cached.isPrincipal || false);
          } else {
            setAuthorized(true);
            setModulosPermitidos([]);
            setEmpresaId(null);
            setIsSuperAdmin(false);
            setIsPrincipal(false);
          }
        } else {
          const [authResult, profileResult, superAdmin] = await Promise.all([
            checkAuthorized(currentUser.email),
            loadProfile(currentUser.id, currentUser.email),
            checkSuperAdmin(currentUser.id),
          ]);
          setAuthorized(authResult.authorized);
          setModulosPermitidos(authResult.isPrincipal ? [] : authResult.modulos);
          setEmpresaId(profileResult.empresaId);
          setIsSuperAdmin(superAdmin);
          setIsPrincipal(authResult.isPrincipal);
          saveAuthCache({
            authorized: authResult.authorized,
            modulos: authResult.isPrincipal ? [] : authResult.modulos,
            empresaId: profileResult.empresaId,
            isSuperAdmin: superAdmin,
            isPrincipal: authResult.isPrincipal,
          });
        }
      } catch {
        const cached = loadAuthCache();
        if (cached) {
          setAuthorized(cached.authorized);
          setModulosPermitidos(cached.modulos);
          setEmpresaId(cached.empresaId);
          setIsSuperAdmin(cached.isSuperAdmin);
          setIsPrincipal(cached.isPrincipal || false);
        } else {
          setAuthorized(true);
          setModulosPermitidos([]);
          setEmpresaId(null);
          setIsSuperAdmin(false);
          setIsPrincipal(false);
        }
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