"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CreditCard, Loader2 } from "lucide-react";
import { createCheckoutSession, createBillingPortalSession, saveBillingPortalFeedback } from "@/actions/billing";
import { getPlanPriceByLocale, PRODUCT_CONFIG } from "@/lib/product-config";

export function BillingCard({
  workspaceId,
  currentPlan,
  hasSubscription,
}: {
  workspaceId: string | null;
  currentPlan: "pro";
  hasSubscription: boolean;
}) {
  const t = useTranslations("billing");
  const locale = useLocale();
  const [loading, setLoading] = useState<string | null>(null);
  const [showPortalModal, setShowPortalModal] = useState(false);
  const [portalFeedbackReason, setPortalFeedbackReason] = useState("");
  const [portalFeedbackComment, setPortalFeedbackComment] = useState("");

  async function handleCheckout() {
    if (!workspaceId) return;
    setLoading("pro");
    const result = await createCheckoutSession({
      workspaceId,
      locale,
    });
    setLoading(null);
    if (result.ok && result.checkoutUrl) {
      window.location.href = result.checkoutUrl;
    } else if (!result.ok) {
      console.error(result.error);
    }
  }

  async function handlePortal() {
    if (!workspaceId) return;
    setLoading("portal");
    const result = await createBillingPortalSession(workspaceId, undefined, locale);
    setLoading(null);
    if (result.ok && result.checkoutUrl) {
      window.location.href = result.checkoutUrl;
    } else if (!result.ok) {
      console.error(result.error);
    }
  }

  if (!workspaceId) {
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm text-muted-foreground">{t("selectWorkspace")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-secondary/20 p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("currentPlan")}</p>
        <p className="text-lg font-bold text-foreground">
          {hasSubscription ? (currentPlan === "pro" ? "Pro" : currentPlan) : t("noSubscription")}
        </p>
      </div>

      {PRODUCT_CONFIG.hasPaymentIntegration && (
        <div className="flex flex-col sm:flex-row gap-2">
          {hasSubscription ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setPortalFeedbackReason("");
                  setPortalFeedbackComment("");
                  setShowPortalModal(true);
                }}
                disabled={!!loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-70"
              >
                {loading === "portal" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CreditCard size={16} />
                )}
                {loading === "portal" ? t("opening") : t("managePlan")}
              </button>
              {showPortalModal && (
                <div
                  className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="billing-portal-modal-title"
                >
                  <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-6">
                    <h2 id="billing-portal-modal-title" className="text-lg font-bold text-foreground mb-2">
                      {t("portalModalTitle")}
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t("portalModalMessage")}
                    </p>
                    <div className="space-y-3 mb-6">
                      <label htmlFor="billing-portal-feedback-reason" className="block text-sm font-medium text-foreground">
                        {t("portalModalReasonLabel")}
                      </label>
                      <select
                        id="billing-portal-feedback-reason"
                        value={portalFeedbackReason}
                        onChange={(e) => setPortalFeedbackReason(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                      >
                        <option value="">{t("portalModalReason_none")}</option>
                        <option value="update_payment">{t("portalModalReason_update_payment")}</option>
                        <option value="view_invoices">{t("portalModalReason_view_invoices")}</option>
                        <option value="cancel">{t("portalModalReason_cancel")}</option>
                        <option value="other">{t("portalModalReason_other")}</option>
                      </select>
                      <label htmlFor="billing-portal-feedback-comment" className="block text-sm font-medium text-foreground">
                        {t("portalModalCommentLabel")}
                      </label>
                      <textarea
                        id="billing-portal-feedback-comment"
                        value={portalFeedbackComment}
                        onChange={(e) => setPortalFeedbackComment(e.target.value)}
                        placeholder={t("portalModalCommentPlaceholder")}
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
                        {t("portalModalClose")}
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
                        disabled={!!loading}
                        className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-70 inline-flex items-center gap-2"
                      >
                        {loading === "portal" ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : null}
                        {t("portalModalContinue")}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={handleCheckout}
              disabled={!!loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-hero-gradient px-4 py-3 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-70"
            >
              {loading === "pro" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : null}
              {loading === "pro"
                ? t("redirecting")
                : (() => {
                    const p = getPlanPriceByLocale(locale);
                    return `${t("pro")} — ${p.formatted}/mês + ${PRODUCT_CONFIG.trialDays} dias grátis`;
                  })()}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
