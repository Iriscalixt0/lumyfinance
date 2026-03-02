"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { GoalForm } from "@/components/forms/goal-form";

export function CreateGoalButtonWithModal({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const t = useTranslations("goals");

  const handleCreateSuccess = () => {
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl shadow-card border border-primary/20 flex items-center justify-center gap-2 transition-all"
      >
        <Plus size={20} /> {t("createGoals")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-create-goal-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl shadow-card w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
              <h2 id="modal-create-goal-title" className="font-bold text-foreground text-lg">
                {t("newGoal")}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground transition-colors"
                title={t("close")}
                aria-label={t("close")}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="p-4 sm:p-6">
              <GoalForm
                workspaceId={workspaceId}
                onCreateSuccess={handleCreateSuccess}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
