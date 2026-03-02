"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createCheckoutSession } from "@/actions/billing";
import { createClient } from "@/lib/supabase/client";
import { Lock, CreditCard, Loader2, LogOut } from "lucide-react";
import { getPlanPriceByCountry, PRODUCT_CONFIG } from "@/lib/product-config";
import { useUserCountry } from "@/hooks/use-user-country";

export function BetaBlockedClient({
  workspaceId,
  locale,
  dataDeleteAfter,
}: {
  workspaceId: string;
  locale: string;
  dataDeleteAfter?: string | null;
}) {
  const router = useRouter();
  const t = useTranslations("beta");
  const [loading, setLoading] = useState(false);
  const country = useUserCountry();

  const p = getPlanPriceByCountry(country);
  const deletionDate =
    dataDeleteAfter && !Number.isNaN(new Date(dataDeleteAfter).getTime())
      ? new Date(dataDeleteAfter).toLocaleDateString(locale)
      : null;

  async function handleCheckout() {
    setLoading(true);
    const result = await createCheckoutSession({
      workspaceId,
      locale,
    });
    setLoading(false);
    if (result.ok && result.checkoutUrl) {
      window.location.href = result.checkoutUrl;
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
    router.refresh();
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
          <Lock className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {t("blocked.title")}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {t("blocked.desc")}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleCheckout}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-hero-gradient px-4 py-3 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-70"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <CreditCard className="h-5 w-5" />
            )}
            {loading
              ? t("blocked.redirecting")
              : t("blocked.subscribeCta", { price: p.formatted, trialDays: PRODUCT_CONFIG.trialDays })}
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground hover:bg-muted/50"
          >
            <LogOut className="h-4 w-4" />
            {t("blocked.signOut")}
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          {t("blocked.signOutHint")}
        </p>
        <p className="text-xs text-amber-700">
          {deletionDate
            ? t("blocked.dataRetentionUntil", { date: deletionDate })
            : t("blocked.dataRetentionDefault")}
        </p>
      </div>
    </div>
  );
}
