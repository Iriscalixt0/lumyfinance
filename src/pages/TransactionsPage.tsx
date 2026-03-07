import { useEffect, useState, useMemo, useCallback } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useIntlFormat } from "@/hooks/useIntlFormat";
import { MagicInput } from "@/components/transactions/MagicInput";
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
  Sparkles,
} from "lucide-react";
import { downloadCSV } from "@/lib/utils/csv";
import { downloadPDF } from "@/lib/utils/pdf";
import { ImportTransactionsModal } from "@/components/transactions/ImportTransactionsModal";
import { ReceiptScanner } from "@/components/transactions/ReceiptScanner";
import { ReceiptHistory } from "@/components/transactions/ReceiptHistory";
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

const CURRENCY_CHART_COLORS = [
  "#3b82f6", "#f43f5e", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#ef4444", "#6366f1",
  "#14b8a6", "#f97316",
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
  const [showReceiptHistory, setShowReceiptHistory] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Auto-select currency based on locale
  const localeCurrency = (fmt.currency as CurrencyCode) || DEFAULT_CURRENCY;

  // Month/year selectors
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterCurrency, setFilterCurrency] = useState("");

  const emptyForm = useMemo(() => ({
    description: "",
    amount: "",
    type: "expense" as "income" | "expense",
    date: now.toISOString().split("T")[0],
    category_id: "",
    notes: "",
    currency: localeCurrency,
  }), [localeCurrency]);
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
    let result = monthFiltered;
    if (filterCategoryId) result = result.filter((tx) => tx.category_id === filterCategoryId);
    if (filterCurrency) result = result.filter((tx) => (tx.currency || DEFAULT_CURRENCY) === filterCurrency);
    return result;
  }, [monthFiltered, filterCategoryId, filterCurrency]);

  // KPI: expenses grouped by currency
  const expenseByCurrency = useMemo(() => {
    const map = new Map<string, number>();
    monthFiltered
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        const cur = t.currency || DEFAULT_CURRENCY;
        map.set(cur, (map.get(cur) || 0) + (t.original_amount || t.amount));
      });
    return Array.from(map.entries())
      .map(([code, total]) => ({ code: code as CurrencyCode, total }))
      .sort((a, b) => b.total - a.total);
  }, [monthFiltered]);

  // Unique currencies in current month for filter dropdown
  const usedCurrencies = useMemo(() => {
    const set = new Set<string>();
    monthFiltered.forEach((t) => set.add(t.currency || DEFAULT_CURRENCY));
    return Array.from(set).sort();
  }, [monthFiltered]);

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
      currency: (tx.currency as CurrencyCode) || localeCurrency,
    });
    setConvertedPreview(null);
    setFormError("");
    setShowAdvanced(true); // Show all fields when editing
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setConvertedPreview(null);
    setFormError("");
    setShowAdvanced(false);
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
    setShowAdvanced(false);
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
      <div className="flex items-center gap-2 flex-wrap">
        {/* Export group — unified muted style */}
        <div className="flex items-center gap-1.5 bg-muted/50 rounded-xl p-1">
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
            className="text-muted-foreground hover:text-foreground hover:bg-background font-medium px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1.5"
            title="Exportar CSV"
          >
            <Download className="h-3.5 w-3.5" /> CSV
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
            className="text-muted-foreground hover:text-foreground hover:bg-background font-medium px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1.5"
            title="Exportar PDF"
          >
            <FileText className="h-3.5 w-3.5" /> PDF
          </button>
          <button
            onClick={copyWhatsApp}
            className="text-muted-foreground hover:text-foreground hover:bg-background font-medium px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1.5"
            title="Copiar para WhatsApp"
          >
            <Copy className="h-3.5 w-3.5" /> WhatsApp
          </button>
        </div>

        {/* Action buttons */}
        <button
          onClick={() => setImportOpen(true)}
          className="border border-border text-muted-foreground hover:text-foreground font-medium px-3 py-2 rounded-xl text-sm hover:bg-secondary transition-colors flex items-center gap-2"
          title="Importar transações"
        >
          <Upload className="h-4 w-4" /> Importar
        </button>
        <button
          onClick={() => setScannerOpen(true)}
          className="border border-border text-muted-foreground hover:text-foreground font-medium px-3 py-2 rounded-xl text-sm hover:bg-secondary transition-colors flex items-center gap-2"
          title="Escanear recibo com OCR"
        >
          <Camera className="h-4 w-4" /> Escanear
        </button>
        <button
          onClick={() => setShowReceiptHistory((v) => !v)}
          className={`border font-medium px-3 py-2 rounded-xl text-sm transition-colors flex items-center gap-2 ${
            showReceiptHistory
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
          }`}
          title="Ver histórico de recibos"
        >
          <Receipt className="h-4 w-4" /> Recibos
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

      {/* Currency breakdown KPI */}
      {expenseByCurrency.length > 1 && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Despesas por moeda</h4>
          <div className="flex flex-wrap gap-4">
            {expenseByCurrency.map(({ code, total }) => {
              const info = SUPPORTED_CURRENCIES.find((c) => c.code === code);
              return (
                <div key={code} className="flex items-center gap-2">
                  <span className="text-lg">{info?.flag ?? "💱"}</span>
                  <div>
                    <p className="text-xs font-medium text-foreground">{code}</p>
                    <p className="text-sm font-bold text-destructive">{formatAmount(total, code)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Free balance */}
      <div className="flex justify-end">
        <p className="text-sm text-muted-foreground">
          Saldo livre: <span className="font-bold text-foreground">{formatBRL(balance)}</span>
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Magic Input + traditional form for editing */}
        <div className="bg-card border border-border rounded-2xl p-6">
          {editingId ? (
            <>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold text-foreground">Editar transação</h3>
              </div>
              {formError && <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm mb-4">{formError}</div>}
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Valor</label>
                    <MiniCalculator
                      value={form.amount}
                      onChange={(v) => { setForm({ ...form, amount: v }); setConvertedPreview(null); }}
                      placeholder="0,00"
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
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Data</label>
                    <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Descrição</label>
                  <input type="text" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Ex: Supermercado"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" maxLength={200} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Categoria</label>
                  <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <option value="">Selecione</option>
                    {categories.filter((c) => c.type === form.type).map((c) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={cancelEdit}
                    className="flex-1 py-2.5 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-secondary transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex-1 bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 text-sm">
                    {saving ? "Salvando..." : "Salvar alterações"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-foreground">Magic Input</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-1">
                Digite naturalmente: "Uber 25.50", "Aluguel 1200"
              </p>
              {(() => {
                const travelActive = localStorage.getItem("lmyf_travel_mode") === "true";
                const travelCurrency = localStorage.getItem("lmyf_travel_currency") || "USD";
                return travelActive ? (
                  <p className="text-xs text-primary/80 mb-4 flex items-center gap-1">
                    ✈️ Modo Viagem ativo — para converter, digite: "Netflix 15 {travelCurrency}"
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/70 mb-4">
                    💡 Ative o <span className="font-medium text-muted-foreground">Modo Viagem</span> para converter gastos em moeda estrangeira automaticamente
                  </p>
                );
              })()}
              <MagicInput
                baseCurrency={localeCurrency}
                disabled={!permissions.canEdit}
                onSubmit={async (data) => {
                  if (!wsId || !user) return;
                  setSaving(true);

                  // Find category id
                  let categoryId: string | null = null;
                  if (data.category) {
                    const match = categories.find(c => c.name.toLowerCase() === data.category!.toLowerCase());
                    categoryId = match?.id ?? null;
                  }

                  const payload: Record<string, unknown> = {
                    workspace_id: wsId,
                    created_by: user.id,
                    description: data.description,
                    amount: data.amount,
                    type: data.type,
                    date: data.date,
                    category_id: categoryId,
                    currency: data.currency,
                    original_amount: data.originalAmount ?? null,
                    exchange_rate: data.exchangeRate ?? null,
                  };

                  const { error } = await supabase.from("transactions").insert(payload);
                  if (error) { toast("Erro ao salvar"); setSaving(false); return; }

                  const { data: txData } = await supabase.from("transactions").select("*").eq("workspace_id", wsId).order("date", { ascending: false });
                  setTransactions(txData ?? []);
                  setSaving(false);
                  toast("Transação criada!");
                  triggerAlertCheck(wsId);

                  const newAchs = await recordActivity();
                  if (newAchs && newAchs.length > 0) setNewAchievement(newAchs[0]);
                }}
              />
            </>
          )}
        </div>

        {/* Right: History */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-foreground">Histórico do mês</h3>
            <div className="flex items-center gap-2">
              <select
                value={filterCurrency}
                onChange={(e) => setFilterCurrency(e.target.value)}
                className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none"
              >
                <option value="">Todas moedas</option>
                {usedCurrencies.map((c) => {
                  const info = SUPPORTED_CURRENCIES.find((s) => s.code === c);
                  return <option key={c} value={c}>{info?.flag ?? "💱"} {c}</option>;
                })}
              </select>
              <select
                value={filterCategoryId}
                onChange={(e) => setFilterCategoryId(e.target.value)}
                className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none"
              >
                <option value="">Todas categorias</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
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

      {/* Receipt history */}
      {showReceiptHistory && wsId && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              Histórico de recibos escaneados
            </h3>
          </div>
          <ReceiptHistory workspaceId={wsId} />
        </div>
      )}

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
          onExtracted={(data) => {
            setScannerOpen(false);
            const matchedCat = categories.find(
              (c) => c.name.toLowerCase() === (data.category || "").toLowerCase() && c.type === data.type
            );
            setForm({
              description: data.description || "",
              amount: data.amount ? String(data.amount).replace(".", ",") : "",
              type: data.type || "expense",
              date: data.date || new Date().toISOString().split("T")[0],
              category_id: matchedCat?.id || "",
              notes: `Extraído via OCR local (confiança: ${data.confidence}%)`,
              currency: localeCurrency,
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
