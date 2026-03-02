"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PRODUCT_CONFIG, getPlanPriceByLocale } from "@/lib/product-config";
import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import {
  createCheckoutForNewUserWithoutWorkspace,
  createCheckoutForVisitorUpgrade,
  createCheckoutSession,
  createBillingPortalSession,
  saveBillingPortalFeedback,
} from "@/actions/billing";
import { useLocale } from "next-intl";

export type PlanCardCtaVariant = "register" | "subscribePro" | "checkout" | "manage" | "betaTest";

type PlanCardProps = {
  /** Na landing: link para registro. No dashboard (visitante): botÃ£o Assinar Pro. */
  ctaVariant: PlanCardCtaVariant;
  /** Se true, usa layout compacto (ex.: dentro da pÃ¡gina de plano do dashboard). */
  compact?: boolean;
  /** Id do elemento section (ex.: "precos" na landing). */
  sectionId?: string;
  /** NecessÃ¡rio quando ctaVariant Ã© "checkout" (usuÃ¡rio regular sem assinatura). */
  workspaceId?: string;
  /** Sobrescreve destino do CTA quando ctaVariant = "register". */
  ctaHref?: string;
};

export function PlanCard({ ctaVariant, compact = false, sectionId, workspaceId, ctaHref }: PlanCardProps) {
  const t = useTranslations("landing");
  const tBilling = useTranslations("billing");
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

  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [showPortalModal, setShowPortalModal] = useState(false);
  const [portalFeedbackReason, setPortalFeedbackReason] = useState("");
  const [portalFeedbackComment, setPortalFeedbackComment] = useState("");

  async function handleSubscribePro() {
    setCheckoutError(null);
    setSubscribeLoading(true);
    const result = await createCheckoutForVisitorUpgrade(locale);
    setSubscribeLoading(false);
    if (result.ok && result.checkoutUrl) {
      if (result.workspaceId) {
        document.cookie = `workspace_id=${result.workspaceId}; path=/; max-age=31536000; SameSite=Lax`;
      }
      window.location.href = result.checkoutUrl;
    } else if (!result.ok) {
      setCheckoutError(result.error ?? "Erro ao abrir checkout.");
    }
  }

  async function handlePortal() {
    if (!workspaceId) return;
    setCheckoutError(null);
    setPortalLoading(true);
    const result = await createBillingPortalSession(workspaceId, undefined, locale);
    setPortalLoading(false);
    if (result.ok && result.checkoutUrl) {
      window.location.href = result.checkoutUrl;
    } else if (!result.ok) {
      setCheckoutError(result.error ?? "Erro ao abrir portal.");
    }
  }

  async function handleCheckout() {
    setCheckoutError(null);
    setSubscribeLoading(true);
    const result = workspaceId
      ? await createCheckoutSession({ workspaceId, locale })
      : await createCheckoutForNewUserWithoutWorkspace(locale);
    setSubscribeLoading(false);
    if (result.ok && result.checkoutUrl) {
      if (result.workspaceId) {
        document.cookie = `workspace_id=${result.workspaceId}; path=/; max-age=31536000; SameSite=Lax`;
      }
      window.location.href = result.checkoutUrl;
    } else if (!result.ok) {
      setCheckoutError(result.error ?? "Erro ao abrir checkout.");
    }
  }

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
          href={ctaHref ?? "/register"}
          className="w-full py-3 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 text-center block bg-card text-foreground"
        >
          {t("plans.pro.cta", { trialDays: PRODUCT_CONFIG.trialDays })}
        </Link>
      )}
      {ctaVariant === "subscribePro" && (
        <button
          type="button"
          onClick={handleSubscribePro}
          disabled={subscribeLoading}
          className="w-full py-3 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 text-center block bg-card text-foreground disabled:opacity-70"
        >
          {subscribeLoading ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("plans.pro.ctaDashboard")}
            </span>
          ) : (
            t("plans.pro.ctaDashboard")
          )}
        </button>
      )}
      {ctaVariant === "checkout" && (
        <button
          type="button"
          onClick={handleCheckout}
          disabled={subscribeLoading}
          className="w-full py-3 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 text-center block bg-card text-foreground disabled:opacity-70"
        >
          {subscribeLoading ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("plans.pro.ctaDashboard")}
            </span>
          ) : (
            t("plans.pro.ctaDashboard")
          )}
        </button>
      )}
      {checkoutError && (
        <p className="mt-3 text-sm text-red-400 text-center">{checkoutError}</p>
      )}
      {ctaVariant === "manage" && (
        <>
          <button
            type="button"
            onClick={() => {
              setPortalFeedbackReason("");
              setPortalFeedbackComment("");
              setShowPortalModal(true);
            }}
            disabled={portalLoading}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 text-center block bg-card text-foreground disabled:opacity-70"
          >
            {portalLoading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("pricing.manageCta")}
              </span>
            ) : (
              t("pricing.manageCta")
            )}
          </button>
          {showPortalModal && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="portal-modal-title"
            >
              <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-6">
                <h2 id="portal-modal-title" className="text-lg font-bold text-foreground mb-2">
                  {tBilling("portalModalTitle")}
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {tBilling("portalModalMessage")}
                </p>
                <div className="space-y-3 mb-6">
                  <label htmlFor="portal-feedback-reason" className="block text-sm font-medium text-foreground">
                    {tBilling("portalModalReasonLabel")}
                  </label>
                  <select
                    id="portal-feedback-reason"
                    value={portalFeedbackReason}
                    onChange={(e) => setPortalFeedbackReason(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">{tBilling("portalModalReason_none")}</option>
                    <option value="update_payment">{tBilling("portalModalReason_update_payment")}</option>
                    <option value="view_invoices">{tBilling("portalModalReason_view_invoices")}</option>
                    <option value="cancel">{tBilling("portalModalReason_cancel")}</option>
                    <option value="other">{tBilling("portalModalReason_other")}</option>
                  </select>
                  <label htmlFor="portal-feedback-comment" className="block text-sm font-medium text-foreground">
                    {tBilling("portalModalCommentLabel")}
                  </label>
                  <textarea
                    id="portal-feedback-comment"
                    value={portalFeedbackComment}
                    onChange={(e) => setPortalFeedbackComment(e.target.value)}
                    placeholder={tBilling("portalModalCommentPlaceholder")}
                    rows={3}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none"
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowPortalModal(false)}
                    className="px-4 py-2 rounded-xl border border-border bg-secondary/50 text-foreground font-medium hover:bg-secondary transition-colors"
                  >
                    {tBilling("portalModalClose")}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setShowPortalModal(false);
                      if (workspaceId && (portalFeedbackReason.trim() || portalFeedbackComment.trim())) {
                        await saveBillingPortalFeedback(
                          workspaceId,
                          portalFeedbackReason.trim() || null,
                          portalFeedbackComment.trim() || null
                        );
                      }
                      handlePortal();
                    }}
                    disabled={portalLoading}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-70 inline-flex items-center gap-2"
                  >
                    {portalLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {tBilling("portalModalContinue")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {ctaVariant === "betaTest" && (
        <div className="w-full py-3 text-center text-sm text-primary-foreground/90 font-semibold rounded-xl border border-primary-foreground/25 bg-primary-foreground/10">
          {tBilling("activePlan")} (Beta)
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

