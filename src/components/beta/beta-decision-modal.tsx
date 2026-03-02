"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { DecisionForm } from "./decision-form";

/**
 * Modal que aparece automaticamente quando o teste beta termina.
 * Não pode ser fechado até o usuário assinar ou enviar feedback.
 */
export function BetaDecisionModal({
  workspaceId,
  currentStatus = "feedback_pending",
}: {
  workspaceId: string;
  currentStatus?: string;
}) {
  const router = useRouter();

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleComplete = () => {
    router.refresh();
  };

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="beta-decision-title"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") e.preventDefault();
      }}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 sm:p-8">
          <DecisionForm
            workspaceId={workspaceId}
            currentStatus={currentStatus}
            onComplete={handleComplete}
          />
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : null;
}
