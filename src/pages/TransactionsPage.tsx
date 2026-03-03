import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { formatBRL } from "@/lib/utils/currency";
import {
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Pencil,
  Trash2,
  Download,
  Calendar,
  Copy,
  Receipt,
  TrendingUp,
  TrendingDown,
  Target,
  Wallet2,
  Mic,
} from "lucide-react";
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

const MONTH_NAMES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

export function TransactionsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const wsId = activeWorkspace?.id ?? null;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Month/year selectors
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [filterCategoryId, setFilterCategoryId] = useState("");

  const emptyForm = {
    description: "",
    amount: "",
    type: "expense" as "income" | "expense",
    date: now.toISOString().split("T")[0],
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

  // Filter by month/year
  const monthFiltered = useMemo(() => {
    return transactions.filter((tx) => {
      const d = new Date(tx.date);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [transactions, selectedMonth, selectedYear]);

  const filtered = useMemo(() => {
    if (!filterCategoryId) return monthFiltered;
    return monthFiltered.filter((tx) => tx.category_id === filterCategoryId);
  }, [monthFiltered, filterCategoryId]);

  // Summary
  const totalIncome = useMemo(() => monthFiltered.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0), [monthFiltered]);
  const totalExpense = useMemo(() => monthFiltered.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0), [monthFiltered]);
  const balance = totalIncome - totalExpense;

  const getCategoryName = (id: string | null) => {
    if (!id) return "";
    const cat = categories.find((c) => c.id === id);
    return cat ? `${cat.icon} ${cat.name}` : "";
  };

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
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
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
      const { error } = await supabase.from("transactions").update(payload).eq("id", editingId);
      if (error) { setFormError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("transactions").insert({
        ...payload,
        workspace_id: wsId,
        created_by: user!.id,
      });
      if (error) { setFormError(error.message); setSaving(false); return; }
    }

    const isEdit = !!editingId;
    const { data } = await supabase.from("transactions").select("*").eq("workspace_id", wsId).order("date", { ascending: false });
    setTransactions(data ?? []);
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

  function copyWhatsApp() {
    const lines = filtered.map(
      (tx) => `• ${tx.description} — ${tx.type === "income" ? "+" : "-"}${formatBRL(tx.amount)} (${new Date(tx.date).toLocaleDateString("pt-BR")})`
    );
    const text = `Transações ${MONTH_NAMES[selectedMonth]} ${selectedYear}:\n${lines.join("\n")}\n\nSaldo: ${formatBRL(balance)}`;
    navigator.clipboard.writeText(text);
    toast("Copiado para a área de transferência!");
  }

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
          <h1 className="text-2xl font-bold text-foreground">
            {MONTH_NAMES[selectedMonth]} {selectedYear}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Transações do mês</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Mês</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-card border border-border rounded-lg px-2 py-2 text-sm font-medium text-foreground focus:outline-none"
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Ano</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-card border border-border rounded-lg px-2 py-2 text-sm font-medium text-foreground focus:outline-none"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            const rows = filtered.map((tx) => [
              new Date(tx.date).toLocaleDateString("pt-BR"),
              tx.description,
              tx.type === "income" ? "Receita" : "Despesa",
              (tx.amount / 100).toFixed(2).replace(".", ","),
              getCategoryName(tx.category_id),
              tx.notes ?? "",
            ]);
            downloadCSV("transacoes.csv", ["Data", "Descrição", "Tipo", "Valor", "Categoria", "Notas"], rows);
          }}
          className="border border-border text-foreground font-medium px-3 py-2 rounded-xl text-sm hover:bg-secondary transition-colors flex items-center gap-2"
        >
          <Download className="h-4 w-4" /> Exportar CSV
        </button>
        <button
          onClick={copyWhatsApp}
          className="border border-border text-foreground font-medium px-3 py-2 rounded-xl text-sm hover:bg-secondary transition-colors flex items-center gap-2"
        >
          <Copy className="h-4 w-4" /> WhatsApp
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Receitas</span>
          </div>
          <p className="text-xl font-bold text-emerald-500">{formatBRL(totalIncome)}</p>
        </div>
        <div className="bg-card border-2 border-destructive/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-4 w-4 text-destructive" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Despesas</span>
          </div>
          <p className="text-xl font-bold text-destructive">{formatBRL(totalExpense)}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet2 className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Investido</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatBRL(0)}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Metas</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatBRL(0)}</p>
        </div>
      </div>

      {/* Free balance */}
      <div className="flex justify-end">
        <p className="text-sm text-muted-foreground">
          Saldo livre: <span className="font-bold text-foreground">{formatBRL(balance)}</span>
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Form */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              {editingId ? "Editar transação" : "Nova transação"}
            </h3>
            <button
              type="button"
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary transition-colors"
              aria-label="Falar"
              title="Falar"
            >
              <Mic className="h-4 w-4" />
            </button>
          </div>

          {formError && <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm mb-4">{formError}</div>}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Data</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Descrição</label>
              <input
                type="text"
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ex: Supermercado"
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                maxLength={200}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Categoria</label>
              <select
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Selecione uma categoria</option>
                {categories.filter((c) => c.type === form.type).map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Valor</label>
                <input
                  type="text"
                  required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0,00"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Tipo</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as "income" | "expense" })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="expense">Saída</option>
                  <option value="income">Entrada</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Tipo</label>
              <select
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                defaultValue="fixo"
              >
                <option value="fixo">Fixo</option>
                <option value="variavel">Variável</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Notas</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Observações opcionais"
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                maxLength={500}
              />
            </div>

            <div className="flex gap-2 pt-1">
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
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
                {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar"}
              </button>
            </div>
          </form>
        </div>

        {/* Right: History */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-foreground">Histórico do mês</h3>
            <select
              value={filterCategoryId}
              onChange={(e) => setFilterCategoryId(e.target.value)}
              className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none"
            >
              <option value="">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>

          {/* Table header */}
          <div className="px-6 py-2 border-b border-border grid grid-cols-3 gap-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Data</span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Categoria / Descrição</span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Valor</span>
          </div>

          {filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Receipt className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm font-semibold text-foreground mb-1">Nenhuma transação neste mês</p>
              <p className="text-xs text-muted-foreground">Use o formulário para registrar sua primeira receita ou despesa.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((tx) => (
                <div key={tx.id} className="px-6 py-3 grid grid-cols-3 gap-2 items-center group hover:bg-muted/30 transition-colors">
                  <span className="text-xs text-muted-foreground">
                    {new Date(tx.date).toLocaleDateString("pt-BR")}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
                    {getCategoryName(tx.category_id) && (
                      <p className="text-xs text-muted-foreground">{getCategoryName(tx.category_id)}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <p className={`text-sm font-bold ${tx.type === "income" ? "text-emerald-500" : "text-destructive"}`}>
                      {tx.type === "income" ? "+" : "-"}{formatBRL(tx.amount)}
                    </p>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(tx)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" aria-label="Editar">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button onClick={() => { setDeletingId(tx.id); setDeleteModalOpen(true); }} className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" aria-label="Excluir">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete modal */}
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
