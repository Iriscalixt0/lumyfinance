"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/logo";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function isSafeRedirect(url: string): boolean {
  try {
    const u = new URL(url, window.location.origin);
    return u.origin === window.location.origin && u.pathname.startsWith("/");
  } catch {
    return false;
  }
}

const INVALID_CREDENTIALS = "Invalid login credentials";
const EMAIL_NOT_CONFIRMED_HINTS = ["email not confirmed", "email_not_confirmed"];
const EMAIL_NOT_CONFIRMED_MESSAGE =
  "Seu e-mail ainda nao foi confirmado. Reenvie o link de verificacao e tente novamente.";
const EMAIL_RESENT_MESSAGE =
  "Enviamos um novo e-mail de verificacao. Confira sua caixa de entrada e spam.";

function isEmailConfirmed(
  user: { email_confirmed_at?: string | null; confirmed_at?: string | null } | null | undefined
): boolean {
  return !!(user?.email_confirmed_at || user?.confirmed_at);
}

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (searchParams.get("error") === "email_not_confirmed") {
      setShowResendVerification(true);
      setError(EMAIL_NOT_CONFIRMED_MESSAGE);
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    setError(null);
    setInfo(null);
    setShowResendVerification(false);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (err) {
        const msg = err.message.toLowerCase();
        const isEmailNotConfirmed = EMAIL_NOT_CONFIRMED_HINTS.some((hint) => msg.includes(hint));
        if (isEmailNotConfirmed) {
          setShowResendVerification(true);
          setError(EMAIL_NOT_CONFIRMED_MESSAGE);
          return;
        }

        const isInvalidCredentials =
          err.message === INVALID_CREDENTIALS ||
          msg.includes("invalid login") ||
          msg.includes("invalid_credentials");

        if (isInvalidCredentials) {
          setError(t("errorInvalidCredentials"));
        } else {
          setError(err.message);
        }
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!isEmailConfirmed(user)) {
        await supabase.auth.signOut();
        setShowResendVerification(true);
        setError(EMAIL_NOT_CONFIRMED_MESSAGE);
        return;
      }

      const target = redirectTo && isSafeRedirect(redirectTo) ? redirectTo : "/onboarding";
      window.location.href = target;
    } catch (err) {
      setError(err instanceof Error ? err.message : tErrors("connectError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Informe um e-mail valido para reenviar a verificacao.");
      return;
    }

    setResending(true);
    setError(null);
    setInfo(null);

    try {
      const supabase = createClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (resendError) {
        setError(resendError.message);
        return;
      }

      setInfo(EMAIL_RESENT_MESSAGE);
    } catch (err) {
      setError(err instanceof Error ? err.message : tErrors("connectError"));
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-card">
        <Link
          href="/"
          className="flex justify-center items-center gap-2 text-foreground font-bold tracking-tight mb-8 w-full"
        >
          <Logo size="sm" />
          <span className="text-gradient-hero">{tCommon("brand")}</span>
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2 font-sans">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {t("subtitle")}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="sr-only">
              {t("email")}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 text-base bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              placeholder={t("email")}
            />
          </div>
          <div className="relative">
            <label htmlFor="password" className="sr-only">
              {t("password")}
            </label>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 pr-11 text-base bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              placeholder={t("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 rounded"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {(error || info) && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 space-y-2">
              {error && (
                <p className="text-sm text-rose-600 font-medium" role="alert">
                  {error}
                </p>
              )}
              {info && (
                <p className="text-sm text-emerald-700 font-medium" role="status">
                  {info}
                </p>
              )}
              {showResendVerification && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resending}
                  className="text-sm font-semibold text-primary hover:underline disabled:opacity-60"
                >
                  {resending ? "Reenviando..." : "Reenviar e-mail de verificacao"}
                </button>
              )}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] bg-hero-gradient text-primary-foreground font-semibold py-3.5 rounded-xl text-sm hover:opacity-90 transition-opacity disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("submitting")}
              </>
            ) : (
              t("submit")
            )}
          </button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground text-center">
          {t("noAccount")}{" "}
          <Link
            href={redirectTo ? `/register?redirect=${encodeURIComponent(redirectTo)}` : "/register"}
            className="font-semibold text-primary hover:underline"
          >
            {t("createAccount")}
          </Link>
        </p>
        <p className="mt-2 text-sm text-muted-foreground text-center">
          <Link
            href="/forgot-password"
            className="text-primary hover:underline"
          >
            {t("forgotPassword")}
          </Link>
        </p>
      </div>

      <p className="mt-6 text-center">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {t("backHome")}
        </Link>
      </p>
    </div>
  );
}
