"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { CreditCard, Loader2 } from "lucide-react";
import { createCheckoutSession } from "@/actions/billing";
import { getPlanPriceByCountry, PRODUCT_CONFIG } from "@/lib/product-config";
import { useUserCountry } from "@/hooks/use-user-country";

export function BetaUpgradeModal({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const t = useTranslations("beta");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const country = useUserCountry();
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const p = getPlanPriceByCountry(country);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  async function handleUpgrade() {
    setLoading(true);
    const result = await createCheckoutSession({ workspaceId, locale });
    setLoading(false);
    if (result.ok && result.checkoutUrl) {
      window.location.href = result.checkoutUrl;
    }
  }

  if (dismissed) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="beta-upgrade-title"
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-xl w-full">
        <div className="p-6 sm:p-8 space-y-5">
          <div className="text-center">
            <h2 id="beta-upgrade-title" className="text-2xl font-bold tracking-tight text-foreground">
              {t("decision.title")}
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              {t("blocked.desc")}
            </p>
          </div>

          <button
            type="button"
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-hero-gradient px-4 py-3 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-70"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
            {loading
              ? t("decision.redirecting")
              : t("decision.subscribeCta", { price: p.formatted, trialDays: PRODUCT_CONFIG.trialDays })}
          </button>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 font-medium hover:bg-muted/50"
          >
            {tCommon("close")}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : null;
}
