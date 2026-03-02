"use client";

import { useState, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createGoalContribution } from "@/actions/goals";
import { parseBRL, formatCurrency } from "@/lib/utils/currency";
import { getTodayISO } from "@/lib/utils/dates";
import { DatePicker } from "@/components/date-picker";
import { SimpleSelect } from "@/components/simple-select";
import { useVisitor } from "@/components/visitor/visitor-context";
import type { Goal } from "@/types/database";

export function GoalContributionForm({
  workspaceId,
  goals,
  contributionsByGoal = {},
  locale = "pt-BR",
}: {
  workspaceId: string;
  goals: Goal[];
  contributionsByGoal?: Record<string, number>;
  locale?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [date, setDate] = useState(getTodayISO);
  const t = useTranslations("forms.goalContribution");
  const tTransaction = useTranslations("forms.transaction");
  const tError = useTranslations("errors");
  const userLocale = useLocale();
  const { requirePro } = useVisitor();

  const today = getTodayISO();
  const selectedGoal = useMemo(() => goals.find((g) => g.id === selectedGoalId), [goals, selectedGoalId]);
  const suggestedMonthly = useMemo(() => {
    if (!selectedGoal) return null;
    const acc = contributionsByGoal[selectedGoal.id] ?? 0;
    const remaining = Math.max(0, selectedGoal.target_amount - acc);
    const deadline = selectedGoal.deadline ? new Date(selectedGoal.deadline + "T12:00:00") : null;
    if (!deadline || remaining <= 0) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const msLeft = deadline.getTime() - today.getTime();
    const daysLeft = msLeft / (24 * 60 * 60 * 1000);
    const monthsLeft = msLeft <= 0 ? 1 : Math.max(1, Math.ceil(daysLeft / 30.44));
    return Math.ceil(remaining / monthsLeft);
  }, [selectedGoal, contributionsByGoal]);

  const goalOptions = [
    { value: "", label: t("selectGoal") },
    ...goals.map((g) => ({ value: g.id, label: g.title })),
  ];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!requirePro()) return;
    setLoading(true);
    setToast(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const goalId = formData.get("goal_id") as string;
    if (!goalId) {
      setToast(t("selectGoalError"));
      setLoading(false);
      return;
    }
    try {
      await createGoalContribution({
        workspace_id: workspaceId,
        goal_id: goalId,
        amount: parseBRL(formData.get("amount") as string),
        date: formData.get("date") as string,
      });
      setToast(t("progressSaved"));
      setDate(today);
      setSelectedGoalId("");
      form.reset();
    } catch (err) {
      setToast(err instanceof Error ? err.message : tError("generic"));
    } finally {
      setLoading(false);
    }
  }

  const displayLocale = locale ?? userLocale;

  return (
    <div className="bg-card border border-border rounded-2xl shadow-card p-4 sm:p-6 w-full max-w-full lg:max-w-none">
      <h4 className="font-bold text-foreground mb-4 sm:mb-6 text-sm sm:text-base">{t("title")}</h4>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1 block mb-1">
            {t("date")}
          </label>
          <DatePicker
            id="gc-date"
            name="date"
            value={date}
            onChange={setDate}
            required
            locale={userLocale}
            placeholder={tTransaction("datePlaceholder")}
            clearLabel={tTransaction("dateClear")}
            todayLabel={tTransaction("dateToday")}
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1 block mb-1">
            {t("goal")}
          </label>
          <SimpleSelect
            name="goal_id"
            value={selectedGoalId}
            onChange={setSelectedGoalId}
            options={goalOptions}
            required
          />
        </div>
        {suggestedMonthly != null && (
          <p className="text-xs text-muted-foreground">
            {t("suggestion", { amount: formatCurrency(suggestedMonthly, displayLocale) })}
          </p>
        )}
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1 block mb-1">
            {t("amount")}
          </label>
          <input
            type="text"
            inputMode="decimal"
            name="amount"
            required
            placeholder={suggestedMonthly != null ? formatCurrency(suggestedMonthly, displayLocale) : t("placeholderAmount")}
            className="w-full px-4 py-3 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground placeholder:text-sm"
          />
        </div>
        {toast && (
          <p className={`text-sm font-medium ${toast.includes("!") ? "text-emerald-600" : "text-rose-600"}`}>
            {toast}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || goals.length === 0}
          className="w-full min-h-[44px] bg-hero-gradient text-primary-foreground font-semibold py-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-70"
        >
          {loading ? t("saving") : t("save")}
        </button>
      </form>
    </div>
  );
}
