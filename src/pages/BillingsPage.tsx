import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { formatBRL } from "@/lib/utils/currency";
import { Receipt, Plus, Calendar, AlertCircle, CheckCircle2, Clock, Pencil, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { z } from "zod";

interface Billing {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  status: "pending" | "paid" | "overdue";
}

const billingSchema = z.object({
  description: z.string().trim().min(1, "Descrição obrigatória").max(200),
  amount: z.number().positive("Valor deve ser positivo"),
  due_date: z.string().min(1, "Data obrigatória"),
  status: z.enum(["pending", "paid", "overdue"]),
});

export function BillingsPage() {
  const { user } = useAuth();
  const [billings, setBillings] = useState<Billing[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const emptyForm = { description: "", amount: "", due_date: "", status: "pending" as "pending" | "paid" | "overdue" };
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
        .from("billings")
        .select("*")
        .eq("workspace_id", member.workspace_id)
        .order("due_date", { ascending: true });

      setBillings(data ?? []);
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

  function openEdit(billing: Billing) {
    setEditingId(billing.id);
    setForm({
      description: billing.description,
      amount: String(billing.amount),
      due_date: billing.due_date,
      status: billing.status,
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

    const parsed = billingSchema.safeParse({
      description: form.description,
      amount: parseFloat(form.amount),
      due_date: form.due_date,
      status: form.status,
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
        .from("billings")
        .update(parsed.data)
        .eq("id", editingId)
        .select()
        .single();

      setSaving(false);
      if (error) { setErrors({ description: "Erro ao salvar." }); return; }
      setBillings((prev) => prev.map((b) => (b.id === editingId ? data : b)));
    } else {
      const { data, error } = await supabase
        .from("billings")
        .insert({ ...parsed.data, workspace_id: workspaceId })
        .select()
        .single();

      setSaving(false);
      if (error) { setErrors({ description: "Erro ao salvar." }); return; }
      setBillings((prev) => [...prev, data]);
    }

    setForm(emptyForm);
    setEditingId(null);
    setModalOpen(false);
  }

  async function handleDelete() {
    if (!deletingId) return;
    setSaving(true);
    await supabase.from("billings").delete().eq("id", deletingId);
    setBillings((prev) => prev.filter((b) => b.id !== deletingId));
    setSaving(false);
    setDeleteModalOpen(false);
    setDeletingId(null);
  }

  const statusConfig = {
    pending: { label: "Pendente", icon: Clock, className: "text-amber-500 bg-amber-500/10" },
    paid: { label: "Pago", icon: CheckCircle2, className: "text-emerald-500 bg-emerald-500/10" },
    overdue: { label: "Atrasado", icon: AlertCircle, className: "text-rose-500 bg-rose-500/10" },
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
          <h1 className="text-3xl font-bold text-foreground">Cobranças</h1>
          <p className="text-muted-foreground mt-1">Gerencie suas contas a pagar e receber</p>
        </div>
        <button onClick={openCreate} className="bg-hero-gradient text-primary-foreground font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> Nova cobrança
        </button>
      </div>

      {billings.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma cobrança cadastrada</h3>
          <p className="text-muted-foreground">Adicione suas contas a pagar para não perder nenhum vencimento.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {billings.map((billing) => {
            const status = statusConfig[billing.status] || statusConfig.pending;
            const StatusIcon = status.icon;
            return (
              <div key={billing.id} className="bg-card border border-border rounded-xl p-5 flex items-center justify-between hover:shadow-card-hover transition-shadow group">
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${status.className}`}>
                    <StatusIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{billing.description}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Vence em {new Date(billing.due_date).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-lg font-bold text-foreground">{formatBRL(billing.amount)}</p>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(billing)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => openDelete(billing.id)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" aria-label="Excluir">
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Editar cobrança" : "Nova cobrança"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Descrição</label>
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: Conta de luz" className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" maxLength={200} />
            {errors.description && <p className="text-sm text-destructive mt-1">{errors.description}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Valor (R$)</label>
              <input type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
              {errors.amount && <p className="text-sm text-destructive mt-1">{errors.amount}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Vencimento</label>
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
              {errors.due_date && <p className="text-sm text-destructive mt-1">{errors.due_date}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "pending" | "paid" | "overdue" })} className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">
              <option value="pending">Pendente</option>
              <option value="paid">Pago</option>
              <option value="overdue">Atrasado</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-secondary transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="bg-hero-gradient text-primary-foreground font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Criar cobrança"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Excluir cobrança">
        <p className="text-muted-foreground mb-6">Tem certeza que deseja excluir esta cobrança? Esta ação não pode ser desfeita.</p>
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
