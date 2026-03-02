import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { formatBRL } from "@/lib/utils/currency";
import { FileBarChart, TrendingUp, TrendingDown, Scale } from "lucide-react";

interface MonthlySummary {
  month: string;
  income: number;
  expense: number;
}

const MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export function AnnualReportPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<MonthlySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    async function load() {
      const { data: member } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user!.id)
        .limit(1)
        .single();

      if (!member) { setLoading(false); return; }

      const { data: transactions } = await supabase
        .from("transactions")
        .select("amount, type, date")
        .eq("workspace_id", member.workspace_id)
        .gte("date", `${currentYear}-01-01`)
        .lte("date", `${currentYear}-12-31`);

      const monthly = Array.from({ length: 12 }, (_, i) => ({
        month: MONTH_NAMES[i],
        income: 0,
        expense: 0,
      }));

      (transactions ?? []).forEach((tx) => {
        const idx = new Date(tx.date).getMonth();
        if (tx.type === "income") monthly[idx].income += tx.amount;
        else monthly[idx].expense += tx.amount;
      });

      setSummary(monthly);
      setLoading(false);
    }
    load();
  }, [user, currentYear]);

  const totalIncome = summary.reduce((s, m) => s + m.income, 0);
  const totalExpense = summary.reduce((s, m) => s + m.expense, 0);
  const balance = totalIncome - totalExpense;

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
        <h1 className="text-3xl font-bold text-foreground">Relatório Anual</h1>
        <p className="text-muted-foreground mt-1">Resumo financeiro de {currentYear}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="text-sm text-muted-foreground">Total Receitas</p>
          </div>
          <p className="text-2xl font-bold text-emerald-500">{formatBRL(totalIncome)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-lg bg-rose-500/10 flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-rose-500" />
            </div>
            <p className="text-sm text-muted-foreground">Total Despesas</p>
          </div>
          <p className="text-2xl font-bold text-rose-500">{formatBRL(totalExpense)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Scale className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Saldo</p>
          </div>
          <p className={`text-2xl font-bold ${balance >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
            {formatBRL(Math.abs(balance))}
          </p>
        </div>
      </div>

      {/* Monthly breakdown */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <FileBarChart className="h-5 w-5 text-primary" />
            Detalhamento mensal
          </h3>
        </div>

        {summary.some((m) => m.income > 0 || m.expense > 0) ? (
          <div className="divide-y divide-border">
            {summary.map((m, i) => {
              const net = m.income - m.expense;
              const maxVal = Math.max(totalIncome, totalExpense) || 1;
              return (
                <div key={i} className="px-5 py-4 flex items-center gap-4">
                  <span className="w-10 text-sm font-semibold text-foreground">{m.month}</span>
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 bg-emerald-500 rounded-full" style={{ width: `${(m.income / maxVal) * 100}%` }} />
                      <span className="text-xs text-emerald-500 font-medium whitespace-nowrap">{formatBRL(m.income)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 bg-rose-500 rounded-full" style={{ width: `${(m.expense / maxVal) * 100}%` }} />
                      <span className="text-xs text-rose-500 font-medium whitespace-nowrap">{formatBRL(m.expense)}</span>
                    </div>
                  </div>
                  <span className={`text-sm font-bold w-24 text-right ${net >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                    {net >= 0 ? "+" : ""}{formatBRL(net)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center">
            <FileBarChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Sem dados para exibir</h3>
            <p className="text-muted-foreground">Registre transações para ver seu relatório anual.</p>
          </div>
        )}
      </div>
    </div>
  );
}
