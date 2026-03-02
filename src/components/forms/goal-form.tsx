"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Plus, AlertCircle } from "lucide-react";
import { createGoal, updateGoal } from "@/actions/goals";
import { parseBRL } from "@/lib/utils/currency";
import { DatePicker } from "@/components/date-picker";
import { useVisitor } from "@/components/visitor/visitor-context";

type GoalForEdit = {
  id: string;
  title: string;
  target_amount: number;
  deadline: string | null;
};

export function GoalForm({
  workspaceId,
  goal,
  onEditSuccess,
  onCreateSuccess,
}: {
  workspaceId: string;
  goal?: GoalForEdit;
  onEditSuccess?: () => void;
  onCreateSuccess?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [deadline, setDeadline] = useState<string>(() =>
    (goal?.deadline && goal.deadline.trim()) ? goal.deadline : ""
  );
  const router = useRouter();
  const t = useTranslations("forms.goal");
  const tTransaction = useTranslations("forms.transaction");
  const userLocale = useLocale();
  const { requirePro } = useVisitor();
  const isEdit = !!goal;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!requirePro()) return;
    setLoading(true);
    setToast(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const title = formData.get("title") as string;
    const target_amount = parseBRL(formData.get("target_amount") as string);
    const deadlineRaw = formData.get("deadline") as string;
    const deadline = deadlineRaw && deadlineRaw.trim() ? deadlineRaw : undefined;
    try {
      if (isEdit) {
        await updateGoal(goal.id, workspaceId, { title, target_amount, deadline });
        setToast(t("goalUpdated"));
        if (onEditSuccess) onEditSuccess();
        router.refresh();
      } else {
        await createGoal({
          workspace_id: workspaceId,
          title,
          target_amount,
          deadline,
        });
        setToast(t("goalCreated"));
        setDeadline("");
        form.reset();
        if (onCreateSuccess) onCreateSuccess();
        router.refresh();
      }
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  const defaultTitle = isEdit ? goal.title : "";
  const defaultTarget = isEdit ? (goal.target_amount / 100).toFixed(2) : "";

  return (
    <div className="bg-card border border-border rounded-2xl shadow-card p-4 sm:p-6 w-full max-w-full lg:max-w-none">
      <div className="flex items-center gap-2 mb-6">
        {!isEdit && <Plus className="text-primary" size={20} />}
        <h2 className="text-lg font-bold text-foreground">
          {isEdit ? t("edit") : t("new")}
        </h2>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-bold text-emerald-800 dark:text-emerald-600 uppercase ml-1 block mb-1">
            {t("name")}
          </label>
          <input
            type="text"
            name="title"
            required
            placeholder={t("placeholderTitle")}
            defaultValue={defaultTitle}
            className="w-full px-4 py-3 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <label className="text-sm font-bold text-emerald-800 dark:text-emerald-600 uppercase ml-1 block mb-1">
            {t("targetAmount")}
          </label>
          <input
            type="text"
            inputMode="decimal"
            name="target_amount"
            required
            placeholder="0,00"
            defaultValue={defaultTarget}
            className="w-full px-4 py-3 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <label className="text-sm font-bold text-emerald-800 dark:text-emerald-600 uppercase ml-1 block mb-1">
            {t("deadline")}
          </label>
          <DatePicker
            id="goal-deadline"
            name="deadline"
            value={deadline}
            onChange={setDeadline}
            locale={userLocale}
            placeholder={tTransaction("datePlaceholder")}
            clearLabel={tTransaction("dateClear")}
            todayLabel={tTransaction("dateToday")}
          />
        </div>
        {toast && (
          <p className={`text-sm font-medium ${toast.includes("!") ? "text-emerald-600" : "text-rose-600"}`}>
            {toast}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-md transition-all disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {loading ? (isEdit ? t("updating") : t("creating")) : isEdit ? t("update") : t("create")}
        </button>
      </form>
      {!isEdit && (
        <div className="mt-6 p-4 bg-blue-500/10 rounded-xl border border-blue-500/20 flex gap-3">
          <AlertCircle className="text-blue-600 shrink-0" size={20} />
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
            {t("hint")}
          </p>
        </div>
      )}
    </div>
  );
}
