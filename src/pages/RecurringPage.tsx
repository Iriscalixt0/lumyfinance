import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { formatBRL } from "@/lib/utils/currency";
import { Repeat, Plus, ArrowUpCircle, ArrowDownCircle } from "lucide-react";

interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  frequency: string;
  next_date: string;
}

export function RecurringPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<RecurringTransaction[]>([]);
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
        .from("recurring_transactions")
        .select("*")
        .eq("workspace_id", member.workspace_id)
        .order("next_date", { ascending: true });

      setItems(data ?? []);
      setLoading(false);
    }
    load();
  }, [user]);

  const freqLabels: Record<string, string> = {
    daily: "Diário",
    weekly: "Semanal",
    monthly: "Mensal",
    yearly: "Anual",
  };

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
          <h1 className="text-3xl font-bold text-foreground">Recorrentes</h1>
          <p className="text-muted-foreground mt-1">Gerencie receitas e despesas que se repetem</p>
        </div>
        <button className="bg-hero-gradient text-primary-foreground font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity inline-flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nova recorrência
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <Repeat className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma recorrência cadastrada</h3>
          <p className="text-muted-foreground">Adicione transações recorrentes como salário, aluguel ou assinaturas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isIncome = item.type === "income";
            return (
              <div key={item.id} className="bg-card border border-border rounded-xl p-5 flex items-center justify-between hover:shadow-card-hover transition-shadow">
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${isIncome ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
                    {isIncome
                      ? <ArrowUpCircle className="h-5 w-5 text-emerald-500" />
                      : <ArrowDownCircle className="h-5 w-5 text-rose-500" />
                    }
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{item.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {freqLabels[item.frequency] || item.frequency} · Próximo: {new Date(item.next_date).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <p className={`text-lg font-bold ${isIncome ? "text-emerald-500" : "text-rose-500"}`}>
                  {isIncome ? "+" : "-"}{formatBRL(item.amount)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
