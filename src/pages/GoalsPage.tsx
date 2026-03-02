import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { formatBRL } from "@/lib/utils/currency";
import { Plus, Target, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface Goal {
  id: string;
  title: string;
  target_amount: number;
  icon: string;
  color: string;
  status: string;
  deadline: string | null;
  contributions_total: number;
}

export function GoalsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const wsId = activeWorkspace?.id ?? null;
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({ title: "", target_amount: "", deadline: "", icon: "🎯" });
  const [saving, setSaving] = useState(false);

  async function loadGoals(workspaceId: string) {
    const { data: goalsData } = await supabase
      .from("goals")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    const goalsWithContribs = await Promise.all(
      (goalsData ?? []).map(async (g) => {
        const { data: contribs } = await supabase
          .from("goal_contributions")
          .select("amount")
          .eq("goal_id", g.id);
        const total = (contribs ?? []).reduce((s, c) => s + c.amount, 0);
        return { ...g, contributions_total: total };
      })
    );

    setGoals(goalsWithContribs);
  }

  useEffect(() => {
    async function load() {
      if (!wsId) { setLoading(false); return; }
      await loadGoals(wsId);
      setLoading(false);
    }
    load();
  }, [wsId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsId) return;
    setSaving(true);

    const targetCents = Math.round(parseFloat(form.target_amount.replace(",", ".")) * 100);

    await supabase.from("goals").insert({
      workspace_id: wsId,
      title: form.title,
      target_amount: targetCents,
      deadline: form.deadline || null,
      icon: form.icon,
      created_by: user!.id,
    });

    await loadGoals(wsId);
    setShowForm(false);
    setForm({ title: "", target_amount: "", deadline: "", icon: "🎯" });
    setSaving(false);
    toast("Meta criada!");
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
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Metas</h1>
          <p className="text-muted-foreground text-sm mt-1">Acompanhe seus objetivos financeiros</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-hero-gradient text-primary-foreground font-semibold px-4 py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Nova meta
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-card rounded-2xl border border-border shadow-xl w-full max-w-md p-6">
            <button onClick={() => setShowForm(false)} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold text-foreground mb-4">Nova meta</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <input
                required
                placeholder="Nome da meta"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded-xl border border-input bg-secondary/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
              <input
                required
                placeholder="Valor alvo (ex: 5000,00)"
                value={form.target_amount}
                onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
                className="w-full rounded-xl border border-input bg-secondary/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className="w-full rounded-xl border border-input bg-secondary/50 px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-hero-gradient text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Criar meta"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Goals grid */}
      {goals.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-16 text-center text-muted-foreground text-sm">
          <Target className="h-10 w-10 mx-auto mb-3 opacity-30" />
          Nenhuma meta criada ainda.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map((goal) => {
            const progress = goal.target_amount > 0 ? Math.min((goal.contributions_total / goal.target_amount) * 100, 100) : 0;
            return (
              <div key={goal.id} className="bg-card rounded-2xl border border-border p-5 shadow-card">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{goal.icon}</span>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">{goal.title}</h3>
                    {goal.deadline && (
                      <p className="text-xs text-muted-foreground">
                        Prazo: {new Date(goal.deadline).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mb-2">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{formatBRL(goal.contributions_total)}</span>
                    <span>{formatBRL(goal.target_amount)}</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-hero-gradient rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-right">{progress.toFixed(0)}%</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
