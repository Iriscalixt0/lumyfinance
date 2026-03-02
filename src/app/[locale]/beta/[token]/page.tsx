"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/logo";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { acceptBetaInvite } from "@/actions/beta";
import { hasUserWorkspace } from "@/actions/workspaces";

const WORKSPACE_COOKIE = "workspace_id";
const PENDING_BETA_COOKIE = "pending_beta_token";

function setWorkspaceCookie(workspaceId: string) {
  document.cookie = `${WORKSPACE_COOKIE}=${workspaceId}; path=/; max-age=31536000; SameSite=Lax`;
}

function clearPendingBetaCookie() {
  document.cookie = `${PENDING_BETA_COOKIE}=; path=/; max-age=0`;
}

function resolveLocalePrefix(pathname: string): string {
  const first = pathname.split("/").filter(Boolean)[0];
  const locales = new Set(["pt-BR", "pt-PT", "en", "es"]);
  return locales.has(first) ? `/${first}` : "/pt-BR";
}

export default function BetaInvitePage() {
  const params = useParams();
  const token = (params?.token as string)?.trim();
  const tCommon = useTranslations("common");
  const tBeta = useTranslations("beta");
  const [status, setStatus] = useState<"loading" | "success" | "error" | "redirect">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [hasWorkspace, setHasWorkspace] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Link de teste beta invalido.");
      return;
    }

    let cancelled = false;

    async function run() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (cancelled) return;
        const pathname = typeof window !== "undefined" ? window.location.pathname : "";
        const prefix = resolveLocalePrefix(pathname);
        window.location.href = `${prefix}?beta=${encodeURIComponent(token)}`;
        return;
      }

      const result = await acceptBetaInvite(token);
      if (cancelled) return;

      if (result.ok) {
        setWorkspaceCookie(result.workspaceId);
        clearPendingBetaCookie();
        setStatus("success");
        setTimeout(() => {
          if (!cancelled) {
            setStatus("redirect");
            const pathname = typeof window !== "undefined" ? window.location.pathname : "";
            const prefix = resolveLocalePrefix(pathname);
            window.location.href = `${prefix}${result.onboardingRequired ? "/onboarding" : "/dashboard"}`;
          }
        }, 1500);
      } else {
        // Limpa o cookie para evitar loop infinito onboarding ↔ beta
        clearPendingBetaCookie();
        setStatus("error");
        setErrorMessage(result.error ?? "Erro ao entrar no teste beta.");
        const hasWs = await hasUserWorkspace();
        if (!cancelled) setHasWorkspace(hasWs);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

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
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-6">Teste Beta</p>

          {status === "loading" && (
            <>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground mb-2 font-sans">Entrando no teste beta...</h1>
              <p className="text-sm text-muted-foreground">Preparando seu workspace de teste.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                <CheckCircle className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground mb-2 font-sans">Bem-vindo ao teste beta!</h1>
              <p className="text-sm text-muted-foreground">Seu workspace foi criado. Redirecionando...</p>
            </>
          )}

          {status === "redirect" && (
            <>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground mb-2 font-sans">Redirecionando...</h1>
            </>
          )}

          {status === "error" && (
            <>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 mb-4">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground mb-2 font-sans">{tBeta("invalidInviteTitle")}</h1>
              <p className="text-sm text-muted-foreground mb-6">{errorMessage}</p>
              {hasWorkspace === false && (
                <Link
                  href="/"
                  className="inline-flex justify-center w-full bg-hero-gradient text-primary-foreground font-semibold py-3.5 rounded-xl text-sm hover:opacity-90 transition-opacity mb-3"
                >
                  {tCommon("back")}
                </Link>
              )}
              {hasWorkspace === true && (
                <Link
                  href="/dashboard"
                  className="inline-flex justify-center w-full bg-hero-gradient text-primary-foreground font-semibold py-3.5 rounded-xl text-sm hover:opacity-90 transition-opacity"
                >
                  {tBeta("continue")}
                </Link>
              )}
              {hasWorkspace === null && (
                <div className="inline-flex justify-center py-3">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
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
