"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { X, ArrowRight, Compass } from "lucide-react";
import { startGuidedTour } from "./guided-tour";

const STORAGE_KEY = "nf_welcome_shown";

export function WelcomeBanner() {
  const [show, setShow] = useState(false);
  const t = useTranslations("welcome");
  const tCommon = useTranslations("common");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const alreadyShown = sessionStorage.getItem(STORAGE_KEY);
    if (!alreadyShown) setShow(true);
  }, []);

  function handleDismiss() {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  }

  function handleCta() {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="mb-6 sm:mb-8 p-4 sm:p-5 rounded-2xl bg-primary/10 border border-primary/20 relative">
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-2 right-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:bg-primary/20 hover:text-foreground transition-colors"
        aria-label={tCommon("close")}
      >
        <X className="h-4 w-4" />
      </button>
      <h3 className="text-base sm:text-lg font-bold text-foreground pr-12">
        {t("title")}
      </h3>
      <p className="text-sm text-muted-foreground mt-1 mb-4">
        {t("subtitle")}
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/transactions"
          onClick={handleCta}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] bg-hero-gradient text-primary-foreground font-semibold px-5 py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity"
        >
          {t("goToTransactions")} <ArrowRight className="h-4 w-4" />
        </Link>
        <button
          type="button"
          onClick={() => {
            handleDismiss();
            startGuidedTour();
          }}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-semibold border border-border bg-secondary hover:bg-primary/10 text-foreground transition-colors"
        >
          <Compass className="h-4 w-4" />
          {t("seeTour")}
        </button>
      </div>
    </div>
  );
}
