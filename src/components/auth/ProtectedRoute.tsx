import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

const DEV_BYPASS = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === "true";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [checkingOnboarding, setCheckingOnboarding] = useState(!DEV_BYPASS);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (DEV_BYPASS) return;

    async function check() {
      if (!user) { setCheckingOnboarding(false); return; }

      // Skip check if already on onboarding page
      if (location.pathname === "/onboarding") {
        setCheckingOnboarding(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("onboarding_completed_at")
        .eq("id", user.id)
        .single();

      if (data && !data.onboarding_completed_at) {
        setNeedsOnboarding(true);
      }
      setCheckingOnboarding(false);
    }
    if (!loading) check();
  }, [user, loading, location.pathname]);

  // Dev bypass — skip all auth checks
  if (DEV_BYPASS) {
    return <>{children}</>;
  }

  if (loading || checkingOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (needsOnboarding && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
