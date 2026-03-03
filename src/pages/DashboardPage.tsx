import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useIntlFormat } from "@/hooks/useIntlFormat";
import { useGamification } from "@/hooks/useGamification";
import { useTranslations } from "@/lib/i18n";
import { StreakCard } from "@/components/gamification/StreakCard";
import { AchievementsPanel } from "@/components/gamification/AchievementsPanel";
import { LumyInsightWidget } from "@/components/dashboard/LumyInsightWidget";
import { QuickTransactionModal } from "@/components/transactions/QuickTransactionModal";
import {
  ArrowRight,
  Snowflake,
  Flame,
  Wind,
  CloudRain,
  Flower2,
  Sun,
  Waves,
  CloudSun,
  Leaf,
  TreePine,
  Cloudy,
  Sparkles,
  Wallet2,
  Plus,
  Users,
  PenLine,
  Bookmark,
  CheckCircle2,
} from "lucide-react";

const MONTH_ICONS = [
  Snowflake, Flame, Wind, CloudRain, Flower2, Sun,
  Waves, CloudSun, Leaf, TreePine, Cloudy, Sparkles,
];

interface MonthData {
  month: number;
  total: number;
}

interface BudgetSummary {
  id: string;
  category: string;
  limit_amount: number;
  spent_amount: number;
}

export function DashboardPage() {
  const fmt = useIntlFormat();
  const t = useTranslations("dashboard");
  const tc = useTranslations("common.months");
  const formatBRL = fmt.money;
  const { activeWorkspace } = useWorkspace();
  const { streak, unlockedKeys, totalTx, loading: gamLoading } = useGamification(activeWorkspace?.id ?? null);
  const [monthlyData, setMonthlyData] = useState<MonthData[]>(
    Array.from({ length: 12 }, (_, i) => ({ month: i, total: 0 }))
  );
  const [budgets, setBudgets] = useState<BudgetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasTransactions, setHasTransactions] = useState(false);
  const [quickTxOpen, setQuickTxOpen] = useState(false);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    async function load() {
      if (!activeWorkspace) { setLoading(false); return; }

      const startOfYear = `${currentYear}-01-01`;
      const endOfYear = `${currentYear}-12-31`;

      const [txRes, budgetRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("amount, type, date")
          .eq("workspace_id", activeWorkspace.id)
          .gte("date", startOfYear)
          .lte("date", endOfYear),
        supabase
          .from("budgets")
          .select("id, category, limit_amount, spent_amount")
          .eq("workspace_id", activeWorkspace.id),
      ]);

      const transactions = txRes.data;
      if (transactions && transactions.length > 0) {
        setHasTransactions(true);
        const monthly = Array.from({ length: 12 }, (_, i) => ({ month: i, total: 0 }));

        transactions.forEach((tx) => {
          const monthIdx = new Date(tx.date).getMonth();
          const value = tx.type === "income" ? tx.amount : -tx.amount;
          monthly[monthIdx].total += value;
        });

        setMonthlyData(monthly);
      }

      setBudgets(budgetRes.data ?? []);
      setLoading(false);
    }
    setLoading(true);
    setMonthlyData(Array.from({ length: 12 }, (_, i) => ({ month: i, total: 0 })));
    setHasTransactions(false);
    setBudgets([]);
    load();
  }, [activeWorkspace, currentYear]);

  /* ---------- Skeleton Loader ---------- */
  if (loading) {
    return (
      <div className="animate-fade space-y-6">
        <div>
          <div className="h-9 w-64 bg-muted rounded-lg animate-pulse" />
          <div className="h-5 w-48 bg-muted rounded-md animate-pulse mt-2" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 flex flex-col items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
              <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              <div className="h-5 w-20 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-32 bg-card border border-border rounded-2xl animate-pulse" />
          <div className="h-32 bg-card border border-border rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  /* ---------- Empty / Welcome State — Quick Start Guide ---------- */
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
                {step.done && (
                  <CheckCircle2 className="absolute top-3 right-3 h-4 w-4 text-emerald-500" />
                )}
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

        {/* Gamification still shown */}
        {!gamLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <StreakCard streak={streak} totalTx={totalTx} />
            <AchievementsPanel unlockedKeys={unlockedKeys} />
          </div>
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

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {monthlyData.map((m) => {
          const Icon = MONTH_ICONS[m.month];
          const isNegative = m.total < 0;
          const isPositive = m.total > 0;
          return (
            <div
              key={m.month}
              className="bg-card border border-border rounded-xl p-5 flex flex-col items-center text-center hover:shadow-card-hover hover:border-primary/30 transition-all cursor-pointer"
            >
              <Icon className="h-9 w-9 text-primary mb-3" />
              <p className="text-sm font-semibold text-foreground mb-1">{tc(["january","february","march","april","may","june","july","august","september","october","november","december"][m.month])}</p>
              <p className={`text-base font-bold ${
                isNegative ? "text-rose-500" : isPositive ? "text-emerald-500" : "text-primary"
              }`}>
                {m.total !== 0 && (isNegative ? "-" : "")}{formatBRL(Math.abs(m.total))}
              </p>
            </div>
          );
        })}
      </div>

      {/* Lumy Insight */}
      <LumyInsightWidget />

      {/* Gamification */}
      {!gamLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StreakCard streak={streak} totalTx={totalTx} />
          <AchievementsPanel unlockedKeys={unlockedKeys} />
        </div>
      )}

      {/* Quick Transaction FAB */}
      <button
        onClick={() => setQuickTxOpen(true)}
        className="fixed bottom-20 right-6 z-40 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
        aria-label={t("firstTransaction")}
        title={t("firstTransaction")}
      >
        <Plus className="h-5 w-5" />
      </button>
      <QuickTransactionModal
        open={quickTxOpen}
        onClose={() => setQuickTxOpen(false)}
      />

      {/* Budget progress */}
      {budgets.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet2 className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-foreground text-sm">{t("budgets")}</h3>
            </div>
            <Link to="/budgets" className="text-xs text-primary hover:underline flex items-center gap-1">
              {t("quickLinks")} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {budgets.slice(0, 6).map((b) => {
              const pct = b.limit_amount > 0 ? Math.min((b.spent_amount / b.limit_amount) * 100, 100) : 0;
              const isOver = pct >= 90;
              return (
                <div key={b.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground truncate">{b.category}</p>
                    <span className={`text-xs font-bold ${isOver ? "text-destructive" : "text-primary"}`}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isOver ? "bg-destructive" : "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatBRL(b.spent_amount)}</span>
                    <span>{formatBRL(b.limit_amount)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        {[
          { labelKey: "seeReports", href: "/annual-report", primary: true },
          { labelKey: "transactions", href: "/transactions" },
          { labelKey: "budgets", href: "/budgets" },
          { labelKey: "billings", href: "/billings" },
          { labelKey: "investments", href: "/investments" },
          { labelKey: "goals", href: "/goals" },
          { labelKey: "recurring", href: "/recurring" },
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
