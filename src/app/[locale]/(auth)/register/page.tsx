"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/logo";
import { Loader2, CheckCircle, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const PENDING_BETA_COOKIE = "pending_beta_token";
const PENDING_BETA_MAX_AGE = 60 * 60 * 24; // 24h

function isBetaRedirect(path: string | null): boolean {
  return !!path && /\/beta\/[^/]+$/.test(path);
}

function getBetaTokenFromRedirect(redirectPath: string | null): string | null {
  if (!redirectPath) return null;
  const match = redirectPath.match(/\/beta\/([^/]+)$/);
  return match?.[1] ?? null;
}

const ALREADY_REGISTERED_HINTS = ["user already registered", "already registered", "already exists"];
const EXISTING_ACCOUNT_MESSAGE =
  "Este e-mail ja possui cadastro. Faca login ou use 'Esqueci minha senha' para recuperar o acesso.";
const EMAIL_RESENT_MESSAGE =
  "Se o e-mail estiver pendente de confirmacao, reenviamos um novo link. Confira sua caixa de entrada e spam.";

export default function RegisterPage() {
  const t = useTranslations("auth.register");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const redirectTo = searchParams.get("redirect");

  useEffect(() => {
    const emailFromUrl = searchParams.get("email");
    if (emailFromUrl) setEmail(decodeURIComponent(emailFromUrl));
  }, [searchParams]);

  useEffect(() => {
    const redirectPath = searchParams.get("redirect");
    const token = getBetaTokenFromRedirect(redirectPath);
    if (token && isBetaRedirect(redirectPath)) {
      document.cookie = `${PENDING_BETA_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${PENDING_BETA_MAX_AGE}; SameSite=Lax`;
    }
  }, [searchParams]);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showExistingAccountHelp, setShowExistingAccountHelp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    setError(null);
    setInfo(null);
    setShowExistingAccountHelp(false);
    setLoading(true);

    try {
      const supabase = createClient();
      const baseUrl = window.location.origin;
      const nextPath = isBetaRedirect(redirectTo) ? redirectTo! : `/${locale}/onboarding`;
      const emailRedirectUrl = `${baseUrl}/api/auth/callback?next=${encodeURIComponent(nextPath)}`;
      const { data, error: err } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: emailRedirectUrl,
        },
      });

      if (err) {
        const msg = err.message.toLowerCase();
        const alreadyRegistered = ALREADY_REGISTERED_HINTS.some((hint) => msg.includes(hint));
        if (alreadyRegistered) {
          setInfo(EXISTING_ACCOUNT_MESSAGE);
          setShowExistingAccountHelp(true);
          return;
        }
        setError(err.message);
        return;
      }

      const identities = data.user?.identities ?? [];
      const likelyExistingObfuscatedUser = !data.session && identities.length === 0;
      if (likelyExistingObfuscatedUser) {
        setInfo(EXISTING_ACCOUNT_MESSAGE);
        setShowExistingAccountHelp(true);
        return;
      }

      if (data.session) {
        // Nunca manter sessao ativa apos cadastro: exige validacao de e-mail antes de usar o app.
        await supabase.auth.signOut();
      }

      setEmail(normalizedEmail);
      setSuccess(true);
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

    try {
      const supabase = createClient();
      const baseUrl = window.location.origin;
      const nextPath = isBetaRedirect(redirectTo) ? redirectTo! : `/${locale}/onboarding`;
      const emailRedirectUrl = `${baseUrl}/api/auth/callback?next=${encodeURIComponent(nextPath)}`;
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
        options: {
          emailRedirectTo: emailRedirectUrl,
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

  if (success) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-card text-center">
          <Link
            href="/"
            className="flex justify-center items-center gap-2 text-foreground font-bold tracking-tight mb-8 w-full"
          >
            <Logo size="sm" />
            <span className="text-gradient-hero">{tCommon("brand")}</span>
          </Link>
          <div className="flex justify-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
              <CheckCircle className="h-6 w-6" />
            </div>
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground mb-2 font-sans">
            {t("verifyEmail")}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {t("emailSent", { email })}
          </p>
          <Link
            href={redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : "/login"}
            className="inline-flex items-center justify-center w-full bg-hero-gradient text-primary-foreground font-semibold py-3.5 rounded-xl text-sm hover:opacity-90 transition-opacity"
          >
            {t("goToLogin")}
          </Link>
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
            <label htmlFor="fullName" className="sr-only">
              {t("fullName")}
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              placeholder={t("fullName")}
            />
          </div>
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
              className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
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
              minLength={6}
              className="w-full px-4 py-3 pr-11 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
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
              {showExistingAccountHelp && (
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
            className="w-full bg-hero-gradient text-primary-foreground font-semibold py-3.5 rounded-xl text-sm hover:opacity-90 transition-opacity disabled:opacity-70 flex items-center justify-center gap-2"
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
          {t("hasAccount")} {" "}
          <Link
            href={redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : "/login"}
            className="font-semibold text-primary hover:underline"
          >
            {t("login")}
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
