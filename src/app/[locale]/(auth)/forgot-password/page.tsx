"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/logo";
import { Loader2, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgot");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const baseUrl = window.location.origin;
      const next = `/${locale}/reset-password`;
      const redirectTo = `${baseUrl}/api/auth/callback?next=${encodeURIComponent(next)}`;
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (err) {
        setError(err.message);
        return;
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : tErrors("connectError"));
    } finally {
      setLoading(false);
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
            {t("successTitle")}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {t("successMessage", { email })}
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full bg-hero-gradient text-primary-foreground font-semibold py-3.5 rounded-xl text-sm hover:opacity-90 transition-opacity"
          >
            {t("backToLogin")}
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
          {error && (
            <p className="text-sm text-rose-600 font-medium" role="alert">
              {error}
            </p>
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
          {t("remembered")}{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            {t("backToLogin")}
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
