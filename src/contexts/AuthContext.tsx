import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authorized: boolean;
  modulosPermitidos: string[];
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, session: null, loading: true, authorized: true, modulosPermitidos: [], signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

async function checkAuthorized(email: string | undefined): Promise<{ authorized: boolean; modulos: string[] }> {
  if (!email) return { authorized: false, modulos: [] };
  try {
    const { count } = await supabase
      .from("usuarios_liberados")
      .select("id", { count: "exact", head: true });
    if (!count || count === 0) return { authorized: true, modulos: [] };
    const { data } = await supabase
      .from("usuarios_liberados")
      .select("id, modulos_permitidos")
      .eq("email", email.toLowerCase())
      .limit(1);
    if (data && data.length > 0) {
      return { authorized: true, modulos: data[0].modulos_permitidos || [] };
    }
    return { authorized: false, modulos: [] };
  } catch {
    return { authorized: true, modulos: [] };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(true);
  const [modulosPermitidos, setModulosPermitidos] = useState<string[]>([]);

  const handleAuthCheck = useCallback(async (currentUser: User | null) => {
    if (currentUser) {
      try {
        const result = await checkAuthorized(currentUser.email);
        setAuthorized(result.authorized);
        setModulosPermitidos(result.modulos);
      } catch {
        setAuthorized(true);
        setModulosPermitidos([]);
      }
    } else {
      setAuthorized(true);
      setModulosPermitidos([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      // Use setTimeout to avoid deadlock with async calls inside onAuthStateChange
      setTimeout(() => {
        handleAuthCheck(session?.user ?? null);
      }, 0);
    });

    // THEN get initial session
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
    <AuthContext.Provider value={{ user, session, loading, authorized, modulosPermitidos, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
