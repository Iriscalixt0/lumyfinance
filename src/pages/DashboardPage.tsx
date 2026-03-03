import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useIntlFormat } from "@/hooks/useIntlFormat";
import { useGamification } from "@/hooks/useGamification";
import { StreakCard } from "@/components/gamification/StreakCard";
import { AchievementsPanel } from "@/components/gamification/AchievementsPanel";
import {
  ArrowRight,
  HelpCircle,
  X,
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
} from "lucide-react";

const MONTH_ICONS = [
  Snowflake, Flame, Wind, CloudRain, Flower2, Sun,
  Waves, CloudSun, Leaf, TreePine, Cloudy, Sparkles,
];

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const QUICK_LINKS = [
  { label: "Ver relatório anual", href: "/annual-report", primary: true },
  { label: "Transações", href: "/transactions" },
  { label: "Orçamentos", href: "/budgets" },
  { label: "Cobranças", href: "/billings" },
  { label: "Investimentos", href: "/investments" },
  { label: "Metas", href: "/goals" },
  { label: "Recorrentes", href: "/recurring" },
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
  const formatBRL = fmt.money;
  const { activeWorkspace } = useWorkspace();
  const { streak, unlockedKeys, totalTx, loading: gamLoading } = useGamification(activeWorkspace?.id ?? null);
  const [monthlyData, setMonthlyData] = useState<MonthData[]>(
    Array.from({ length: 12 }, (_, i) => ({ month: i, total: 0 }))
  );
  const [budgets, setBudgets] = useState<BudgetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBanner, setShowBanner] = useState(true);
  const [hasTransactions, setHasTransactions] = useState(false);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade space-y-6">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Dashboard do ano</h1>
        <p className="text-muted-foreground text-base mt-1">
          {activeWorkspace?.name || "Gestão inteligente"} — {currentYear}
        </p>
      </div>

      {showBanner && !hasTransactions && (
        <div className="relative bg-primary/5 border border-primary/20 rounded-2xl p-5 sm:p-6">
          <button
            onClick={() => setShowBanner(false)}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
          <h3 className="text-lg font-semibold text-foreground mb-1">
            Pronto! Agora você pode registrar sua primeira transação
          </h3>
          <p className="text-muted-foreground mb-4">
            Comece adicionando uma receita ou despesa para acompanhar seu fluxo de caixa.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/transactions"
              className="bg-hero-gradient text-primary-foreground font-semibold px-5 py-2.5 rounded-lg text-sm hover:opacity-90 transition-opacity inline-flex items-center gap-2"
            >
              Ir para Transações <ArrowRight className="h-4 w-4" />
            </Link>
            <button className="border border-border bg-card text-foreground font-medium px-5 py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors inline-flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              Ver tour guiado
            </button>
          </div>
        </div>
      )}

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
              <p className="text-sm font-semibold text-foreground mb-1">{MONTH_NAMES[m.month]}</p>
              <p className={`text-base font-bold ${
                isNegative ? "text-rose-500" : isPositive ? "text-emerald-500" : "text-primary"
              }`}>
                {m.total !== 0 && (isNegative ? "-" : "")}{formatBRL(Math.abs(m.total))}
              </p>
            </div>
          );
        })}
      </div>

      {/* Gamification */}
      {!gamLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StreakCard streak={streak} totalTx={totalTx} />
          <AchievementsPanel unlockedKeys={unlockedKeys} />
        </div>
      )}

      {/* Budget progress */}
      {budgets.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet2 className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-foreground text-sm">Orçamentos</h3>
            </div>
            <Link to="/budgets" className="text-xs text-primary hover:underline flex items-center gap-1">
              Ver todos <ArrowRight className="h-3 w-3" />
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
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            to={link.href}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              link.primary
                ? "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
