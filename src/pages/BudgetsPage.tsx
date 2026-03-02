import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { formatBRL } from "@/lib/utils/currency";
import { Wallet2, Pencil, Trash2, ChevronDown } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { z } from "zod";
import { useToast } from "@/components/ui/Toast";
import { triggerAlertCheck } from "@/lib/triggerAlertCheck";

interface Budget {
  id: string;
  category: string;
  limit_amount: number;
  spent_amount: number;
  month?: number;
  year?: number;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  type: string;
}

const budgetSchema = z.object({
  category: z.string().trim().min(1, "Categoria obrigatória").max(100),
  limit_amount: z.number().positive("Limite deve ser positivo"),
});

const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export function BudgetsPage() {
  const { toast } = useToast();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? null;
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  const emptyForm = { category: "", limit_amount: "" };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    async function load() {
      if (!workspaceId) { setLoading(false); return; }

      const [budgetRes, catRes] = await Promise.all([
        supabase.from("budgets").select("*").eq("workspace_id", workspaceId),
        supabase.from("categories").select("id, name, icon, type").eq("workspace_id", workspaceId),
      ]);

      setBudgets(budgetRes.data ?? []);
      setCategories(catRes.data ?? []);
      setLoading(false);
    }
    load();
  }, [workspaceId]);

  function openEdit(budget: Budget) {
    setEditingId(budget.id);
    setForm({ category: budget.category, limit_amount: String(budget.limit_amount) });
    setErrors({});
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
      limit_amount: parseFloat(form.limit_amount.replace(",", ".")),
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
      setEditingId(null);
      toast("Orçamento atualizado!");
    } else {
      const { data, error } = await supabase
        .from("budgets")
        .insert({ ...parsed.data, spent_amount: 0, workspace_id: workspaceId })
        .select()
        .single();

      setSaving(false);
      if (error) { setErrors({ category: "Erro ao salvar." }); return; }
      setBudgets((prev) => [...prev, data]);
      toast("Orçamento criado!");
    }

    setForm(emptyForm);
    setErrors({});
    if (workspaceId) triggerAlertCheck(workspaceId);
  }

  async function handleDelete() {
    if (!deletingId) return;
    setSaving(true);
    await supabase.from("budgets").delete().eq("id", deletingId);
    setBudgets((prev) => prev.filter((b) => b.id !== deletingId));
    setSaving(false);
    setDeleteModalOpen(false);
    setDeletingId(null);
    toast("Orçamento excluído!");
  }

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const activeCount = budgets.length;
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i + 1);

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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orçamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">Defina limites por categoria e acompanhe seus gastos.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Month picker */}
          <div className="relative">
            <button
              onClick={() => { setShowMonthPicker(!showMonthPicker); setShowYearPicker(false); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-card border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition"
            >
              <span className="text-xs text-muted-foreground">Mês</span>
              {MONTH_NAMES[selectedMonth]}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            {showMonthPicker && (
              <div className="absolute right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 py-1 w-40">
                {MONTH_NAMES.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => { setSelectedMonth(i); setShowMonthPicker(false); }}
                    className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition ${i === selectedMonth ? "font-bold text-primary" : "text-foreground"}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Year picker */}
          <div className="relative">
            <button
              onClick={() => { setShowYearPicker(!showYearPicker); setShowMonthPicker(false); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-card border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition"
            >
              <span className="text-xs text-muted-foreground">Ano</span>
              {selectedYear}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            {showYearPicker && (
              <div className="absolute right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 py-1">
                {years.map((y) => (
                  <button
                    key={y}
                    onClick={() => { setSelectedYear(y); setShowYearPicker(false); }}
                    className={`block w-full text-left px-4 py-1.5 text-sm hover:bg-muted transition ${y === selectedYear ? "font-bold text-primary" : "text-foreground"}`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Form inline */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-semibold text-foreground mb-5">
            {editingId ? "Editar orçamento" : "Novo orçamento"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Categoria</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Selecione uma categoria</option>
                {expenseCategories.length > 0
                  ? expenseCategories.map((c) => (
                      <option key={c.id} value={c.name}>{c.icon} {c.name}</option>
                    ))
                  : (
                    <>
                      <option value="Alimentação">Alimentação</option>
                      <option value="Transporte">Transporte</option>
                      <option value="Moradia">Moradia</option>
                      <option value="Lazer">Lazer</option>
                      <option value="Saúde">Saúde</option>
                      <option value="Educação">Educação</option>
                      <option value="Outros">Outros</option>
                    </>
                  )
                }
              </select>
              {errors.category && <p className="text-xs text-destructive mt-1">{errors.category}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Limite (R$)</label>
              <input
                type="text"
                value={form.limit_amount}
                onChange={(e) => setForm({ ...form, limit_amount: e.target.value })}
                placeholder="0,00"
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {errors.limit_amount && <p className="text-xs text-destructive mt-1">{errors.limit_amount}</p>}
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
                disabled={saving}
                className="flex-1 bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
              >
                {saving ? "Salvando..." : editingId ? "Salvar" : "Adicionar orçamento"}
              </button>
            </div>
          </form>
        </div>

        {/* Right: List */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-foreground">
              Orçamentos de {MONTH_NAMES[selectedMonth]} de {selectedYear}
            </h3>
            <span className="text-xs text-muted-foreground">{activeCount} ativos</span>
          </div>

          {budgets.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Wallet2 className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">
                Nenhum orçamento definido. Adicione um limite para uma categoria de despesa.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {budgets.map((budget) => {
                const pct = budget.limit_amount > 0 ? Math.min((budget.spent_amount / budget.limit_amount) * 100, 100) : 0;
                const isOver = pct >= 90;
                return (
                  <div key={budget.id} className="px-6 py-4 group hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-foreground">{budget.category}</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${isOver ? "text-rose-500" : "text-emerald-500"}`}>
                          {pct.toFixed(0)}%
                        </span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(budget)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" aria-label="Editar">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button onClick={() => openDelete(budget.id)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" aria-label="Excluir">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden mb-1.5">
                      <div className={`h-full rounded-full transition-all ${isOver ? "bg-rose-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Gasto: {formatBRL(budget.spent_amount)}</span>
                      <span>Limite: {formatBRL(budget.limit_amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

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
