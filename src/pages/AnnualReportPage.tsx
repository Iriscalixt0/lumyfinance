import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { formatBRL } from "@/lib/utils/currency";
import { FileBarChart, TrendingUp, TrendingDown, Scale, BarChart3, PieChart as PieIcon } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area,
  PieChart, Pie, Cell,
} from "recharts";

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

  const CHART_COLORS = { income: "#10b981", expense: "#f43f5e", balance: "hsl(160, 45%, 35%)" };

  const pieData = [
    { name: "Receitas", value: totalIncome },
    { name: "Despesas", value: totalExpense },
  ];
  const PIE_COLORS = [CHART_COLORS.income, CHART_COLORS.expense];

  const balanceData = summary.map((m) => ({
    ...m,
    balance: m.income - m.expense,
  }));

  const customTooltipFormatter = (value: number) => formatBRL(value);

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

      {/* Charts */}
      {summary.some((m) => m.income > 0 || m.expense > 0) && (
        <>
          {/* Bar chart - Receitas vs Despesas */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
              <BarChart3 className="h-5 w-5 text-primary" />
              Receitas vs Despesas por mês
            </h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={summary} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(220, 9%, 46%)" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(220, 9%, 46%)" tickFormatter={(v) => formatBRL(v)} />
                <Tooltip formatter={customTooltipFormatter} />
                <Legend />
                <Bar dataKey="income" name="Receitas" fill={CHART_COLORS.income} radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Despesas" fill={CHART_COLORS.expense} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Area chart - Saldo acumulado */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                <Scale className="h-5 w-5 text-primary" />
                Evolução do saldo mensal
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={balanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(220, 9%, 46%)" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(220, 9%, 46%)" tickFormatter={(v) => formatBRL(v)} />
                  <Tooltip formatter={customTooltipFormatter} />
                  <Area type="monotone" dataKey="balance" name="Saldo" stroke={CHART_COLORS.balance} fill={CHART_COLORS.balance} fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Pie chart - Proporção */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                <PieIcon className="h-5 w-5 text-primary" />
                Proporção receitas / despesas
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={customTooltipFormatter} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

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
