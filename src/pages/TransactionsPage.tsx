import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useIntlFormat } from "@/hooks/useIntlFormat";
import { usePermissions } from "@/hooks/usePermissions";
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY, convertCurrency, formatAmount, type CurrencyCode } from "@/lib/utils/exchange";
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
  FileText,
  Upload,
  Camera,
} from "lucide-react";
import { downloadCSV } from "@/lib/utils/csv";
import { downloadPDF } from "@/lib/utils/pdf";
import { ImportTransactionsModal } from "@/components/transactions/ImportTransactionsModal";
import { ReceiptScanner } from "@/components/transactions/ReceiptScanner";
import { PermissionBanner } from "@/components/ui/PermissionBanner";
import { MiniCalculator } from "@/components/ui/MiniCalculator";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { triggerAlertCheck } from "@/lib/triggerAlertCheck";
import { useGamification, type AchievementDef } from "@/hooks/useGamification";
import { AchievementToast } from "@/components/gamification/AchievementToast";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  date: string;
  category_id: string | null;
  notes: string | null;
  currency?: string;
  original_amount?: number;
  exchange_rate?: number;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  type: string;
}

interface Budget {
  id: string;
  category: string;
  limit_amount: number;
  spent_amount: number;
}

const MONTH_NAMES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

