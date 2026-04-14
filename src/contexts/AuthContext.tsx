import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// ⚠️ TEMPORÁRIO: bypass de auth para preview sem Supabase
const DEV_BYPASS = import.meta.env.DEV;

const MOCK_USER: User = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "dev@preview.local",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: { full_name: "Dev User" },
  created_at: new Date().toISOString(),
} as User;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!DEV_BYPASS);

  useEffect(() => {
    if (DEV_BYPASS) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (DEV_BYPASS) return;
    await supabase.auth.signOut();
  };

  const user = DEV_BYPASS ? MOCK_USER : (session?.user ?? null);

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
