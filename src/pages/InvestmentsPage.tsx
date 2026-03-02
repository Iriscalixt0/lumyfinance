import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { formatBRL } from "@/lib/utils/currency";
import { Plus, TrendingUp, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface Investment {
  id: string;
  name: string;
  type: string;
  amount: number;
  current_value: number | null;
  date: string;
  notes: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  cdb: "CDB",
  lci: "LCI",
  lca: "LCA",
  tesouro: "Tesouro",
  acao: "Ação",
  fii: "FII",
  crypto: "Crypto",
  outro: "Outro",
};

export function InvestmentsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [wsId, setWsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({ name: "", type: "cdb", amount: "", date: new Date().toISOString().split("T")[0] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: member } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user!.id)
        .limit(1)
        .single();

      if (!member) { setLoading(false); return; }
      setWsId(member.workspace_id);

      const { data } = await supabase
        .from("investments")
        .select("*")
        .eq("workspace_id", member.workspace_id)
        .order("date", { ascending: false });

      setInvestments(data ?? []);
      setLoading(false);
    }
    load();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsId) return;
    setSaving(true);

    const amountCents = Math.round(parseFloat(form.amount.replace(",", ".")) * 100);

    await supabase.from("investments").insert({
      workspace_id: wsId,
      name: form.name,
      type: form.type,
      amount: amountCents,
      date: form.date,
      created_by: user!.id,
    });

    const { data } = await supabase.from("investments").select("*").eq("workspace_id", wsId).order("date", { ascending: false });
    setInvestments(data ?? []);
    setShowForm(false);
    setForm({ name: "", type: "cdb", amount: "", date: new Date().toISOString().split("T")[0] });
    setSaving(false);
    toast("Investimento adicionado!");
  };

  const totalInvested = investments.reduce((s, i) => s + i.amount, 0);
  const totalCurrent = investments.reduce((s, i) => s + (i.current_value ?? i.amount), 0);

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
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Investimentos</h1>
          <p className="text-muted-foreground text-sm mt-1">Acompanhe sua carteira</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-hero-gradient text-primary-foreground font-semibold px-4 py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Novo
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total investido</p>
          <p className="text-xl font-bold text-blue-500 mt-1">{formatBRL(totalInvested)}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Valor atual</p>
          <p className={`text-xl font-bold mt-1 ${totalCurrent >= totalInvested ? "text-emerald-500" : "text-rose-500"}`}>
            {formatBRL(totalCurrent)}
          </p>
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-card rounded-2xl border border-border shadow-xl w-full max-w-md p-6">
            <button onClick={() => setShowForm(false)} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold text-foreground mb-4">Novo investimento</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <input
                required
                placeholder="Nome do investimento"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl border border-input bg-secondary/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-xl border border-input bg-secondary/50 px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <input
                required
                placeholder="Valor (ex: 1000,00)"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full rounded-xl border border-input bg-secondary/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full rounded-xl border border-input bg-secondary/50 px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-hero-gradient text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* List */}
      <div className="bg-card rounded-2xl border border-border shadow-card">
        {investments.length === 0 ? (
          <div className="px-5 py-16 text-center text-muted-foreground text-sm">
            <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
            Nenhum investimento cadastrado.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {investments.map((inv) => (
              <div key={inv.id} className="px-5 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{inv.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {TYPE_LABELS[inv.type] ?? inv.type} · {new Date(inv.date).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-blue-500">{formatBRL(inv.amount)}</p>
                  {inv.current_value != null && inv.current_value !== inv.amount && (
                    <p className={`text-xs font-medium ${inv.current_value > inv.amount ? "text-emerald-500" : "text-rose-500"}`}>
                      Atual: {formatBRL(inv.current_value)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
