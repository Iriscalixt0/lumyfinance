import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { formatBRL } from "@/lib/utils/currency";
import { Receipt, Plus, Calendar, AlertCircle, CheckCircle2, Clock } from "lucide-react";

interface Billing {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  status: "pending" | "paid" | "overdue";
}

export function BillingsPage() {
  const { user } = useAuth();
  const [billings, setBillings] = useState<Billing[]>([]);
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
        .from("billings")
        .select("*")
        .eq("workspace_id", member.workspace_id)
        .order("due_date", { ascending: true });

      setBillings(data ?? []);
      setLoading(false);
    }
    load();
  }, [user]);

  const statusConfig = {
    pending: { label: "Pendente", icon: Clock, className: "text-amber-500 bg-amber-500/10" },
    paid: { label: "Pago", icon: CheckCircle2, className: "text-emerald-500 bg-emerald-500/10" },
    overdue: { label: "Atrasado", icon: AlertCircle, className: "text-rose-500 bg-rose-500/10" },
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
          <h1 className="text-3xl font-bold text-foreground">Cobranças</h1>
          <p className="text-muted-foreground mt-1">Gerencie suas contas a pagar e receber</p>
        </div>
        <button className="bg-hero-gradient text-primary-foreground font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity inline-flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nova cobrança
        </button>
      </div>

      {billings.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma cobrança cadastrada</h3>
          <p className="text-muted-foreground">Adicione suas contas a pagar para não perder nenhum vencimento.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {billings.map((billing) => {
            const status = statusConfig[billing.status] || statusConfig.pending;
            const StatusIcon = status.icon;
            return (
              <div key={billing.id} className="bg-card border border-border rounded-xl p-5 flex items-center justify-between hover:shadow-card-hover transition-shadow">
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${status.className}`}>
                    <StatusIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{billing.description}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Vence em {new Date(billing.due_date).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <p className="text-lg font-bold text-foreground">{formatBRL(billing.amount)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
