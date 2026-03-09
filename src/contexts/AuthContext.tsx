import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authorized: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, session: null, loading: true, authorized: true, signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

async function checkAuthorized(email: string | undefined): Promise<boolean> {
  if (!email) return false;
  // Check if there are any allowed users configured
  const { count } = await (supabase.from as any)("usuarios_liberados")
    .select("id", { count: "exact", head: true });
  // If no users configured, allow all authenticated users
  if (!count || count === 0) return true;
  // Check if user's email is in the allowed list
  const { data } = await (supabase.from as any)("usuarios_liberados")
    .select("id")
    .eq("email", email.toLowerCase())
    .limit(1);
  return data && data.length > 0;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const isAuth = await checkAuthorized(session.user.email);
        setAuthorized(isAuth);
      } else {
        setAuthorized(true);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const isAuth = await checkAuthorized(session.user.email);
        setAuthorized(isAuth);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, authorized, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
