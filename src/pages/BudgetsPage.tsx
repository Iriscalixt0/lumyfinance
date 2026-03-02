import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { formatBRL } from "@/lib/utils/currency";
import { Wallet2, Plus, Pencil, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { z } from "zod";

interface Budget {
  id: string;
  category: string;
  limit_amount: number;
  spent_amount: number;
}

const budgetSchema = z.object({
  category: z.string().trim().min(1, "Categoria obrigatória").max(100),
  limit_amount: z.number().positive("Limite deve ser positivo"),
});

export function BudgetsPage() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const emptyForm = { category: "", limit_amount: "" };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    async function load() {
      const { data: member } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user!.id)
        .limit(1)
        .single();

      if (!member) { setLoading(false); return; }
      setWorkspaceId(member.workspace_id);

      const { data } = await supabase
        .from("budgets")
        .select("*")
        .eq("workspace_id", member.workspace_id);

      setBudgets(data ?? []);
      setLoading(false);
    }
    load();
  }, [user]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(budget: Budget) {
    setEditingId(budget.id);
    setForm({ category: budget.category, limit_amount: String(budget.limit_amount) });
    setErrors({});
    setModalOpen(true);
  }

  function openDelete(id: string) {
    setDeletingId(id);
    setDeleteModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const parsed = budgetSchema.safeParse({
      category: form.category,
      limit_amount: parseFloat(form.limit_amount),
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (!workspaceId) return;
    setSaving(true);

    if (editingId) {
      const { data, error } = await supabase
        .from("budgets")
        .update(parsed.data)
        .eq("id", editingId)
        .select()
        .single();

      setSaving(false);
      if (error) { setErrors({ category: "Erro ao salvar." }); return; }
      setBudgets((prev) => prev.map((b) => (b.id === editingId ? data : b)));
    } else {
      const { data, error } = await supabase
        .from("budgets")
        .insert({ ...parsed.data, spent_amount: 0, workspace_id: workspaceId })
        .select()
        .single();

      setSaving(false);
      if (error) { setErrors({ category: "Erro ao salvar." }); return; }
      setBudgets((prev) => [...prev, data]);
    }

    setForm(emptyForm);
    setEditingId(null);
    setModalOpen(false);
  }

  async function handleDelete() {
    if (!deletingId) return;
    setSaving(true);
    await supabase.from("budgets").delete().eq("id", deletingId);
    setBudgets((prev) => prev.filter((b) => b.id !== deletingId));
    setSaving(false);
    setDeleteModalOpen(false);
    setDeletingId(null);
  }

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
        <button onClick={openCreate} className="bg-hero-gradient text-primary-foreground font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> Novo orçamento
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
              <div key={budget.id} className="bg-card border border-border rounded-xl p-5 space-y-3 group relative">
                <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(budget)} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" aria-label="Editar">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => openDelete(budget.id)} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" aria-label="Excluir">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground">{budget.category}</p>
                  <p className={`text-sm font-bold ${isOver ? "text-rose-500" : "text-emerald-500"}`}>
                    {pct.toFixed(0)}%
                  </p>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${isOver ? "bg-rose-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
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

      {/* Modal de criação/edição */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Editar orçamento" : "Novo orçamento"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Categoria</label>
            <input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex: Alimentação, Transporte, Lazer" className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" maxLength={100} />
            {errors.category && <p className="text-sm text-destructive mt-1">{errors.category}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Limite mensal (R$)</label>
            <input type="number" step="0.01" min="0.01" value={form.limit_amount} onChange={(e) => setForm({ ...form, limit_amount: e.target.value })} placeholder="0,00" className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
            {errors.limit_amount && <p className="text-sm text-destructive mt-1">{errors.limit_amount}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-secondary transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="bg-hero-gradient text-primary-foreground font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Criar orçamento"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Excluir orçamento">
        <p className="text-muted-foreground mb-6">Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita.</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteModalOpen(false)} className="px-5 py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-secondary transition-colors">Cancelar</button>
          <button onClick={handleDelete} disabled={saving} className="px-5 py-2.5 rounded-lg bg-destructive text-destructive-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {saving ? "Excluindo..." : "Excluir"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
