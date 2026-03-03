import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useIntlFormat } from "@/hooks/useIntlFormat";
import { usePermissions } from "@/hooks/usePermissions";
import { Repeat, Pencil, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { z } from "zod";
import { useToast } from "@/components/ui/Toast";
import { PermissionBanner } from "@/components/ui/PermissionBanner";

interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string | null;
  frequency: string;
  next_date: string;
  end_date: string | null;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  type: string;
}

const recurringSchema = z.object({
  description: z.string().trim().min(1, "Descrição obrigatória").max(200),
  amount: z.number().positive("Valor deve ser positivo"),
  type: z.enum(["income", "expense"]),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  next_date: z.string().min(1, "Data obrigatória"),
  end_date: z.string().nullable(),
  category: z.string().nullable(),
});

const freqLabels: Record<string, string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
  yearly: "Anual",
};

export function RecurringPage() {
  const fmt = useIntlFormat();
  const formatBRL = fmt.money;
  const { toast } = useToast();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? null;
  const permissions = usePermissions();
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const emptyForm = {
    description: "",
    amount: "",
    type: "expense" as "income" | "expense",
    category: "",
    frequency: "monthly" as "daily" | "weekly" | "monthly" | "yearly",
    next_date: new Date().toISOString().split("T")[0],
    end_date: "",
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    async function load() {
      if (!workspaceId) { setLoading(false); return; }

      const [recRes, catRes] = await Promise.all([
        supabase
          .from("recurring_transactions")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("next_date", { ascending: true }),
        supabase
          .from("categories")
          .select("id, name, icon, type")
          .eq("workspace_id", workspaceId),
      ]);

      setItems(recRes.data ?? []);
      setCategories(catRes.data ?? []);
      setLoading(false);
    }
    load();
  }, [workspaceId]);

  function openEdit(item: RecurringTransaction) {
    setEditingId(item.id);
    setForm({
      description: item.description,
      amount: String(item.amount),
      type: item.type,
      category: item.category || "",
      frequency: item.frequency as typeof emptyForm.frequency,
      next_date: item.next_date,
      end_date: item.end_date || "",
    });
    setErrors({});
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
      amount: parseFloat(form.amount.replace(",", ".")),
      type: form.type,
      frequency: form.frequency,
      next_date: form.next_date,
      end_date: form.end_date || null,
      category: form.category || null,
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
      setEditingId(null);
      toast("Recorrência atualizada!");
    } else {
      const { data, error } = await supabase
        .from("recurring_transactions")
        .insert({ ...parsed.data, workspace_id: workspaceId })
        .select()
        .single();

      setSaving(false);
      if (error) { setErrors({ description: "Erro ao salvar." }); return; }
      setItems((prev) => [...prev, data]);
      toast("Recorrência criada!");
    }

    setForm(emptyForm);
    setErrors({});
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

  const activeCount = items.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade space-y-6">
      {!permissions.canEdit && <PermissionBanner reason={permissions.reason} hasPlan={permissions.hasPlan} isViewer={permissions.isViewer} />}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Transações recorrentes</h1>
        <p className="text-sm text-muted-foreground mt-1">Despesas e receitas que se repetem automaticamente.</p>
      </div>

      {/* Two-column layout: Form + List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Form inline */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-semibold text-foreground mb-5">
            {editingId ? "Editar recorrente" : "Nova recorrente"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Tipo</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as "income" | "expense" })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Categoria</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Opcional</option>
                {categories.filter((c) => c.type === form.type).map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Descrição</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ex: Aluguel"
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                maxLength={200}
              />
              {errors.description && <p className="text-xs text-destructive mt-1">{errors.description}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Valor</label>
              <input
                type="text"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0,00"
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Frequência</label>
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value as typeof emptyForm.frequency })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
                <option value="yearly">Anual</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Data início</label>
              <input
                type="date"
                value={form.next_date}
                onChange={(e) => setForm({ ...form, next_date: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {errors.next_date && <p className="text-xs text-destructive mt-1">{errors.next_date}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Data fim (Opcional)</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex gap-2 pt-1">
              {editingId && (
                <button
                  type="button"
                  onClick={() => { setEditingId(null); setForm(emptyForm); setErrors({}); }}
                  className="flex-1 py-2.5 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-secondary transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={saving || !permissions.canEdit}
                className="flex-1 bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
              >
                {saving ? "Salvando..." : editingId ? "Salvar" : "Adicionar"}
              </button>
            </div>
          </form>
        </div>

        {/* Right: List */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Minhas recorrentes</h3>
            <span className="text-xs text-muted-foreground">{activeCount} ativas</span>
          </div>

          {items.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Repeat className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">
                Nenhuma transação recorrente. Adicione aluguel, salário, etc.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => {
                const isIncome = item.type === "income";
                return (
                  <div key={item.id} className="px-6 py-4 flex items-center justify-between group hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {freqLabels[item.frequency] || item.frequency} · {fmt.date(item.next_date)}
                        {item.end_date && ` → ${fmt.date(item.end_date)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className={`text-sm font-bold ${isIncome ? "text-emerald-500" : "text-rose-500"}`}>
                        {isIncome ? "+" : "-"}{formatBRL(item.amount)}
                      </p>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(item)} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" aria-label="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => openDelete(item.id)} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" aria-label="Excluir">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

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