export function TransactionsPage() {
  const fmt = useIntlFormat();
  const formatBRL = fmt.money;
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const wsId = activeWorkspace?.id ?? null;
  const permissions = usePermissions();
  const { recordActivity } = useGamification(wsId);
  const [newAchievement, setNewAchievement] = useState<AchievementDef | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

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
    currency: DEFAULT_CURRENCY as CurrencyCode,
  };
  const [form, setForm] = useState(emptyForm);
  const [convertedPreview, setConvertedPreview] = useState<{ amount: number; rate: number } | null>(null);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    async function load() {
      if (!wsId) { setLoading(false); return; }
      const [txRes, catRes, budgetRes] = await Promise.all([
        supabase.from("transactions").select("*").eq("workspace_id", wsId).order("date", { ascending: false }),
        supabase.from("categories").select("id, name, icon, type").eq("workspace_id", wsId),
        supabase.from("budgets").select("id, category, limit_amount, spent_amount").eq("workspace_id", wsId),
      ]);
      setTransactions(txRes.data ?? []);
      setCategories(catRes.data ?? []);
      setBudgets(budgetRes.data ?? []);
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
      amount: String((tx.original_amount || tx.amount) / 100),
      type: tx.type === "transfer" ? "expense" : tx.type,
      date: tx.date,
      category_id: tx.category_id || "",
      notes: tx.notes || "",
      currency: (tx.currency as CurrencyCode) || DEFAULT_CURRENCY,
    });
    setConvertedPreview(null);
    setFormError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setConvertedPreview(null);
    setFormError("");
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsId) return;
    setFormError("");
    setSaving(true);

    const rawAmount = Math.round(parseFloat(form.amount.replace(",", ".")) * 100);
    if (isNaN(rawAmount) || rawAmount <= 0) {
      setFormError("Valor inválido.");
      setSaving(false);
      return;
    }

    // Convert to base currency (BRL) if needed
    let amountCents = rawAmount;
    let originalAmount: number | null = null;
    let exchangeRate: number | null = null;

    if (form.currency !== DEFAULT_CURRENCY) {
      try {
        const result = await convertCurrency(rawAmount, form.currency, DEFAULT_CURRENCY);
        amountCents = result.convertedCents;
        originalAmount = rawAmount;
        exchangeRate = result.rate;
      } catch {
        setFormError("Erro ao converter moeda. Tente novamente.");
        setSaving(false);
        return;
      }
    }

    const payload: Record<string, unknown> = {
      description: form.description.trim(),
      amount: amountCents,
      type: form.type,
      date: form.date,
      category_id: form.category_id || null,
      notes: form.notes || null,
      currency: form.currency,
      original_amount: originalAmount,
      exchange_rate: exchangeRate,
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

    // Gamification: record activity and show achievement toast
    if (!isEdit) {
      const newAchs = await recordActivity();
      if (newAchs && newAchs.length > 0) {
        setNewAchievement(newAchs[0]);
      }
    }
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
      (tx) => `• ${tx.description} — ${tx.type === "income" ? "+" : "-"}${formatBRL(tx.amount)} (${fmt.date(tx.date)})`
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
      {!permissions.canEdit && <PermissionBanner reason={permissions.reason} hasPlan={permissions.hasPlan} isViewer={permissions.isViewer} />}

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
              fmt.date(tx.date),
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
        <button
          onClick={() => {
            const rows = filtered.map((tx) => [
              fmt.date(tx.date),
              tx.description,
              tx.type === "income" ? "Receita" : "Despesa",
              (tx.amount / 100).toFixed(2).replace(".", ","),
              getCategoryName(tx.category_id),
            ]);
            downloadPDF(
              "transacoes.pdf",
              `Transações — ${MONTH_NAMES[selectedMonth]} ${selectedYear}`,
              ["Data", "Descrição", "Tipo", "Valor", "Categoria"],
              rows,
              `Saldo: R$ ${(balance / 100).toFixed(2).replace(".", ",")}`
            );
          }}
          className="border border-border text-foreground font-medium px-3 py-2 rounded-xl text-sm hover:bg-secondary transition-colors flex items-center gap-2"
        >
          <FileText className="h-4 w-4" /> PDF
        </button>
        <button
          onClick={() => setImportOpen(true)}
          className="border border-border text-foreground font-medium px-3 py-2 rounded-xl text-sm hover:bg-secondary transition-colors flex items-center gap-2"
        >
          <Upload className="h-4 w-4" /> Importar
        </button>
        <button
          onClick={() => setScannerOpen(true)}
          className="border border-border text-foreground font-medium px-3 py-2 rounded-xl text-sm hover:bg-secondary transition-colors flex items-center gap-2"
        >
          <Camera className="h-4 w-4" /> Escanear recibo
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
              {/* Budget feedback for expenses */}
              {form.type === "expense" && form.category_id && (() => {
                const selectedCat = categories.find((c) => c.id === form.category_id);
                if (!selectedCat) return null;
                const budget = budgets.find((b) => b.category === selectedCat.name);
                if (!budget) return null;
                const inputCents = Math.round(parseFloat((form.amount || "0").replace(",", ".")) * 100) || 0;
                const remainingAfter = budget.limit_amount - budget.spent_amount - inputCents;
                const remainingNow = budget.limit_amount - budget.spent_amount;
                const pctAfter = budget.limit_amount > 0 ? Math.min(((budget.spent_amount + inputCents) / budget.limit_amount) * 100, 100) : 0;
                const isOver = remainingAfter < 0;
                const isWarning = pctAfter >= 80 && !isOver;
                return (
                  <div className={`mt-2 p-3 rounded-xl text-xs space-y-1.5 ${isOver ? "bg-destructive/10 border border-destructive/20" : isWarning ? "bg-amber-500/10 border border-amber-500/20" : "bg-emerald-500/10 border border-emerald-500/20"}`}>
                    <div className="flex justify-between font-medium">
                      <span className="text-muted-foreground">Orçamento de {selectedCat.name}</span>
                      <span className={isOver ? "text-destructive" : isWarning ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
                        {pctAfter.toFixed(0)}% usado
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isOver ? "bg-destructive" : isWarning ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${Math.min(pctAfter, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Disponível agora: {formatBRL(Math.max(remainingNow, 0))}</span>
                      {inputCents > 0 && (
                        <span className={isOver ? "text-destructive font-semibold" : ""}>
                          {isOver ? `Estouro: ${formatBRL(Math.abs(remainingAfter))}` : `Após lançar: ${formatBRL(remainingAfter)}`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Valor</label>
                <MiniCalculator
                  value={form.amount}
                  onChange={(v) => {
                    setForm({ ...form, amount: v });
                    setConvertedPreview(null);
                  }}
                  placeholder="0,00"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Moeda</label>
                <select
                  value={form.currency}
                  onChange={async (e) => {
                    const cur = e.target.value as CurrencyCode;
                    setForm({ ...form, currency: cur });
                    setConvertedPreview(null);
                    // Auto-preview conversion
                    const val = parseFloat((form.amount || "0").replace(",", "."));
                    if (cur !== DEFAULT_CURRENCY && val > 0) {
                      setConverting(true);
                      try {
                        const result = await convertCurrency(Math.round(val * 100), cur, DEFAULT_CURRENCY);
                        setConvertedPreview({ amount: result.convertedCents, rate: result.rate });
                      } catch { /* ignore */ }
                      setConverting(false);
                    }
                  }}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                  ))}
                </select>
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

            {/* Currency conversion preview */}
            {form.currency !== DEFAULT_CURRENCY && (
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 text-xs space-y-1">
                {converting ? (
                  <p className="text-muted-foreground">Consultando cotação...</p>
                ) : convertedPreview ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Taxa: 1 {form.currency} = {convertedPreview.rate.toFixed(4)} {DEFAULT_CURRENCY}</span>
                      <span className="font-semibold text-foreground">≈ {formatAmount(convertedPreview.amount, DEFAULT_CURRENCY)}</span>
                    </div>
                    <p className="text-muted-foreground">O valor será salvo em {DEFAULT_CURRENCY} com a cotação atual.</p>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    Digite o valor para ver a conversão automática para {DEFAULT_CURRENCY}.
                  </p>
                )}
              </div>
            )}

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
                disabled={saving || !permissions.canEdit}
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
                    {fmt.date(tx.date)}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
                    {getCategoryName(tx.category_id) && (
                      <p className="text-xs text-muted-foreground">{getCategoryName(tx.category_id)}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <div className="text-right">
                      <p className={`text-sm font-bold ${tx.type === "income" ? "text-emerald-500" : "text-destructive"}`}>
                        {tx.type === "income" ? "+" : "-"}{formatBRL(tx.amount)}
                      </p>
                      {tx.currency && tx.currency !== DEFAULT_CURRENCY && tx.original_amount && (
                        <p className="text-[10px] text-muted-foreground">
                          {formatAmount(tx.original_amount, tx.currency as CurrencyCode)} · {tx.exchange_rate?.toFixed(4)}
                        </p>
                      )}
                    </div>
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

      <ImportTransactionsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        workspaceId={wsId!}
        userId={user!.id}
        onImported={async () => {
          const { data } = await supabase.from("transactions").select("*").eq("workspace_id", wsId!).order("date", { ascending: false });
          setTransactions(data ?? []);
        }}
      />

      <Modal open={scannerOpen} onClose={() => setScannerOpen(false)} title="Escanear recibo">
        <ReceiptScanner
          categories={categories}
          onExtracted={(data) => {
            setScannerOpen(false);
            // Auto-fill the form with extracted data
            const matchedCat = categories.find(
              (c) => c.name.toLowerCase() === (data.category || "").toLowerCase() && c.type === data.type
            );
            setForm({
              description: data.description || "",
              amount: data.amount ? String(data.amount).replace(".", ",") : "",
              type: data.type || "expense",
              date: data.date || new Date().toISOString().split("T")[0],
              category_id: matchedCat?.id || "",
              notes: `Extraído via OCR (confiança: ${data.confidence}%)`,
              currency: "BRL" as any,
            });
            setConvertedPreview(null);
            toast("Dados do recibo extraídos! Revise e salve.");
          }}
          onClose={() => setScannerOpen(false)}
        />
      </Modal>

      <AchievementToast
        achievement={newAchievement}
        onDone={() => setNewAchievement(null)}
      />
    </div>
  );
}
