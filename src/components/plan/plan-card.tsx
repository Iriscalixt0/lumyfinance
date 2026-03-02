import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslations, useLocale } from "@/lib/i18n";
import { PRODUCT_CONFIG, getPlanPriceByLocale } from "@/lib/product-config";

export type PlanCardCtaVariant = "register" | "subscribePro" | "checkout" | "manage" | "betaTest";

type PlanCardProps = {
  ctaVariant: PlanCardCtaVariant;
  compact?: boolean;
  sectionId?: string;
  ctaHref?: string;
};

export function PlanCard({ ctaVariant, compact = false, sectionId, ctaHref }: PlanCardProps) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const priceInfo = getPlanPriceByLocale(locale);
  const formattedPrice = priceInfo.formatted;
  const priceSubtext = t("pricing.subtext", {
    price: formattedPrice,
    trialDays: PRODUCT_CONFIG.trialDays,
  });

  const planFeatures = [
    t("plans.pro.features.trial", { trialDays: PRODUCT_CONFIG.trialDays }),
    t("plans.pro.features.workspaces", { count: PRODUCT_CONFIG.maxWorkspaces }),
    t("plans.pro.features.members", { count: PRODUCT_CONFIG.maxMembersPerWorkspace }),
    t("plans.pro.features.unlimitedTransactions"),
    t("plans.pro.features.unlimitedGoals"),
    t("plans.pro.features.advancedReports"),
    t("plans.pro.features.prioritySupport"),
  ];

  const cardContent = (
    <div
      className={`relative rounded-2xl p-6 sm:p-7 flex flex-col bg-hero-gradient text-primary-foreground shadow-lg ${compact ? "max-w-xl" : ""}`}
    >
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold-gradient text-foreground text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
        {t("plans.pro.badge")}
      </span>
      <h3 className="text-lg font-semibold font-sans">{t("plans.pro.name")}</h3>
      <p className="text-sm mt-1 text-primary-foreground/70">
        {t("plans.pro.desc", { trialDays: PRODUCT_CONFIG.trialDays })}
      </p>
      <div className="mt-5 mb-5 sm:mb-6">
        <span className="text-3xl sm:text-4xl font-bold">{formattedPrice}</span>
        <span className="text-sm text-primary-foreground/70">
          {t("plans.pro.period")}
        </span>
      </div>
      <ul className="space-y-2 sm:space-y-2.5 mb-6 sm:mb-8 flex-1">
        {planFeatures.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary-foreground" />
            {f}
          </li>
        ))}
      </ul>
      {ctaVariant === "register" && (
        <Link
          to={ctaHref ?? "/register"}
          className="w-full py-3 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 text-center block bg-card text-foreground"
        >
          {t("plans.pro.cta", { trialDays: PRODUCT_CONFIG.trialDays })}
        </Link>
      )}
      {ctaVariant === "betaTest" && (
        <div className="w-full py-3 text-center text-sm text-primary-foreground/90 font-semibold rounded-xl border border-primary-foreground/25 bg-primary-foreground/10">
          Beta ativo
        </div>
      )}
    </div>
  );

  if (compact) {
    return <div className="max-w-xl mx-auto">{cardContent}</div>;
  }

  return (
    <section id={sectionId} className="py-12 sm:py-20 px-4 sm:px-6 bg-secondary/50">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-10 sm:mb-14">
          <h2 className="text-2xl sm:text-3xl md:text-4xl tracking-tight mb-3">
            {t("pricing.title")}
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto">
            {priceSubtext}
          </p>
        </div>
        <div className="max-w-xl mx-auto">{cardContent}</div>
      </div>
    </section>
  );
}
