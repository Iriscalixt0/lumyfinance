"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useTranslations } from "next-intl";
import { Target, CheckCircle2, Calendar, Pencil, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { GoalForm } from "@/components/forms/goal-form";
import { deleteGoal } from "@/actions/goals";
import { useVisitor } from "@/components/visitor/visitor-context";

type GoalRow = {
  id: string;
  title: string;
  target_amount: number;
  deadline: string | null;
};

export function GoalsListWithModal({
  goals,
  contributionsByGoal,
  workspaceId,
}: {
  goals: GoalRow[];
  contributionsByGoal: Record<string, number>;
  workspaceId: string;
}) {
  const [editingGoal, setEditingGoal] = useState<GoalRow | null>(null);
  const router = useRouter();
  const locale = useLocale();
  const tCommon = useTranslations("common");
  const tGoals = useTranslations("goals");
  const { requirePro } = useVisitor();

  const handleEditSuccess = () => {
    setEditingGoal(null);
    router.refresh();
  };

  async function handleDelete(id: string) {
    if (!requirePro()) return;
    try {
      await deleteGoal(id, workspaceId);
      router.refresh();
    } catch (error) {
      console.error("Failed to delete goal:", error);
    }
  }

  return (
    <>
      {goals.map((g) => {
        const acc = contributionsByGoal[g.id] ?? 0;
        const remainingCents = Math.max(0, g.target_amount - acc);
        const p = Math.min((acc / g.target_amount) * 100, 100);
        const isFinished = p >= 100;

        // Investimento mensal sugerido: valor restante ÷ meses entre hoje e a data final da meta
        const monthlySuggestedCents =
          g.deadline && remainingCents > 0
            ? (() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const deadlineDate = new Date(g.deadline + "T12:00:00");
                const msLeft = deadlineDate.getTime() - today.getTime();
                const daysLeft = msLeft / (24 * 60 * 60 * 1000);
                const monthsLeft =
                  msLeft <= 0 ? 1 : Math.max(1, Math.ceil(daysLeft / 30.44));
                return Math.ceil(remainingCents / monthsLeft);
              })()
            : null;

        return (
          <div
            key={g.id}
            className="p-4 sm:p-6 hover:bg-secondary/30 transition-colors"
          >
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
              <div className="flex gap-3 sm:gap-4 min-w-0">
                <div
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    isFinished ? "bg-primary/20 text-primary" : "bg-blue-500/10 text-blue-600"
                  }`}
                >
                  {isFinished ? <CheckCircle2 size={20} /> : <Target size={20} />}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-foreground text-sm sm:text-base truncate">{g.title}</h4>
                  {g.deadline && (
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar size={12} />{" "}
                        {new Date(g.deadline + "T12:00:00").toLocaleDateString(locale)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setEditingGoal(g)}
                  className="min-h-[44px] flex items-center justify-center px-3 sm:px-4 py-2 rounded-xl text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
                >
                  <Pencil size={14} className="mr-1" /> {tCommon("edit")}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(g.id)}
                  className="min-h-[44px] flex items-center justify-center px-3 sm:px-4 py-2 rounded-xl text-xs font-medium text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 transition-colors"
                >
                  <Trash2 size={14} className="mr-1" /> {tCommon("delete")}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground font-medium">
                  {formatCurrency(acc, locale)} de {formatCurrency(g.target_amount, locale)}
                </span>
                <span
                  className={`font-bold ${isFinished ? "text-primary" : "text-foreground"}`}
                >
                  {p.toFixed(1)}%
                </span>
              </div>
              <div className="h-3 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-700"
                  style={{ width: `${p}%` }}
                />
              </div>
              {!isFinished && monthlySuggestedCents != null && (
                <div className="flex justify-between items-center text-[11px] bg-secondary/50 p-2 rounded-lg">
                  <span className="text-muted-foreground uppercase font-bold tracking-wider">
                    {tGoals("monthlySuggested")}
                  </span>
                  <span className="font-bold text-primary">
                    {formatCurrency(monthlySuggestedCents, locale)}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {editingGoal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-goal-title"
          onClick={() => setEditingGoal(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl shadow-card w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
              <h3 id="modal-goal-title" className="font-bold text-foreground text-sm sm:text-base">
                Editar meta
              </h3>
              <button
                type="button"
                onClick={() => setEditingGoal(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground transition-colors"
                title="Fechar"
                aria-label="Fechar"
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
                goal={{
                  id: editingGoal.id,
                  title: editingGoal.title,
                  target_amount: editingGoal.target_amount,
                  deadline: editingGoal.deadline,
                }}
                onEditSuccess={handleEditSuccess}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
