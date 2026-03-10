import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useIntlFormat } from "@/hooks/useIntlFormat";
import { useGamification } from "@/hooks/useGamification";
import { useTranslations } from "@/lib/i18n";
import { StreakCard } from "@/components/gamification/StreakCard";
import { AchievementsPanel } from "@/components/gamification/AchievementsPanel";
import { ShareableAchievementCard } from "@/components/gamification/ShareableAchievementCard";
import { HealthScoreCard } from "@/components/dashboard/HealthScoreCard";
import { InsightPhrase } from "@/components/dashboard/InsightPhrase";
import { BalanceForecastCard } from "@/components/dashboard/BalanceForecastCard";
import { QuickTransactionModal } from "@/components/transactions/QuickTransactionModal";
import {
  Plus,
  Sparkles,
  PenLine,
  Bookmark,
  Users,
  CheckCircle2,
} from "lucide-react";

interface TxRow {
  amount: number;
  type: string;
  date: string;
  tags?: string | null;
}

export function DashboardPage() {
  const fmt = useIntlFormat();
  const t = useTranslations("dashboard");
  const formatBRL = fmt.money;
  const { activeWorkspace } = useWorkspace();
  const { streak, unlockedKeys, totalTx, loading: gamLoading } = useGamification(activeWorkspace?.id ?? null);

  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState(0);
  const [recurringIncome, setRecurringIncome] = useState(0);
  const [budgetLimit, setBudgetLimit] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasTransactions, setHasTransactions] = useState(false);
  const [quickTxOpen, setQuickTxOpen] = useState(false);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  useEffect(() => {
    async function load() {
      if (!activeWorkspace) { setLoading(false); return; }

      const startOfYear = `${currentYear}-01-01`;
      const endOfYear = `${currentYear}-12-31`;

      const [txRes, budgetRes, recRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("amount, type, date, tags")
          .eq("workspace_id", activeWorkspace.id)
          .gte("date", startOfYear)
          .lte("date", endOfYear),
        supabase
          .from("budgets")
          .select("limit_amount")
          .eq("workspace_id", activeWorkspace.id),
        supabase
          .from("transactions")
          .select("amount, type, tags")
          .eq("workspace_id", activeWorkspace.id)
          .or("tags.cs.{recorrente},tags.cs.{fixo}"),
      ]);

      const txData = txRes.data ?? [];
      setTransactions(txData);
      setHasTransactions(txData.length > 0);

      const totalBudget = (budgetRes.data ?? []).reduce((s, b) => s + (b.limit_amount || 0), 0);
      setBudgetLimit(totalBudget);

      const recData = recRes.data ?? [];
      setRecurringExpenses(recData.filter(r => r.type === "expense").reduce((s, r) => s + r.amount, 0));
      setRecurringIncome(recData.filter(r => r.type === "income").reduce((s, r) => s + r.amount, 0));

      setLoading(false);
    }
    setLoading(true);
    setTransactions([]);
    setHasTransactions(false);
    load();
  }, [activeWorkspace, currentYear]);

  // Derived metrics
  const metrics = useMemo(() => {
    const totalIncome = transactions.filter(tx => tx.type === "income").reduce((s, tx) => s + tx.amount, 0);
    const totalExpenses = transactions.filter(tx => tx.type === "expense").reduce((s, tx) => s + tx.amount, 0);
    const currentMonthTx = transactions.filter(tx => new Date(tx.date).getMonth() === currentMonth);
    const currentMonthExpenses = currentMonthTx.filter(tx => tx.type === "expense").reduce((s, tx) => s + tx.amount, 0);
    const currentMonthIncome = currentMonthTx.filter(tx => tx.type === "income").reduce((s, tx) => s + tx.amount, 0);
    const monthsPassed = Math.max(currentMonth, 1);
    const avgMonthlyExpenses = totalExpenses / monthsPassed;
    const currentBalance = currentMonthIncome - currentMonthExpenses;
    const estimatedEndOfMonth = currentBalance - recurringExpenses + recurringIncome;

    return { totalIncome, totalExpenses, currentMonthExpenses, avgMonthlyExpenses, currentBalance, estimatedEndOfMonth };
  }, [transactions, currentMonth, recurringExpenses, recurringIncome]);

  // Health Score calculation (local logic)
  const healthScore = useMemo(() => {
    if (!hasTransactions) return 50;
    const { totalIncome, totalExpenses, currentMonthExpenses, avgMonthlyExpenses } = metrics;
    let score = 50;

    // Savings rate component (0-40 pts)
    if (totalIncome > 0) {
      const savingsRate = (totalIncome - totalExpenses) / totalIncome;
      score += Math.min(Math.max(savingsRate * 100, -20), 40);
    }

    // Spending trend (0-10 pts)
    if (avgMonthlyExpenses > 0) {
      const trend = currentMonthExpenses / avgMonthlyExpenses;
      if (trend < 0.9) score += 10;
      else if (trend > 1.2) score -= 10;
    }

    return Math.round(Math.min(Math.max(score, 0), 100));
  }, [hasTransactions, metrics]);

  /* ---------- Skeleton Loader ---------- */
  if (loading) {
    return (
      <div className="animate-fade space-y-6">
        <div>
          <div className="h-9 w-64 bg-muted rounded-lg animate-pulse" />
          <div className="h-5 w-48 bg-muted rounded-md animate-pulse mt-2" />
        </div>
        <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-4 animate-pulse">
          <div className="h-44 w-44 rounded-full bg-muted" />
          <div className="h-5 w-48 bg-muted rounded" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-40 bg-card border border-border rounded-2xl animate-pulse" />
          <div className="h-40 bg-card border border-border rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  /* ---------- Empty / Welcome State ---------- */
  if (!hasTransactions) {
    const steps = [
      { num: 1, icon: Bookmark, titleKey: "step1Title", descKey: "step1Desc", href: "/workspace", done: !!activeWorkspace?.name },
      { num: 2, icon: PenLine, titleKey: "step2Title", descKey: "step2Desc", href: "/transactions", done: false },
      { num: 3, icon: Users, titleKey: "step3Title", descKey: "step3Desc", href: "/workspace", done: false },
    ];

    return (
      <div className="animate-fade space-y-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">{t("yearView")}</h1>
          <p className="text-muted-foreground text-base mt-1">
            {activeWorkspace?.name || t("smartManagement", { year: String(currentYear) })} — {currentYear}
          </p>
        </div>

        {/* Quick Start Guide */}
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8">
          <div className="text-center mb-8">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">{t("quickStartTitle")}</h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">{t("quickStartSubtitle")}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
            {steps.map((step) => (
              <Link
                key={step.num}
                to={step.href}
                className={`relative flex flex-col items-center text-center p-5 rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5 group ${
                  step.done
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-border hover:border-primary/30 bg-card"
                }`}
              >
                {step.done && <CheckCircle2 className="absolute top-3 right-3 h-4 w-4 text-emerald-500" />}
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center mb-3 transition-colors ${
                  step.done
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-primary/10 text-primary group-hover:bg-primary/20"
                }`}>
                  <step.icon className="h-6 w-6" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  {t("step")} {step.num}
                </span>
                <h3 className="text-sm font-bold text-foreground mb-1">{t(step.titleKey)}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{t(step.descKey)}</p>
              </Link>
            ))}
          </div>

          <div className="text-center mt-6">
            <button
              onClick={() => setQuickTxOpen(true)}
              className="bg-hero-gradient text-primary-foreground font-bold text-sm px-6 py-3 rounded-xl hover:opacity-90 transition-opacity inline-flex items-center gap-2 shadow-lg"
            >
              <Plus className="h-4 w-4" /> {t("firstTransaction")}
            </button>
          </div>
        </div>

      {!gamLoading && (
          <AchievementsPanel unlockedKeys={unlockedKeys} />
        )}

        <QuickTransactionModal
          open={quickTxOpen}
          onClose={() => setQuickTxOpen(false)}
          onSaved={() => window.location.reload()}
        />
      </div>
    );
  }

  /* ---------- Normal Dashboard ---------- */
  return (
    <div className="animate-fade space-y-6">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">{t("yearView")}</h1>
        <p className="text-muted-foreground text-base mt-1">
          {activeWorkspace?.name || t("smartManagement", { year: String(currentYear) })} — {currentYear}
        </p>
      </div>

      {/* Health Score */}
      <HealthScoreCard score={healthScore} />

      {/* Insight Phrase */}
      <InsightPhrase
        totalIncome={metrics.totalIncome}
        totalExpenses={metrics.totalExpenses}
        avgMonthlyExpenses={metrics.avgMonthlyExpenses}
        currentMonthExpenses={metrics.currentMonthExpenses}
        budgetLimit={budgetLimit}
      />

      {/* Balance Forecast + Gamification */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BalanceForecastCard
          currentBalance={metrics.currentBalance}
          estimatedEndOfMonth={metrics.estimatedEndOfMonth}
          recurringExpenses={recurringExpenses}
          recurringIncome={recurringIncome}
        />

        
      </div>

      {!gamLoading && <AchievementsPanel unlockedKeys={unlockedKeys} />}

      {/* Shareable achievement card — show when streak >= 30 or significant savings */}
      {!gamLoading && streak.current_streak >= 30 && (
        <ShareableAchievementCard
          type="streak"
          value={streak.current_streak}
        />
      )}
      {!gamLoading && metrics.totalIncome > 0 && metrics.totalIncome > metrics.totalExpenses && (
        <ShareableAchievementCard
          type="goal"
          value={metrics.totalIncome - metrics.totalExpenses}
        />
      )}
      {/* Quick Transaction FAB — positioned left of the VoiceFAB */}
      <button
        onClick={() => setQuickTxOpen(true)}
        style={{ bottom: "calc(1.5rem + 72px)", right: "1.5rem" }}
        className="fixed z-40 h-[60px] w-[60px] rounded-2xl bg-primary text-primary-foreground shadow-xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
        aria-label={t("firstTransaction")}
        title={t("firstTransaction")}
      >
        <Plus className="h-6 w-6" />
      </button>
      <QuickTransactionModal
        open={quickTxOpen}
        onClose={() => setQuickTxOpen(false)}
      />

      {/* Quick links */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        {[
          { labelKey: "seeReports", href: "/annual-report", primary: true },
          { labelKey: "transactions", href: "/transactions" },
          { labelKey: "budgets", href: "/budgets" },
        ].map((link) => (
          <Link
            key={link.href}
            to={link.href}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              link.primary
                ? "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            {t(link.labelKey)}
          </Link>
        ))}
      </div>
    </div>
  );
}
