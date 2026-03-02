import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { formatBRL } from "@/lib/utils/currency";
import { Plus, ArrowDownLeft, ArrowUpRight, Pencil, Trash2, Download } from "lucide-react";
import { downloadCSV } from "@/lib/utils/csv";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { triggerAlertCheck } from "@/lib/triggerAlertCheck";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  date: string;
  category_id: string | null;
  notes: string | null;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  type: string;
}

export function TransactionsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const wsId = activeWorkspace?.id ?? null;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const emptyForm = {
    description: "",
    amount: "",
    type: "expense" as "income" | "expense",
    date: new Date().toISOString().split("T")[0],
    category_id: "",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    async function load() {
      if (!wsId) { setLoading(false); return; }

      const [txRes, catRes] = await Promise.all([
        supabase.from("transactions").select("*").eq("workspace_id", wsId).order("date", { ascending: false }),
        supabase.from("categories").select("id, name, icon, type").eq("workspace_id", wsId),
      ]);

      setTransactions(txRes.data ?? []);
      setCategories(catRes.data ?? []);
      setLoading(false);
    }
    load();
  }, [wsId]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(tx: Transaction) {
    setEditingId(tx.id);
    setForm({
      description: tx.description,
      amount: String(tx.amount / 100),
      type: tx.type === "transfer" ? "expense" : tx.type,
      date: tx.date,
      category_id: tx.category_id || "",
      notes: tx.notes || "",
    });
    setFormError("");
    setModalOpen(true);
  }

  function openDelete(id: string) {
    setDeletingId(id);
    setDeleteModalOpen(true);
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsId) return;
    setFormError("");
    setSaving(true);

    const amountCents = Math.round(parseFloat(form.amount.replace(",", ".")) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      setFormError("Valor inválido.");
      setSaving(false);
      return;
    }

    const payload = {
      description: form.description.trim(),
      amount: amountCents,
      type: form.type,
      date: form.date,
      category_id: form.category_id || null,
      notes: form.notes || null,
    };

    if (!payload.description) {
      setFormError("Descrição obrigatória.");
      setSaving(false);
      return;
    }

    if (editingId) {
      const { error } = await supabase
        .from("transactions")
        .update(payload)
        .eq("id", editingId);

      if (error) { setFormError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("transactions").insert({
        ...payload,
        workspace_id: wsId,
        created_by: user!.id,
      });

      if (error) { setFormError(error.message); setSaving(false); return; }
    }

    // Reload
    const isEdit = !!editingId;
    const { data } = await supabase.from("transactions").select("*").eq("workspace_id", wsId).order("date", { ascending: false });
    setTransactions(data ?? []);
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setSaving(false);
    toast(isEdit ? "Transação atualizada!" : "Transação criada!");
    triggerAlertCheck(wsId);
  };

  async function handleDelete() {
    if (!deletingId || !wsId) return;
    setSaving(true);
    await supabase.from("transactions").delete().eq("id", deletingId);
    setTransactions((prev) => prev.filter((t) => t.id !== deletingId));
    setSaving(false);
    setDeleteModalOpen(false);
    setDeletingId(null);
    toast("Transação excluída!");
  }

  const getCategoryName = (id: string | null) => {
    if (!id) return "";
    const cat = categories.find((c) => c.id === id);
    return cat ? `${cat.icon} ${cat.name}` : "";
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
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Transações</h1>
          <p className="text-muted-foreground text-sm mt-1">Receitas e despesas</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const rows = transactions.map((tx) => [
                tx.description,
                tx.type === "income" ? "Receita" : "Despesa",
                (tx.amount / 100).toFixed(2).replace(".", ","),
                new Date(tx.date).toLocaleDateString("pt-BR"),
                getCategoryName(tx.category_id),
                tx.notes ?? "",
              ]);
              downloadCSV("transacoes.csv", ["Descrição", "Tipo", "Valor", "Data", "Categoria", "Notas"], rows);
            }}
            className="border border-border text-foreground font-medium px-3 py-2.5 rounded-xl text-sm hover:bg-secondary transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" /> CSV
          </button>
          <button onClick={openCreate} className="bg-hero-gradient text-primary-foreground font-semibold px-4 py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nova
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-card rounded-2xl border border-border shadow-card">
        {transactions.length === 0 ? (
          <div className="px-5 py-16 text-center text-muted-foreground text-sm">
            Nenhuma transação ainda. Clique em "Nova" para adicionar.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {transactions.map((tx) => (
              <div key={tx.id} className="px-5 py-3.5 flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${tx.type === "income" ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
                    {tx.type === "income" ? <ArrowDownLeft className="h-4 w-4 text-emerald-500" /> : <ArrowUpRight className="h-4 w-4 text-rose-500" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.date).toLocaleDateString("pt-BR")}
                      {getCategoryName(tx.category_id) && ` · ${getCategoryName(tx.category_id)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className={`text-sm font-bold ${tx.type === "income" ? "text-emerald-500" : "text-rose-500"}`}>
                    {tx.type === "income" ? "+" : "-"}{formatBRL(tx.amount)}
                  </p>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(tx)} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" aria-label="Editar">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => openDelete(tx.id)} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" aria-label="Excluir">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de criação/edição */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Editar transação" : "Nova transação"}>
        <form onSubmit={handleSave} className="space-y-4">
          {formError && <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm">{formError}</div>}

          <div className="flex gap-2">
            {(["expense", "income"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm({ ...form, type: t })}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  form.type === t
                    ? t === "income" ? "bg-emerald-500/10 border-emerald-500 text-emerald-600" : "bg-rose-500/10 border-rose-500 text-rose-600"
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {t === "income" ? "Receita" : "Despesa"}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Descrição</label>
            <input required placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" maxLength={200} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Valor</label>
              <input required placeholder="150,00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Data</label>
              <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Categoria</label>
            <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">
              <option value="">Sem categoria</option>
              {categories.filter(c => c.type === form.type).map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Notas (opcional)</label>
            <input placeholder="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" maxLength={500} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-secondary transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="bg-hero-gradient text-primary-foreground font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Criar transação"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Excluir transação">
        <p className="text-muted-foreground mb-6">Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.</p>
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
