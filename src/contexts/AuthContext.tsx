import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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
  const { count } = await (supabase.from as any)("usuarios_liberados")
    .select("id", { count: "exact", head: true });
  if (!count || count === 0) return { authorized: true, modulos: [] }; // no restriction
  const { data } = await (supabase.from as any)("usuarios_liberados")
    .select("id, modulos_permitidos")
    .eq("email", email.toLowerCase())
    .limit(1);
  if (data && data.length > 0) {
    return { authorized: true, modulos: data[0].modulos_permitidos || [] };
  }
  return { authorized: false, modulos: [] };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(true);
  const [modulosPermitidos, setModulosPermitidos] = useState<string[]>([]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        try {
          const result = await checkAuthorized(session.user.email);
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
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        try {
          const result = await checkAuthorized(session.user.email);
          setAuthorized(result.authorized);
          setModulosPermitidos(result.modulos);
        } catch {
          setAuthorized(true);
          setModulosPermitidos([]);
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, authorized, modulosPermitidos, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
