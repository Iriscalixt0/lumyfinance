"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { submitBetaFeedback } from "@/actions/beta";
import { MessageSquare } from "lucide-react";
import { FeedbackForm } from "./feedback-form";

export function DecisionForm({
  workspaceId,
  onComplete,
}: {
  workspaceId: string;
  currentStatus?: string;
  onComplete?: () => void;
}) {
  const t = useTranslations("beta");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleFeedbackSubmit(text: string, npsScore?: number) {
    setErrorMessage(null);
    setLoading(true);
    const result = await submitBetaFeedback({
      feedbackText: text,
      npsScore,
      upgraded: false,
      workspaceId,
    });
    setLoading(false);
    if (result.ok) {
      if (onComplete) {
        onComplete();
      } else {
        window.location.reload();
      }
      return;
    }
    setErrorMessage(result.error ?? "Nao foi possivel enviar seu feedback.");
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("decision.title")}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t("decision.subtitle")}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold text-foreground flex items-center gap-2 mb-2">
          <MessageSquare size={20} />
          {t("decision.noUpgradeTitle")}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("decision.noUpgradeDesc")}
        </p>
        <FeedbackForm
          onSubmit={handleFeedbackSubmit}
          loading={loading}
          placeholder={t("decision.feedbackPlaceholder")}
        />
        {errorMessage && (
          <p className="text-sm text-rose-600 mt-3">{errorMessage}</p>
        )}
      </div>
    </div>
  );
}
