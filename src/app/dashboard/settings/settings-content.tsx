"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { User, LogOut, Trash2, Moon, Palette, Type, Eye, Sun, CreditCard } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Link } from "@/i18n/navigation";
import { useTheme } from "@/components/theme-provider";
import {
  useAccessibility,
  type ColorTheme,
  type FontSize,
} from "@/components/accessibility-provider";
import type { Workspace } from "@/types/database";
import { deleteAccount } from "@/actions/auth";
import { LocationConsentCard } from "@/components/settings/location-consent-card";
import { BillingCard } from "@/components/settings/billing-card";
import { BetaContactPreferencesCard } from "@/components/beta/beta-contact-preferences-card";


export function SettingsContent({
  userEmail,
  workspaces,
  currentWorkspaceId,
  currentWorkspacePlan,
  hasStripeSubscription,
  isInActiveBeta = false,
}: {
  userEmail: string | undefined;
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  currentWorkspacePlan?: "pro";
  hasStripeSubscription?: boolean;
  isInActiveBeta?: boolean;
}) {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();
  const t = useTranslations("settings");
  void workspaces;
  void currentWorkspacePlan;
  const fontSizeOptions: { value: FontSize; labelKey: string; helperKey: string }[] = [
    { value: "normal", labelKey: "normal", helperKey: "fontNormalHelper" },
    { value: "grande", labelKey: "large", helperKey: "fontLargeHelper" },
    { value: "muito-grande", labelKey: "xlarge", helperKey: "fontXLargeHelper" },
  ];
  const colorThemeOptions: { value: ColorTheme; labelKey: string; swatch: string }[] = [
    { value: "padrao", labelKey: "default", swatch: "hsl(160 45% 45%)" },
    { value: "rosa", labelKey: "pink", swatch: "hsl(330 65% 50%)" },
    { value: "azul", labelKey: "blue", swatch: "hsl(217 70% 52%)" },
    { value: "amarelo", labelKey: "yellow", swatch: "hsl(38 92% 52%)" },
  ];
  const {
    settings: a11y,
    setColorTheme,
    setFontSize,
    setHighContrast,
    setReducedMotion,
    resetToDefaults,
  } = useAccessibility();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  async function handleConfirmDelete() {
    setDeleteLoading(true);
    setDeleteError(null);
    const result = await deleteAccount();
    if (result.ok) {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/";
      return;
    }
    setDeleteError(result.error);
    setDeleteLoading(false);
  }

  const displayEmail = userEmail ?? "-";
  const shortEmail =
    displayEmail !== "-" && displayEmail.includes("@")
      ? `${displayEmail.split("@")[0]}...`
      : displayEmail;

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 pb-12">
      <header className="mb-4 sm:mb-8">
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm sm:text-base text-muted-foreground">
          {t("subtitle")}
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <User size={18} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{t("account")}</h2>
            <p className="text-sm text-muted-foreground">{t("accountDesc")}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-secondary/20 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
          <p className="text-sm font-semibold text-foreground">{displayEmail}</p>
        </div>
      </section>

      <section id="accessibility" className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8 scroll-mt-20">
        <h2 className="text-xl font-bold text-foreground">{t("visualAndAccessibility")}</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-xl border border-border px-4 py-3 text-left transition-colors hover:bg-secondary/30"
          >
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
              {t("theme")}
            </span>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("themeCurrent", { theme: theme === "dark" ? t("themeDark") : t("themeLight") })}
            </p>
          </button>

          <label className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <Eye size={16} />
              {t("highContrastLabel")}
            </span>
            <input
              type="checkbox"
              checked={a11y.highContrast}
              onChange={(e) => setHighContrast(e.target.checked)}
            />
          </label>

          <label className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <Palette size={16} />
              {t("reducedMotionLabel")}
            </span>
            <input
              type="checkbox"
              checked={a11y.reducedMotion}
              onChange={(e) => setReducedMotion(e.target.checked)}
            />
          </label>

          <div className="rounded-xl border border-border px-4 py-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <Type size={16} />
              {t("fontLabel")}
            </span>
            <div className="mt-2 grid grid-cols-1 gap-2">
              {fontSizeOptions.map((size) => (
                <button
                  key={size.value}
                  type="button"
                  onClick={() => setFontSize(size.value)}
                  className={`rounded-lg border px-3 py-1 text-xs ${
                    a11y.fontSize === size.value
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                  aria-pressed={a11y.fontSize === size.value}
                >
                  <span className="font-semibold">{t(size.labelKey)}</span>{" "}
                  <span className="opacity-75">- {t(size.helperKey)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border px-4 py-3 sm:col-span-2">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <Palette size={16} />
              {t("palette")}
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {colorThemeOptions.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColorTheme(c.value)}
                  className={`rounded-lg border px-3 py-1 text-xs ${
                    a11y.colorTheme === c.value
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                  aria-pressed={a11y.colorTheme === c.value}
                >
                  <span
                    className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle"
                    style={{ backgroundColor: c.swatch }}
                  />
                  {t(c.labelKey)}
                </button>
              ))}
              <button
                type="button"
                onClick={resetToDefaults}
                className="rounded-lg border border-border px-3 py-1 text-xs text-muted-foreground"
              >
                {t("resetLabel")}
              </button>
            </div>
          </div>
        </div>
      </section>

      <LocationConsentCard />

      {isInActiveBeta && <BetaContactPreferencesCard />}

      {!isInActiveBeta && (
        <section id="plan-billing" className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8 scroll-mt-20">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CreditCard size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{t("planAndBilling")}</h2>
              <p className="text-sm text-muted-foreground">{t("planAndBillingDesc")}</p>
            </div>
          </div>
          <BillingCard
            workspaceId={currentWorkspaceId}
            currentPlan="pro"
            hasSubscription={!!hasStripeSubscription}
          />
        </section>
      )}

      <div className="flex flex-col items-center gap-4 pt-8">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-red-500 dark:hover:text-red-400"
        >
          <LogOut size={14} />
          {t("signOutEmail", { email: shortEmail })}
        </button>
        <button
          type="button"
          onClick={() => {
            setDeleteError(null);
            setDeleteModalOpen(true);
          }}
          className="flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-red-600 dark:hover:text-red-400"
        >
          <Trash2 size={14} />
          {t("deleteAccount")}
        </button>
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          <Link href="/terms" className="transition-colors hover:text-foreground">
            {t("terms")}
          </Link>
          <span>/</span>
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            {t("privacy")}
          </Link>
          <span>/</span>
          <Link href="/refund" className="transition-colors hover:text-foreground">
            {t("refund")}
          </Link>
        </div>
      </div>

      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-account-title"
          onClick={() => !deleteLoading && setDeleteModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="modal-delete-account-title" className="mb-2 text-lg font-bold text-foreground">
              {t("deleteModalTitle")}
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              {t("deleteModalMessage")}
            </p>
            {deleteError && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{deleteError}</p>}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => !deleteLoading && setDeleteModalOpen(false)}
                disabled={deleteLoading}
                className="rounded-xl border border-border px-4 py-2 font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground disabled:opacity-50"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="rounded-xl bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleteLoading ? t("deleting") : t("confirmDelete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
