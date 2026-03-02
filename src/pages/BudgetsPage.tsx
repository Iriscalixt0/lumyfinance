import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { formatBRL } from "@/lib/utils/currency";
import { Wallet2, Plus } from "lucide-react";

interface Budget {
  id: string;
  category: string;
  limit_amount: number;
  spent_amount: number;
}

export function BudgetsPage() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: member } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user!.id)
        .limit(1)
        .single();

      if (!member) { setLoading(false); return; }

      const { data } = await supabase
        .from("budgets")
        .select("*")
        .eq("workspace_id", member.workspace_id);

      setBudgets(data ?? []);
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

  return (
    <div className="animate-fade space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Orçamentos</h1>
          <p className="text-muted-foreground mt-1">Defina limites de gasto por categoria</p>
        </div>
        <button className="bg-hero-gradient text-primary-foreground font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity inline-flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Novo orçamento
        </button>
      </div>

      {budgets.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <Wallet2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum orçamento definido</h3>
          <p className="text-muted-foreground">Crie orçamentos para controlar seus gastos por categoria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map((budget) => {
            const pct = budget.limit_amount > 0 ? Math.min((budget.spent_amount / budget.limit_amount) * 100, 100) : 0;
            const isOver = pct >= 90;
            return (
              <div key={budget.id} className="bg-card border border-border rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground">{budget.category}</p>
                  <p className={`text-sm font-bold ${isOver ? "text-rose-500" : "text-emerald-500"}`}>
                    {pct.toFixed(0)}%
                  </p>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isOver ? "bg-rose-500" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Gasto: {formatBRL(budget.spent_amount)}</span>
                  <span>Limite: {formatBRL(budget.limit_amount)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
