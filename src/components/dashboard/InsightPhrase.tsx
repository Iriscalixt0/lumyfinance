import { useIntlFormat } from "@/hooks/useIntlFormat";
import { useTranslations } from "@/lib/i18n";
import { Sparkles } from "lucide-react";

interface InsightPhraseProps {
  totalIncome: number;
  totalExpenses: number;
  avgMonthlyExpenses: number;
  currentMonthExpenses: number;
  budgetLimit: number;
  loading?: boolean;
}

export function InsightPhrase({
  totalIncome,
  totalExpenses,
  avgMonthlyExpenses,
  currentMonthExpenses,
  budgetLimit,
  loading,
}: InsightPhraseProps) {
  const t = useTranslations("dashboard");
  const fmt = useIntlFormat();

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5 animate-pulse">
        <div className="h-5 w-3/4 bg-muted rounded mx-auto" />
      </div>
    );
  }

  function generatePhrase(): string {
    const balance = totalIncome - totalExpenses;
    const currentMonth = new Date().getMonth();
    const monthsPassed = Math.max(currentMonth, 1);

    // Over average
    if (avgMonthlyExpenses > 0 && currentMonthExpenses > avgMonthlyExpenses * 1.2) {
      const pct = Math.round(((currentMonthExpenses - avgMonthlyExpenses) / avgMonthlyExpenses) * 100);
      return t("insightOverAvg", { pct: String(pct) });
    }

    // Daily budget available
    const daysLeft = new Date(new Date().getFullYear(), currentMonth + 1, 0).getDate() - new Date().getDate();
    if (daysLeft > 0 && balance > 0) {
      const dailyBudget = Math.floor(balance / daysLeft);
      if (dailyBudget > 0) {
        return t("insightDailyBudget", { amount: fmt.money(dailyBudget) });
      }
    }

    // Under budget
    if (budgetLimit > 0 && currentMonthExpenses < budgetLimit * 0.7) {
      return t("insightOnTrack");
    }

    // Fallback
    if (balance > 0) {
      return t("insightPositive");
    }

    return t("insightNegative");
  }

  return (
    <div className="bg-card border border-border rounded-2xl px-5 py-4 flex items-center gap-3 animate-fade">
      <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      <p className="text-sm font-medium text-foreground leading-relaxed">
        {generatePhrase()}
      </p>
    </div>
  );
}
