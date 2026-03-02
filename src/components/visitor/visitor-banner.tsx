"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Lock } from "lucide-react";

export function VisitorBanner() {
  const t = useTranslations("billing");

  return (
    <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 flex items-center gap-3 text-sm text-foreground mb-4 sm:mb-6">
      <span className="shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-primary/15 text-primary">
        <Lock className="h-5 w-5" aria-hidden />
      </span>
      <p className="flex-1 font-medium">
        {t("subscribeToAccess")}
      </p>
      <Link
        href="/dashboard/plan"
        className="shrink-0 font-semibold text-primary hover:underline"
      >
        {t("seePlans")}
      </Link>
    </div>
  );
}
