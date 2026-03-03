import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { formatBRL } from "@/lib/utils/currency";
import { Plus, Target, Calendar } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { triggerAlertCheck } from "@/lib/triggerAlertCheck";

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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [createForm, setCreateForm] = useState({ title: "", target_amount: "", deadline: "", icon: "🎯" });

  // Contribute form
  const [contribForm, setContribForm] = useState({
    date: new Date().toISOString().split("T")[0],
    goal_id: "",
    amount: "",
  });
  const [contribSaving, setContribSaving] = useState(false);

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsId) return;
    setSaving(true);

    const targetCents = Math.round(parseFloat(createForm.target_amount.replace(",", ".")) * 100);

    await supabase.from("goals").insert({
      workspace_id: wsId,
      title: createForm.title,
      target_amount: targetCents,
      deadline: createForm.deadline || null,
      icon: createForm.icon,
      created_by: user!.id,
    });

    await loadGoals(wsId);
    setShowCreateModal(false);
    setCreateForm({ title: "", target_amount: "", deadline: "", icon: "🎯" });
    setSaving(false);
    toast("Meta criada!");
    triggerAlertCheck(wsId);
  };

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsId || !contribForm.goal_id) return;
    setContribSaving(true);

    const amountCents = Math.round(parseFloat(contribForm.amount.replace(",", ".")) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      setContribSaving(false);
      return;
    }

    await supabase.from("goal_contributions").insert({
      goal_id: contribForm.goal_id,
      amount: amountCents,
      date: contribForm.date,
      created_by: user!.id,
    });

    await loadGoals(wsId);
    setContribForm({ date: new Date().toISOString().split("T")[0], goal_id: "", amount: "" });
    setContribSaving(false);
    toast("Contribuição registrada!");
    triggerAlertCheck(wsId);
  };

  // Summary
  const totalAccumulated = goals.reduce((s, g) => s + g.contributions_total, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target_amount, 0);
  const avgProgress = totalTarget > 0 ? (totalAccumulated / totalTarget) * 100 : 0;
  const activeCount = goals.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Metas e Objetivos</h1>
        <p className="text-sm text-muted-foreground mt-1">Planeje e acompanhe a evolução das suas poupanças.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-1">Total acumulado</p>
          <p className="text-2xl font-bold text-foreground">{formatBRL(totalAccumulated)}</p>
          <div className="h-1 bg-muted rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(avgProgress, 100)}%` }} />
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Objetivo total</p>
          <p className="text-2xl font-bold text-foreground">{formatBRL(totalTarget)}</p>
          <p className="text-xs text-muted-foreground mt-3">Somatório de todos os objetivos</p>
        </div>
        <div className="bg-primary text-primary-foreground rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider mb-1 opacity-80">Progresso médio</p>
          <p className="text-2xl font-bold">{avgProgress.toFixed(1)}% alcançado</p>
          <p className="text-xs mt-3 opacity-80">Continue focado nos seus sonhos!</p>
        </div>
      </div>

      {/* Create button */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity inline-flex items-center gap-2 text-sm"
      >
        <Plus className="h-4 w-4" /> Criar metas
      </button>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Contribute form */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-semibold text-foreground mb-5">Poupar para meta</h3>
          <form onSubmit={handleContribute} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Data</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="date"
                  value={contribForm.date}
                  onChange={(e) => setContribForm({ ...contribForm, date: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Meta</label>
              <select
                value={contribForm.goal_id}
                onChange={(e) => setContribForm({ ...contribForm, goal_id: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Selecione a meta</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>{g.icon} {g.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Valor</label>
              <input
                type="text"
                value={contribForm.amount}
                onChange={(e) => setContribForm({ ...contribForm, amount: e.target.value })}
                placeholder="0,00"
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <button
              type="submit"
              disabled={contribSaving || !contribForm.goal_id}
              className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
            >
              {contribSaving ? "Salvando..." : "Poupar p/ meta"}
            </button>
          </form>
        </div>

        {/* Right: Goals list */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Minhas metas</h3>
            <span className="text-xs text-muted-foreground">{activeCount} ativas</span>
          </div>

          {goals.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Target className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">
                Ainda não tem metas definidas.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {goals.map((goal) => {
                const progress = goal.target_amount > 0 ? Math.min((goal.contributions_total / goal.target_amount) * 100, 100) : 0;
                return (
                  <div key={goal.id} className="px-6 py-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{goal.icon}</span>
                        <div>
                          <p className="text-sm font-medium text-foreground">{goal.title}</p>
                          {goal.deadline && (
                            <p className="text-[10px] text-muted-foreground">
                              Prazo: {new Date(goal.deadline).toLocaleDateString("pt-BR")}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-bold text-primary">{progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden mb-1.5">
                      <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatBRL(goal.contributions_total)}</span>
                      <span>{formatBRL(goal.target_amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Criar meta">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nome da meta</label>
            <input
              required
              placeholder="Ex: Viagem, Carro, Reserva"
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              maxLength={100}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Valor alvo (R$)</label>
            <input
              required
              placeholder="5000,00"
              value={createForm.target_amount}
              onChange={(e) => setCreateForm({ ...createForm, target_amount: e.target.value })}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Prazo (opcional)</label>
            <input
              type="date"
              value={createForm.deadline}
              onChange={(e) => setCreateForm({ ...createForm, deadline: e.target.value })}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-secondary transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? "Salvando..." : "Criar meta"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
