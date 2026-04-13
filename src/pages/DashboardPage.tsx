import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { useIntlFormat } from "@/hooks/useIntlFormat";
import { useGamification } from "@/hooks/useGamification";
import { useTranslations } from "@/lib/i18n";
import { QuickTransactionModal } from "@/components/transactions/QuickTransactionModal";
import { SafeToSpendCard } from "@/components/dashboard/SafeToSpendCard";
import { QuickStatsRow } from "@/components/dashboard/QuickStatsRow";
import { GoalsOverview } from "@/components/dashboard/GoalsOverview";
import { MemberSpending } from "@/components/dashboard/MemberSpending";
import { HealthScoreCard } from "@/components/dashboard/HealthScoreCard";
import {
  Plus,
  Sparkles,
  PenLine,
  Bookmark,
  Users,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

interface TxRow {
  id: string;
  description: string;
  amount: number;
  type: string;
  date: string;
  tags?: string | null;
  category_id?: string | null;
}

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface GoalRow {
  id: string;
  name: string;
  current_amount: number;
  target_amount: number;
}

export function DashboardPage() {
  const fmt = useIntlFormat();
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const formatBRL = fmt.money;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { streak, unlockedKeys, totalTx, loading: gamLoading } = useGamification(activeWorkspace?.id ?? null);

  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState(0);
  const [recurringIncome, setRecurringIncome] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasTransactions, setHasTransactions] = useState(false);
  const [quickTxOpen, setQuickTxOpen] = useState(false);
  const [chartRange, setChartRange] = useState<"6" | "12">("6");

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  const MONTH_SHORT = useMemo(() => [
    tCommon("months.january").slice(0, 3),
    tCommon("months.february").slice(0, 3),
    tCommon("months.march").slice(0, 3),
    tCommon("months.april").slice(0, 3),
    tCommon("months.may").slice(0, 3),
    tCommon("months.june").slice(0, 3),
    tCommon("months.july").slice(0, 3),
    tCommon("months.august").slice(0, 3),
    tCommon("months.september").slice(0, 3),
    tCommon("months.october").slice(0, 3),
    tCommon("months.november").slice(0, 3),
    tCommon("months.december").slice(0, 3),
  ], [tCommon]);

  useEffect(() => {
    async function load() {
      if (!activeWorkspace) { setLoading(false); return; }

      const startOfYear = `${currentYear}-01-01`;
      const endOfYear = `${currentYear}-12-31`;

      const [txRes, recRes, catRes, goalsRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("id, description, amount, type, date, tags, category_id")
          .eq("workspace_id", activeWorkspace.id)
          .gte("date", startOfYear)
          .lte("date", endOfYear)
          .order("date", { ascending: false }),
        supabase
          .from("transactions")
          .select("amount, type, tags")
          .eq("workspace_id", activeWorkspace.id)
          .or("tags.cs.{recorrente},tags.cs.{fixo}"),
        supabase
          .from("categories")
          .select("id, name, icon")
          .eq("workspace_id", activeWorkspace.id),
        supabase
          .from("goals")
          .select("id, name, current_amount, target_amount")
          .eq("workspace_id", activeWorkspace.id)
          .order("created_at", { ascending: false }),
      ]);

      const txData = txRes.data ?? [];
      setTransactions(txData);
      setCategories(catRes.data ?? []);
      setGoals(goalsRes.data ?? []);
      setHasTransactions(txData.length > 0);

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

    return { totalIncome, totalExpenses, currentMonthExpenses, currentMonthIncome, avgMonthlyExpenses, currentBalance, estimatedEndOfMonth };
  }, [transactions, currentMonth, recurringExpenses, recurringIncome]);

  // Safe-to-spend = current month income - current month expenses
  const safeToSpend = metrics.currentMonthIncome - metrics.currentMonthExpenses;

  // Health Score
  const healthScore = useMemo(() => {
    if (!hasTransactions) return 50;
    const { totalIncome, totalExpenses, currentMonthExpenses, avgMonthlyExpenses } = metrics;
    let score = 50;
    if (totalIncome > 0) {
      const savingsRate = (totalIncome - totalExpenses) / totalIncome;
      score += Math.min(Math.max(savingsRate * 100, -20), 40);
    }
    if (avgMonthlyExpenses > 0) {
      const trend = currentMonthExpenses / avgMonthlyExpenses;
      if (trend < 0.9) score += 10;
      else if (trend > 1.2) score -= 10;
    }
    return Math.round(Math.min(Math.max(score, 0), 100));
  }, [hasTransactions, metrics]);

  // Chart data
  const chartData = useMemo(() => {
    const months = Number(chartRange);
    const data = [];
    for (let i = months - 1; i >= 0; i--) {
      const m = currentMonth - i;
      const month = ((m % 12) + 12) % 12;
      const monthTx = transactions.filter(tx => new Date(tx.date).getMonth() === month);
      const income = monthTx.filter(tx => tx.type === "income").reduce((s, tx) => s + tx.amount, 0);
      const expense = monthTx.filter(tx => tx.type === "expense").reduce((s, tx) => s + tx.amount, 0);
      data.push({ name: MONTH_SHORT[month], income: income / 100, expense: expense / 100 });
    }
    return data;
  }, [transactions, currentMonth, chartRange, MONTH_SHORT]);

  // Recent transactions
  const recentTx = useMemo(() => transactions.slice(0, 6), [transactions]);

  const getCategoryIcon = (id: string | null | undefined) => {
    if (!id) return "$";
    const cat = categories.find(c => c.id === id);
    return cat?.icon || "$";
  };

  // Goals for overview
  const goalsForOverview = useMemo(() => goals.map(g => ({
    id: g.id,
    name: g.name,
    current: g.current_amount,
    target: g.target_amount,
  })), [goals]);

  // Mock member spending from transactions (group by unique description patterns)
  const memberSpending = useMemo(() => {
    if (!hasTransactions) return [];
    const totalExpenses = metrics.currentMonthExpenses;
    if (totalExpenses <= 0) return [];
    return [
      { name: userName, avatar: undefined, spent: metrics.currentMonthExpenses, percentage: 100 },
    ];
  }, [hasTransactions, metrics, userName]);

  /* ---------- Skeleton Loader ---------- */
  if (loading) {
    return (
      <div className="animate-fade space-y-4">
        <div className="h-7 w-48 bg-muted rounded-lg animate-pulse" />
        <div className="h-36 bg-primary/10 rounded-2xl animate-pulse" />
        <div className="flex gap-3">
          <div className="flex-1 h-20 bg-muted rounded-2xl animate-pulse" />
          <div className="flex-1 h-20 bg-muted rounded-2xl animate-pulse" />
        </div>
        <div className="h-48 bg-card border border-border rounded-2xl animate-pulse" />
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
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">
          {greeting}, {userName} 👋
        </h1>

        {/* Safe-to-Spend even empty */}
        <SafeToSpendCard amount={formatBRL(0)} />

        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8">
          <div className="text-center mb-8">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">{t("quickStartTitle")}</h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">{t("quickStartSubtitle")}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
            {steps.map((step) => (
              <Link
                key={step.num}
                to={step.href}
                className={`relative flex flex-col items-center text-center p-5 rounded-xl border transition-all hover:shadow-md group ${
                  step.done
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-border hover:border-primary/30 bg-card"
                }`}
              >
                {step.done && <CheckCircle2 className="absolute top-3 right-3 h-4 w-4 text-emerald-500" />}
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center mb-3 transition-colors ${
                  step.done ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary"
                }`}>
                  <step.icon className="h-5 w-5" />
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
              className="bg-primary text-primary-foreground font-bold text-sm px-6 py-3 rounded-xl hover:opacity-90 transition-opacity inline-flex items-center gap-2 shadow-lg"
            >
              <Plus className="h-4 w-4" /> {t("firstTransaction")}
            </button>
          </div>
        </div>

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
    <div className="animate-fade space-y-4">
      {/* Greeting */}
      <h1 className="text-xl sm:text-2xl font-bold text-foreground">
        {greeting}, {userName} 👋
      </h1>

      {/* Safe-to-Spend Hero Card */}
      <SafeToSpendCard amount={formatBRL(safeToSpend)} />

      {/* Quick Stats — Income / Expenses */}
      <QuickStatsRow
        income={formatBRL(metrics.currentMonthIncome)}
        expenses={formatBRL(metrics.currentMonthExpenses)}
        incomeLabel={t("income")}
        expensesLabel={t("expenses")}
      />

      {/* Desktop: 2-column grid for chart + health/goals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Chart Card */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">{t("transactions")}</h2>
            <select
              value={chartRange}
              onChange={(e) => setChartRange(e.target.value as "6" | "12")}
              className="bg-muted text-foreground text-[11px] font-medium px-2.5 py-1 rounded-lg border border-border focus:outline-none cursor-pointer"
            >
              <option value="6">6 meses</option>
              <option value="12">12 meses</option>
            </select>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={2} barCategoryGap="25%">
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  width={35}
                  tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "10px",
                    fontSize: "12px",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value: number) => [formatBRL(Math.round(value * 100)), ""]}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Bar dataKey="income" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} name={t("income")} />
                <Bar dataKey="expense" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} name={t("expenses")} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Health Score + Goals on desktop */}
        <div className="space-y-4">
          <HealthScoreCard score={healthScore} />
          <GoalsOverview goals={goalsForOverview} />
        </div>
      </div>

      {/* Member Spending */}
      {memberSpending.length > 0 && <MemberSpending members={memberSpending} />}

      {/* Add Transaction Button */}
      <button
        onClick={() => setQuickTxOpen(true)}
        className="w-full bg-primary text-primary-foreground font-semibold text-sm py-3 rounded-full hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
      >
        <Plus className="h-4 w-4" /> {t("firstTransaction")}
      </button>

      {/* Recent Transactions */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">{t("transactions")}</h2>
          <Link
            to="/transactions"
            className="text-xs font-medium text-primary flex items-center gap-0.5 hover:underline"
          >
            {t("quickLinks")} <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        {recentTx.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {t("welcomeSubtitle")}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentTx.map((tx) => (
              <button
                key={tx.id}
                onClick={() => navigate("/transactions")}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
              >
                <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0 text-sm font-medium text-muted-foreground">
                  {getCategoryIcon(tx.category_id)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
                  <p className="text-[11px] text-muted-foreground">{fmt.date(tx.date)}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums shrink-0 text-muted-foreground">
                  {tx.type === "income" ? "+" : "−"} {formatBRL(tx.amount)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <QuickTransactionModal
        open={quickTxOpen}
        onClose={() => setQuickTxOpen(false)}
      />
    </div>
  );
}
