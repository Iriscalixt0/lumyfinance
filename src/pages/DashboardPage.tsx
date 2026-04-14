import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { useIntlFormat } from "@/hooks/useIntlFormat";
import { useGamification } from "@/hooks/useGamification";
import { useTranslations } from "@/lib/i18n";
import { QuickTransactionModal } from "@/components/transactions/QuickTransactionModal";
import { SafeToSpendCard } from "@/components/dashboard/SafeToSpendCard";
import { GamificationBar } from "@/components/dashboard/GamificationBar";
import { DependentSpendingChart } from "@/components/dashboard/DependentSpendingChart";
import { BudgetsCard } from "@/components/dashboard/BudgetsCard";
import { MemberSpending } from "@/components/dashboard/MemberSpending";
import {
  Plus,
  Sparkles,
  PenLine,
  Bookmark,
  Users,
  CheckCircle2,
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

    return { totalIncome, totalExpenses, currentMonthExpenses, currentMonthIncome };
  }, [transactions, currentMonth]);

  const safeToSpend = metrics.currentMonthIncome - metrics.currentMonthExpenses;

  // Chart data for dependent spending
  const chartData = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const m = currentMonth - i;
      const month = ((m % 12) + 12) % 12;
      const monthTx = transactions.filter(tx => new Date(tx.date).getMonth() === month);
      const income = monthTx.filter(tx => tx.type === "income").reduce((s, tx) => s + tx.amount, 0);
      const expense = monthTx.filter(tx => tx.type === "expense").reduce((s, tx) => s + tx.amount, 0);
      data.push({ name: MONTH_SHORT[month], income: income / 100, expense: expense / 100 });
    }
    return data;
  }, [transactions, currentMonth, MONTH_SHORT]);

  // Member spending
  const memberSpending = useMemo(() => {
    if (!hasTransactions) return [];
    if (metrics.currentMonthExpenses <= 0) return [];
    return [
      { name: userName, avatar: undefined, spent: metrics.currentMonthExpenses, percentage: 100 },
    ];
  }, [hasTransactions, metrics, userName]);

  // Budget members mock
  const budgetMembers = useMemo(() => [
    { name: "Ludmila", percentage: 11.1, color: "#22c55e" },
    { name: "Gabriella", percentage: 88.7, color: "#3b82f6" },
  ], []);

  /* ---------- Skeleton Loader ---------- */
  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 animate-fade space-y-4">
        <div className="h-7 w-48 bg-white/10 rounded-lg animate-pulse" />
        <div className="h-44 bg-white/5 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-52 bg-white/5 rounded-2xl animate-pulse" />
          <div className="h-52 bg-white/5 rounded-2xl animate-pulse" />
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
      <div className="min-h-screen bg-background p-4 sm:p-6 animate-fade space-y-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">
          {greeting}, {userName} 👋
        </h1>

        <SafeToSpendCard amount={formatBRL(0)} />

        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 sm:p-8">
          <div className="text-center mb-8">
            <div className="h-14 w-14 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{t("quickStartTitle")}</h2>
            <p className="text-white/50 text-sm max-w-md mx-auto">{t("quickStartSubtitle")}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
            {steps.map((step) => (
              <Link
                key={step.num}
                to={step.href}
                className={`relative flex flex-col items-center text-center p-5 rounded-xl border transition-all hover:shadow-md group ${
                  step.done
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-white/10 hover:border-primary/30 bg-white/5"
                }`}
              >
                {step.done && <CheckCircle2 className="absolute top-3 right-3 h-4 w-4 text-emerald-500" />}
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center mb-3 transition-colors ${
                  step.done ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/20 text-primary"
                }`}>
                  <step.icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">
                  {t("step")} {step.num}
                </span>
                <h3 className="text-sm font-bold text-white mb-1">{t(step.titleKey)}</h3>
                <p className="text-xs text-white/50 leading-relaxed">{t(step.descKey)}</p>
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

  /* ---------- Normal Dashboard — Dark Green Premium ---------- */
  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 animate-fade space-y-4">
      {/* Greeting */}
      <h1 className="text-xl sm:text-2xl font-bold text-white">
        {greeting}, {userName} 👋
      </h1>

      {/* Main layout: left (safe-to-spend + member) / right (chart + budgets) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left column — 3/5 */}
        <div className="lg:col-span-3 space-y-4">
          <SafeToSpendCard amount={formatBRL(safeToSpend)} />

          {/* Member Spending */}
          {memberSpending.length > 0 && <MemberSpending members={memberSpending} />}
        </div>

        {/* Right column — 2/5 */}
        <div className="lg:col-span-2 space-y-4">
          <DependentSpendingChart data={chartData} formatMoney={formatBRL} />
          <BudgetsCard members={budgetMembers} />
        </div>
      </div>

      {/* Add Transaction Button */}
      <button
        onClick={() => setQuickTxOpen(true)}
        className="w-full bg-primary text-primary-foreground font-semibold text-sm py-3 rounded-full hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
      >
        <Plus className="h-4 w-4" /> {t("firstTransaction")}
      </button>

      <QuickTransactionModal
        open={quickTxOpen}
        onClose={() => setQuickTxOpen(false)}
      />
    </div>
  );
}
