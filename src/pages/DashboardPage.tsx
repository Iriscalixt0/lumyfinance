import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { formatBRL } from "@/lib/utils/currency";
import {
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Target,
  Wallet,
} from "lucide-react";

interface DashboardData {
  totalIncome: number;
  totalExpense: number;
  totalInvestments: number;
  goalsCount: number;
  recentTransactions: Array<{
    id: string;
    description: string;
    amount: number;
    type: string;
    date: string;
  }>;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData>({
    totalIncome: 0,
    totalExpense: 0,
    totalInvestments: 0,
    goalsCount: 0,
    recentTransactions: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Get user's workspace
      const { data: members } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user!.id)
        .limit(1)
        .single();

      if (!members) { setLoading(false); return; }
      const wsId = members.workspace_id;

      const [txRes, invRes, goalRes] = await Promise.all([
        supabase.from("transactions").select("id, description, amount, type, date").eq("workspace_id", wsId).order("date", { ascending: false }).limit(10),
        supabase.from("investments").select("amount").eq("workspace_id", wsId),
        supabase.from("goals").select("id").eq("workspace_id", wsId).eq("status", "active"),
      ]);

      const transactions = txRes.data ?? [];
      const totalIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const totalExpense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      const totalInvestments = (invRes.data ?? []).reduce((s, i) => s + i.amount, 0);

      setData({
        totalIncome,
        totalExpense,
        totalInvestments,
        goalsCount: goalRes.data?.length ?? 0,
        recentTransactions: transactions.slice(0, 5),
      });
      setLoading(false);
    }
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const balance = data.totalIncome - data.totalExpense;

  const cards = [
    { label: "Saldo", value: formatBRL(balance), icon: Wallet, color: balance >= 0 ? "text-emerald-500" : "text-rose-500" },
    { label: "Receitas", value: formatBRL(data.totalIncome), icon: ArrowDownLeft, color: "text-emerald-500" },
    { label: "Despesas", value: formatBRL(data.totalExpense), icon: ArrowUpRight, color: "text-rose-500" },
    { label: "Investimentos", value: formatBRL(data.totalInvestments), icon: TrendingUp, color: "text-blue-500" },
  ];

  return (
    <div className="animate-fade space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral das suas finanças</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center">
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{card.label}</p>
            <p className={`text-lg sm:text-xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Goals count */}
      <div className="bg-card rounded-2xl border border-border p-5 shadow-card flex items-center gap-4">
        <div className="h-10 w-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
          <Target className="h-5 w-5 text-pink-500" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Metas ativas</p>
          <p className="text-xl font-bold text-foreground">{data.goalsCount}</p>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-card rounded-2xl border border-border shadow-card">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Transações recentes</h2>
        </div>
        {data.recentTransactions.length === 0 ? (
          <div className="px-5 py-10 text-center text-muted-foreground text-sm">
            Nenhuma transação encontrada. Comece adicionando suas receitas e despesas.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {data.recentTransactions.map((tx) => (
              <div key={tx.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{tx.description}</p>
                  <p className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleDateString("pt-BR")}</p>
                </div>
                <p className={`text-sm font-bold ${tx.type === "income" ? "text-emerald-500" : "text-rose-500"}`}>
                  {tx.type === "income" ? "+" : "-"}{formatBRL(tx.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
