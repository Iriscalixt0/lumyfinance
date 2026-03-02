"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { User, Mail, Loader2, Lock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { updateProfile } from "@/actions/profiles";

export function ProfileTab({
  userEmail,
  userFullName,
}: {
  userEmail: string;
  userFullName: string;
}) {
  const router = useRouter();
  const t = useTranslations("profile");
  const [fullName, setFullName] = useState(userFullName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await updateProfile(fullName);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <section className="bg-card rounded-2xl shadow-card border border-border p-6 sm:p-8 transition-colors">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <User size={18} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl border border-border bg-secondary/20 p-4">
          <label className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-2">
            <Mail size={14} />
            {t("emailLabel")}
          </label>
          <p className="text-sm font-semibold text-foreground">{userEmail}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("emailCannotChange")}
          </p>
        </div>

        <div>
          <label
            htmlFor="full_name"
            className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-2"
          >
            <User size={14} />
            {t("fullNameLabel")}
          </label>
          <input
            id="full_name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t("fullNamePlaceholder")}
            maxLength={100}
            className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          />
        </div>

        {error && (
          <p className="text-sm text-rose-600" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || fullName === userFullName}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-70 transition-opacity"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {t("saving")}
            </>
          ) : (
            t("saveName")
          )}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-border">
        <div className="flex items-center gap-2 text-sm">
          <Lock size={16} className="text-muted-foreground" />
          <span className="text-muted-foreground">{t("forgotPassword")}</span>
          <Link
            href="/forgot-password"
            className="font-semibold text-primary hover:underline"
          >
            {t("resetPassword")}
          </Link>
        </div>
      </div>
    </section>
  );
}
