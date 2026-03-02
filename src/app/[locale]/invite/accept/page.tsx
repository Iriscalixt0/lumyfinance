"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/logo";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { acceptWorkspaceInvite } from "@/actions/invites";

const WORKSPACE_COOKIE = "workspace_id";

function setWorkspaceCookie(workspaceId: string) {
  document.cookie = `${WORKSPACE_COOKIE}=${workspaceId}; path=/; max-age=31536000; SameSite=Lax`;
}

export default function InviteAcceptPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("invite");
  const tCommon = useTranslations("common");
  const rawToken = searchParams.get("token");
  const token = rawToken ? rawToken.trim() : null;
  const [status, setStatus] = useState<"loading" | "success" | "error" | "redirect">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const processedTokenRef = useRef<string | null>(null);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const invalidTokenText = t("invalidToken");
  const acceptErrorText = t("acceptError");

  function resolveLocalePrefix() {
    if (typeof window === "undefined") return "/pt-BR";
    const first = window.location.pathname.split("/").filter(Boolean)[0];
    const locales = new Set(["pt-BR", "pt-PT", "en", "es"]);
    return locales.has(first) ? `/${first}` : "/pt-BR";
  }

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage(invalidTokenText);
      return;
    }

    if (processedTokenRef.current === token) return;
    processedTokenRef.current = token;
    
    // Debug em desenvolvimento
    if (process.env.NODE_ENV !== "production") {
      console.log("Token recebido na página:", token.substring(0, 20) + "...");
    }

    let cancelled = false;

    async function run() {
      const tok = token;
      if (!tok) return;
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (cancelled) return;
        const currentPath = typeof window !== "undefined" ? window.location.pathname + window.location.search : "";
        const prefix = resolveLocalePrefix();
        const redirectTo = `${prefix}/login?redirect=${encodeURIComponent(currentPath)}`;
        window.location.replace(redirectTo);
        return;
      }

      const result = await acceptWorkspaceInvite(tok);
      if (cancelled) return;

      if (result.ok) {
        setWorkspaceCookie(result.workspaceId);
        setStatus("success");
        redirectTimerRef.current = setTimeout(() => {
          if (!cancelled) {
            setStatus("redirect");
            const prefix = resolveLocalePrefix();
            const destination = `${prefix}${result.onboardingRequired ? "/onboarding" : "/dashboard"}`;
            router.replace(destination);
            window.location.replace(destination);
          }
        }, 900);
      } else {
        setStatus("error");
        setErrorMessage(result.error ?? acceptErrorText);
      }
    }

    run();
    return () => {
      cancelled = true;
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, [acceptErrorText, invalidTokenText, router, token]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5 bg-background">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-card text-center">
          <Link
            href="/"
            className="flex justify-center items-center gap-2 text-foreground font-bold tracking-tight mb-8 w-full"
          >
            <Logo size="sm" />
            <span className="text-gradient-hero">Lumyf</span>
          </Link>

          {status === "loading" && (
            <>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground mb-2 font-sans">
                {t("accepting")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t("acceptingDesc")}
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                <CheckCircle className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground mb-2 font-sans">
                {t("success")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t("successDesc")}
              </p>
            </>
          )}

          {status === "redirect" && (
            <>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground mb-2 font-sans">
                {t("redirecting")}
              </h1>
            </>
          )}

          {status === "error" && (
            <>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 mb-4">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground mb-2 font-sans">
                {t("invalidTitle")}
              </h1>
              <p className="text-sm text-muted-foreground mb-6">
                {errorMessage}
              </p>
              <Link
                href="/dashboard"
                className="inline-flex justify-center w-full bg-hero-gradient text-primary-foreground font-semibold py-3.5 rounded-xl text-sm hover:opacity-90 transition-opacity"
              >
                {t("goToDashboard")}
              </Link>
            </>
          )}
        </div>

        <p className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {tCommon("back")}
          </Link>
        </p>
      </div>
    </div>
  );
}
