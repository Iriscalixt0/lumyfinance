import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useIntlFormat } from "@/hooks/useIntlFormat";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionBanner } from "@/components/ui/PermissionBanner";
import {
  Receipt,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  Pencil,
  Trash2,
  Download,
  Search,
  Phone,
  Copy,
  Users,
  Wallet2,
} from "lucide-react";
import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import { parseVoiceBilling } from "@/lib/utils/voice-form-parser";
import { downloadCSV } from "@/lib/utils/csv";
import { Modal } from "@/components/ui/Modal";
import { z } from "zod";
import { useToast } from "@/components/ui/Toast";

interface Billing {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  status: "pending" | "paid" | "overdue";
  phone?: string | null;
  notes?: string | null;
}

const billingSchema = z.object({
  description: z.string().trim().min(1, "Nome obrigatório").max(200),
  amount: z.number().positive("Valor deve ser positivo"),
  due_date: z.string().min(1, "Data obrigatória"),
  status: z.enum(["pending", "paid", "overdue"]),
  phone: z.string().max(20).optional(),
  notes: z.string().max(500).optional(),
});

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  overdue: "Atrasado",
};

export function BillingsPage() {
  const fmt = useIntlFormat();
  const formatBRL = fmt.money;
  const { toast } = useToast();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? null;
  const permissions = usePermissions();
  const [billings, setBillings] = useState<Billing[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Filters
  const [searchName, setSearchName] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const emptyForm = {
    description: "",
    amount: "",
    due_date: "",
    status: "pending" as "pending" | "paid" | "overdue",
    phone: "",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    async function load() {
      if (!workspaceId) { setLoading(false); return; }
      const { data } = await supabase
        .from("billings")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("due_date", { ascending: true });
      setBillings(data ?? []);
      setLoading(false);
    }
    load();
  }, [workspaceId]);

  function openEdit(billing: Billing) {
    setEditingId(billing.id);
    setForm({
      description: billing.description,
      amount: String(billing.amount),
      due_date: billing.due_date,
      status: billing.status,
      phone: billing.phone || "",
      notes: billing.notes || "",
    });
    setErrors({});
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
  }

  function openDelete(id: string) {
    setDeletingId(id);
    setDeleteModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const parsed = billingSchema.safeParse({
      description: form.description,
      amount: parseFloat(form.amount.replace(",", ".")),
      due_date: form.due_date,
      status: form.status,
      phone: form.phone || undefined,
      notes: form.notes || undefined,
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

    const payload = {
      ...parsed.data,
      phone: parsed.data.phone || null,
      notes: parsed.data.notes || null,
    };

    if (editingId) {
      const { data, error } = await supabase
        .from("billings")
        .update(payload)
        .eq("id", editingId)
        .select()
        .single();

      setSaving(false);
      if (error) { setErrors({ description: "Erro ao salvar." }); return; }
      setBillings((prev) => prev.map((b) => (b.id === editingId ? data : b)));
      toast("Cobrança atualizada!");
    } else {
      const { data, error } = await supabase
        .from("billings")
        .insert({ ...payload, workspace_id: workspaceId })
        .select()
        .single();

      setSaving(false);
      if (error) { setErrors({ description: "Erro ao salvar." }); return; }
      setBillings((prev) => [...prev, data]);
      toast("Cobrança criada!");
    }

    setForm(emptyForm);
    setEditingId(null);
  }

  async function handleMarkPaid(id: string) {
    const { data, error } = await supabase
      .from("billings")
      .update({ status: "paid" })
      .eq("id", id)
      .select()
      .single();
    if (!error && data) {
      setBillings((prev) => prev.map((b) => (b.id === id ? data : b)));
      toast("Marcado como pago!");
    }
  }

  async function handleDelete() {
    if (!deletingId) return;
    setSaving(true);
    await supabase.from("billings").delete().eq("id", deletingId);
    setBillings((prev) => prev.filter((b) => b.id !== deletingId));
    setSaving(false);
    setDeleteModalOpen(false);
    setDeletingId(null);
    toast("Cobrança excluída!");
  }

  const filtered = useMemo(() => {
    return billings.filter((b) => {
      if (searchName && !b.description.toLowerCase().includes(searchName.toLowerCase())) return false;
      if (filterStatus !== "all" && b.status !== filterStatus) return false;
      if (filterDateFrom && b.due_date < filterDateFrom) return false;
      if (filterDateTo && b.due_date > filterDateTo) return false;
      return true;
    });
  }, [billings, searchName, filterStatus, filterDateFrom, filterDateTo]);

  const totalPending = useMemo(() => filtered.filter((b) => b.status !== "paid").reduce((s, b) => s + b.amount, 0), [filtered]);
  const totalPaid = useMemo(() => filtered.filter((b) => b.status === "paid").reduce((s, b) => s + b.amount, 0), [filtered]);
  const debtorsCount = useMemo(() => filtered.filter((b) => b.status !== "paid").length, [filtered]);

  function copyWhatsApp() {
    const pending = filtered.filter((b) => b.status !== "paid");
    if (!pending.length) { toast("Nenhuma cobrança pendente."); return; }
    const lines = pending.map(
      (b) => `• ${b.description} — ${formatBRL(b.amount)} (venc. ${fmt.date(b.due_date)})`
    );
    const text = `Cobranças pendentes:\n${lines.join("\n")}\n\nTotal: ${formatBRL(totalPending)}`;
    navigator.clipboard.writeText(text);
    toast("Copiado para a área de transferência!");
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
      {!permissions.canEdit && <PermissionBanner reason={permissions.reason} hasPlan={permissions.hasPlan} isViewer={permissions.isViewer} />}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cobranças</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registre quem te deve, o valor e envie por PDF, WhatsApp ou CSV
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const rows = filtered.map((b) => [
                b.description,
                String(b.amount).replace(".", ","),
                fmt.date(b.due_date),
                STATUS_LABELS[b.status] ?? b.status,
                b.phone ?? "",
                b.notes ?? "",
              ]);
              downloadCSV("cobrancas.csv", ["Nome", "Valor", "Vencimento", "Status", "Telefone", "Obs"], rows);
            }}
            className="border border-border text-foreground font-medium px-3 py-2.5 rounded-xl text-sm hover:bg-secondary transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" /> Exportar CSV
          </button>
          <button
            onClick={copyWhatsApp}
            className="border border-border text-foreground font-medium px-3 py-2.5 rounded-xl text-sm hover:bg-secondary transition-colors flex items-center gap-2"
          >
            <Copy className="h-4 w-4" /> Copiar p/ WhatsApp
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Cliente (nome)</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="Buscar por nome..."
              className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">Todos</option>
            <option value="pending">Pendente</option>
            <option value="paid">Pago</option>
            <option value="overdue">Atrasado</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Vencimento de</label>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">até</label>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Wallet2 className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total a receber</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatBRL(totalPending)}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Devedores (filtro)</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{debtorsCount} itens</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Já recebido (pagos)</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatBRL(totalPaid)}</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Form */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {editingId ? "Editar cobrança" : "Nova cobrança"}
            </h3>
            <VoiceInputButton
              hint="Diga: João 150 reais amanhã"
              onTranscript={(transcript) => {
                const parsed = parseVoiceBilling(transcript);
                setForm({
                  ...form,
                  description: parsed.description || form.description,
                  amount: parsed.amount ? String(parsed.amount) : form.amount,
                  due_date: parsed.dueDate || form.due_date,
                });
                toast("Campos preenchidos por voz ✓");
              }}
              disabled={!permissions.canEdit}
            />
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Quem deve *
              </label>
              <input
                type="text"
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Nome da pessoa"
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                maxLength={200}
              />
              {errors.description && <p className="text-xs text-destructive mt-1">{errors.description}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Valor (R$) *
              </label>
              <input
                type="text"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0,00"
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Vencimento
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="date"
                  required
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              {errors.due_date && <p className="text-xs text-destructive mt-1">{errors.due_date}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Telefone (WhatsApp)
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="11999999999"
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                maxLength={20}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Observações
              </label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Detalhes opcionais"
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
                {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Adicionar cobrança"}
              </button>
            </div>
          </form>
        </div>

        {/* Right: List */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              Cobranças
            </h3>
            <span className="text-xs text-muted-foreground">
              Total a receber: {formatBRL(totalPending)}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Receipt className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">Nenhuma cobrança encontrada.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((b) => {
                const isPaid = b.status === "paid";
                const isOverdue = b.status === "overdue";
                return (
                  <div key={b.id} className="px-6 py-4 group hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{b.description}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                isPaid
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : isOverdue
                                  ? "bg-rose-500/10 text-rose-500"
                                  : "bg-amber-500/10 text-amber-600"
                              }`}
                            >
                              {STATUS_LABELS[b.status]}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Vencimento: {fmt.date(b.due_date)}
                            </span>
                            {b.phone && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {b.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <p className={`text-sm font-bold ${isPaid ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {formatBRL(b.amount)}
                        </p>
                        {!isPaid && (
                          <button
                            onClick={() => handleMarkPaid(b.id)}
                            className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
                          >
                            <CheckCircle2 className="h-3 w-3" /> Pago
                          </button>
                        )}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEdit(b)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => openDelete(b.id)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            aria-label="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
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
      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Excluir cobrança">
        <p className="text-muted-foreground mb-6">Tem certeza que deseja excluir esta cobrança? Esta ação não pode ser desfeita.</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteModalOpen(false)} className="px-5 py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-secondary transition-colors">
            Cancelar
          </button>
          <button onClick={handleDelete} disabled={saving} className="px-5 py-2.5 rounded-lg bg-destructive text-destructive-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {saving ? "Excluindo..." : "Excluir"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
