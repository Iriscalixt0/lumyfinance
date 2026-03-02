import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { formatBRL } from "@/lib/utils/currency";
import { Repeat, Plus, ArrowUpCircle, ArrowDownCircle, Pencil, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { z } from "zod";
import { useToast } from "@/components/ui/Toast";

interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  frequency: string;
  next_date: string;
}

const recurringSchema = z.object({
  description: z.string().trim().min(1, "Descrição obrigatória").max(200),
  amount: z.number().positive("Valor deve ser positivo"),
  type: z.enum(["income", "expense"]),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  next_date: z.string().min(1, "Data obrigatória"),
});

export function RecurringPage() {
  const { toast } = useToast();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? null;
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const emptyForm = {
    description: "",
    amount: "",
    type: "expense" as "income" | "expense",
    frequency: "monthly" as "daily" | "weekly" | "monthly" | "yearly",
    next_date: "",
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    async function load() {
      if (!workspaceId) { setLoading(false); return; }

      const { data } = await supabase
        .from("recurring_transactions")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("next_date", { ascending: true });

      setItems(data ?? []);
      setLoading(false);
    }
    load();
  }, [workspaceId]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(item: RecurringTransaction) {
    setEditingId(item.id);
    setForm({
      description: item.description,
      amount: String(item.amount),
      type: item.type,
      frequency: item.frequency as typeof emptyForm.frequency,
      next_date: item.next_date,
    });
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

    const parsed = recurringSchema.safeParse({
      description: form.description,
      amount: parseFloat(form.amount),
      type: form.type,
      frequency: form.frequency,
      next_date: form.next_date,
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
        .from("recurring_transactions")
        .update(parsed.data)
        .eq("id", editingId)
        .select()
        .single();

      setSaving(false);
      if (error) { setErrors({ description: "Erro ao salvar." }); return; }
      setItems((prev) => prev.map((i) => (i.id === editingId ? data : i)));
    } else {
      const { data, error } = await supabase
        .from("recurring_transactions")
        .insert({ ...parsed.data, workspace_id: workspaceId })
        .select()
        .single();

      setSaving(false);
      if (error) { setErrors({ description: "Erro ao salvar." }); return; }
      setItems((prev) => [...prev, data]);
    }

    setForm(emptyForm);
    setEditingId(null);
    setModalOpen(false);
    toast(editingId ? "Recorrência atualizada!" : "Recorrência criada!");
  }

  async function handleDelete() {
    if (!deletingId) return;
    setSaving(true);
    await supabase.from("recurring_transactions").delete().eq("id", deletingId);
    setItems((prev) => prev.filter((i) => i.id !== deletingId));
    setSaving(false);
    setDeleteModalOpen(false);
    setDeletingId(null);
    toast("Recorrência excluída!");
  }

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
        <button onClick={openCreate} className="bg-hero-gradient text-primary-foreground font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> Nova recorrência
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
              <div key={item.id} className="bg-card border border-border rounded-xl p-5 flex items-center justify-between hover:shadow-card-hover transition-shadow group">
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
                <div className="flex items-center gap-3">
                  <p className={`text-lg font-bold ${isIncome ? "text-emerald-500" : "text-rose-500"}`}>
                    {isIncome ? "+" : "-"}{formatBRL(item.amount)}
                  </p>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(item)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => openDelete(item.id)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" aria-label="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de criação/edição */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Editar recorrência" : "Nova recorrência"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Descrição</label>
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: Aluguel, Netflix, Salário" className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" maxLength={200} />
            {errors.description && <p className="text-sm text-destructive mt-1">{errors.description}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Valor (R$)</label>
              <input type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
              {errors.amount && <p className="text-sm text-destructive mt-1">{errors.amount}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Tipo</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "income" | "expense" })} className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Frequência</label>
              <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as typeof emptyForm.frequency })} className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
                <option value="yearly">Anual</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Próxima data</label>
              <input type="date" value={form.next_date} onChange={(e) => setForm({ ...form, next_date: e.target.value })} className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
              {errors.next_date && <p className="text-sm text-destructive mt-1">{errors.next_date}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-secondary transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="bg-hero-gradient text-primary-foreground font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Criar recorrência"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Excluir recorrência">
        <p className="text-muted-foreground mb-6">Tem certeza que deseja excluir esta recorrência? Esta ação não pode ser desfeita.</p>
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
