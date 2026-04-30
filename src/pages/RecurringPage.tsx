import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useIntlFormat } from "@/hooks/useIntlFormat";
import { usePermissions } from "@/hooks/usePermissions";
import { useTranslations } from "@/lib/i18n";
import {
  Repeat,
  Pencil,
  Trash2,
  Pause,
  Play,
  CalendarDays,
  Filter,
  Zap,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { z } from "zod";
import { useToast } from "@/components/ui/Toast";
import { PermissionBanner } from "@/components/ui/PermissionBanner";
import { useGamification, type AchievementDef } from "@/hooks/useGamification";
import { AchievementToast } from "@/components/gamification/AchievementToast";
import { materializeRecurring } from "@/lib/utils/recurring";

type Frequency = "weekly" | "biweekly" | "monthly" | "yearly";
type StatusFilter = "all" | "active" | "inactive";

interface RecurringTransaction {
  id: string;
  description: string;
  amount: number; // cents
  type: "income" | "expense";
  category_id: string | null;
  frequency: Frequency;
  start_date: string;
  next_run_date: string;
  end_date: string | null;
  active?: boolean | null;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  type: string;
}

function ymKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Returns true if the recurring transaction has at least one occurrence
 * inside the given month (year-month).
 */
function occursInMonth(rec: RecurringTransaction, year: number, monthIdx: number): boolean {
  const start = new Date(rec.start_date);
  const end = rec.end_date ? new Date(rec.end_date) : null;

  const monthStart = new Date(year, monthIdx, 1);
  const monthEnd = new Date(year, monthIdx + 1, 0, 23, 59, 59);

  if (start.getTime() > monthEnd.getTime()) return false;
  if (end && end.getTime() < monthStart.getTime()) return false;

  // Walk occurrences from start until past monthEnd (cap iterations for safety)
  const cursor = new Date(start);
  let safety = 600;
  while (cursor.getTime() <= monthEnd.getTime() && safety-- > 0) {
    if (cursor.getTime() >= monthStart.getTime()) return true;
    switch (rec.frequency) {
      case "weekly":
        cursor.setDate(cursor.getDate() + 7);
        break;
      case "biweekly":
        cursor.setDate(cursor.getDate() + 14);
        break;
      case "monthly":
        cursor.setMonth(cursor.getMonth() + 1);
        break;
      case "yearly":
        cursor.setFullYear(cursor.getFullYear() + 1);
        break;
    }
  }
  return false;
}

export function RecurringPage() {
  const fmt = useIntlFormat();
  const formatBRL = fmt.money;
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? null;
  const permissions = usePermissions();
  const { checkAchievements } = useGamification(workspaceId);
  const t = useTranslations("recurringPage");
  const tc = useTranslations("common");
  const [newAchievement, setNewAchievement] = useState<AchievementDef | null>(null);
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasActiveColumn, setHasActiveColumn] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);

  // Filters
  const [monthFilter, setMonthFilter] = useState<string>(""); // "" = all months
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const recurringSchema = z.object({
    description: z.string().trim().min(1).max(200),
    amount: z.number().positive(),
    type: z.enum(["income", "expense"]),
    frequency: z.enum(["weekly", "biweekly", "monthly", "yearly"]),
    start_date: z.string().min(1),
    end_date: z.string().nullable(),
    category_id: z.string().nullable(),
  });

  const freqLabels: Record<Frequency, string> = {
    weekly: t("weekly"),
    biweekly: t("biweekly") || "Quinzenal",
    monthly: t("monthly"),
    yearly: t("yearly"),
  };

  const emptyForm = {
    description: "",
    amount: "",
    type: "expense" as "income" | "expense",
    category_id: "",
    frequency: "monthly" as Frequency,
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    async function load() {
      if (!workspaceId) {
        setLoading(false);
        return;
      }

      const [recRes, catRes] = await Promise.all([
        supabase
          .from("recurring_transactions")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("next_run_date", { ascending: true }),
        supabase.from("categories").select("id, name, icon, type").eq("workspace_id", workspaceId),
      ]);

      const rows = (recRes.data ?? []) as RecurringTransaction[];
      // Detect whether `active` column exists in payload. If not, treat all as active.
      const hasActive = rows.length === 0 ? true : "active" in rows[0];
      setHasActiveColumn(hasActive);
      setItems(rows.map((r) => ({ ...r, active: hasActive ? r.active ?? true : true })));
      setCategories(catRes.data ?? []);
      setLoading(false);
    }
    load();
  }, [workspaceId]);

  // Build month options from items + current/next 2 months for convenience
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    const now = new Date();
    for (let i = -2; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      set.add(ymKey(d));
    }
    items.forEach((it) => {
      const d = new Date(it.start_date);
      set.add(ymKey(d));
      if (it.end_date) set.add(ymKey(new Date(it.end_date)));
    });
    const arr = Array.from(set).sort();
    return arr;
  }, [items]);

  function monthOptionLabel(key: string) {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, 1).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });
  }

  const filtered = useMemo(() => {
    return items.filter((r) => {
      const isActive = r.active !== false;
      if (statusFilter === "active" && !isActive) return false;
      if (statusFilter === "inactive" && isActive) return false;

      if (monthFilter) {
        const [y, m] = monthFilter.split("-").map(Number);
        if (!occursInMonth(r, y, (m ?? 1) - 1)) return false;
      }
      return true;
    });
  }, [items, statusFilter, monthFilter]);

  const activeCount = items.filter((r) => r.active !== false).length;
  const inactiveCount = items.length - activeCount;

  function startCreate(freq: Frequency) {
    setEditingId(null);
    setForm({ ...emptyForm, frequency: freq });
    setErrors({});
    setShowForm(true);
  }

  function openEdit(item: RecurringTransaction) {
    setEditingId(item.id);
    setForm({
      description: item.description,
      amount: String(item.amount / 100),
      type: item.type,
      category_id: item.category_id || "",
      frequency: item.frequency,
      start_date: item.start_date,
      end_date: item.end_date || "",
    });
    setErrors({});
    setShowForm(true);
  }

  function openDelete(id: string) {
    setDeletingId(id);
    setDeleteModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const amountFloat = parseFloat(form.amount.replace(",", "."));
    const parsed = recurringSchema.safeParse({
      description: form.description,
      amount: amountFloat,
      type: form.type,
      frequency: form.frequency,
      start_date: form.start_date,
      end_date: form.end_date || null,
      category_id: form.category_id || null,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (!workspaceId || !user) return;
    setSaving(true);

    const amountCents = Math.round(parsed.data.amount * 100);

    const payload = {
      description: parsed.data.description,
      amount: amountCents,
      type: parsed.data.type,
      frequency: parsed.data.frequency,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      category_id: parsed.data.category_id,
      next_run_date: parsed.data.start_date,
    };

    if (editingId) {
      const { data, error } = await supabase
        .from("recurring_transactions")
        .update(payload)
        .eq("id", editingId)
        .select()
        .single();

      if (error) {
        console.error("[Recurring] update error", error);
        setErrors({ description: error.message || t("errorSave") });
        setSaving(false);
        return;
      }
      setItems((prev) => prev.map((i) => (i.id === editingId ? { ...i, ...data } : i)));
      setEditingId(null);
      toast(t("recurringUpdated"));
    } else {
      const { data, error } = await supabase
        .from("recurring_transactions")
        .insert({ ...payload, workspace_id: workspaceId, created_by: user.id })
        .select()
        .single();

      if (error) {
        console.error("[Recurring] insert error", error);
        setErrors({ description: error.message || t("errorSave") });
        setSaving(false);
        return;
      }
      setItems((prev) => [...prev, { ...data, active: data.active ?? true }]);
      toast(t("recurringCreated"));
    }

    try {
      await materializeRecurring(workspaceId, user.id);
    } catch (err) {
      console.warn("[Recurring] materialize failed", err);
    }

    setForm(emptyForm);
    setErrors({});
    setSaving(false);
    setShowForm(false);
    const newAchs = await checkAchievements();
    if (newAchs && newAchs.length > 0) setNewAchievement(newAchs[0]);
  }

  async function handleDelete() {
    if (!deletingId) return;
    setSaving(true);
    await supabase.from("recurring_transactions").delete().eq("id", deletingId);
    setItems((prev) => prev.filter((i) => i.id !== deletingId));
    setSaving(false);
    setDeleteModalOpen(false);
    setDeletingId(null);
    toast(t("recurringDeleted"));
  }

  async function toggleActive(item: RecurringTransaction) {
    const next = !(item.active !== false);
    // Optimistic
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, active: next } : i)));

    const { error } = await supabase
      .from("recurring_transactions")
      .update({ active: next })
      .eq("id", item.id);

    if (error) {
      console.warn("[Recurring] toggle active failed", error.message);
      // Revert
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, active: !next } : i)));
      if (error.message?.toLowerCase().includes("active")) {
        setHasActiveColumn(false);
        toast(
          "Para pausar/ativar é necessário rodar a migração SQL: supabase/migrations-manual/20260430_recurring_active_flag.sql"
        );
      } else {
        toast(error.message || t("errorSave"));
      }
      return;
    }

    toast(next ? "Recorrência ativada" : "Recorrência pausada");
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
      {!permissions.canEdit && (
        <PermissionBanner
          reason={permissions.reason}
          hasPlan={permissions.hasPlan}
          isViewer={permissions.isViewer}
        />
      )}

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => startCreate("weekly")}
            disabled={!permissions.canEdit}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <Zap className="h-4 w-4 text-primary" /> Semanal
          </button>
          <button
            onClick={() => startCreate("monthly")}
            disabled={!permissions.canEdit}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Repeat className="h-4 w-4" /> Mensal
          </button>
        </div>
      </div>

      {!hasActiveColumn && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 rounded-xl px-4 py-3 text-sm">
          Para usar pausar/ativar, rode no Supabase:{" "}
          <code className="font-mono text-xs">
            supabase/migrations-manual/20260430_recurring_active_flag.sql
          </code>
        </div>
      )}

      {/* Filters */}
      <div className="bg-card border border-border rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Filter className="h-4 w-4" /> Filtros
        </div>

        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 capitalize"
            >
              <option value="">Todos os meses</option>
              {monthOptions.map((k) => (
                <option key={k} value={k} className="capitalize">
                  {monthOptionLabel(k)}
                </option>
              ))}
            </select>
          </div>

          <div className="inline-flex bg-background border border-border rounded-lg p-0.5 text-sm">
            {(
              [
                { key: "all", label: `Todas (${items.length})` },
                { key: "active", label: `Ativas (${activeCount})` },
                { key: "inactive", label: `Pausadas (${inactiveCount})` },
              ] as const
            ).map((s) => (
              <button
                key={s.key}
                onClick={() => setStatusFilter(s.key)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === s.key
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {(monthFilter || statusFilter !== "all") && (
            <button
              onClick={() => {
                setMonthFilter("");
                setStatusFilter("all");
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        {showForm && (
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="font-semibold text-foreground mb-5">
              {editingId ? t("editRecurring") : t("newRecurring")}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  {t("type")}
                </label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm({ ...form, type: e.target.value as "income" | "expense" })
                  }
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="expense">{t("expense")}</option>
                  <option value="income">{t("income")}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  {t("category")}
                </label>
                <select
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">{t("optional")}</option>
                  {categories
                    .filter((c) => c.type === form.type)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  {t("description")}
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={t("descPlaceholder")}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  maxLength={200}
                />
                {errors.description && (
                  <p className="text-xs text-destructive mt-1">{errors.description}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  {t("amount")}
                </label>
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
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  {t("frequency")}
                </label>
                <select
                  value={form.frequency}
                  onChange={(e) => setForm({ ...form, frequency: e.target.value as Frequency })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="weekly">{t("weekly")}</option>
                  <option value="biweekly">{freqLabels.biweekly}</option>
                  <option value="monthly">{t("monthly")}</option>
                  <option value="yearly">{t("yearly")}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  {t("startDate")}
                </label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {errors.start_date && (
                  <p className="text-xs text-destructive mt-1">{errors.start_date}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  {t("endDateOptional")}
                </label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    setForm(emptyForm);
                    setErrors({});
                  }}
                  className="flex-1 py-2.5 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-secondary transition-colors"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving || !permissions.canEdit}
                  className="flex-1 bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
                >
                  {saving ? t("saving") : editingId ? t("save") : t("add")}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* List */}
        <div
          className={`bg-card border border-border rounded-2xl overflow-hidden ${
            showForm ? "" : "lg:col-span-2"
          }`}
        >
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-foreground">{t("myRecurring")}</h3>
            <span className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Repeat className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">
                {items.length === 0
                  ? t("noRecurring")
                  : "Nenhuma recorrência corresponde aos filtros."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((item) => {
                const isIncome = item.type === "income";
                const isActive = item.active !== false;
                return (
                  <div
                    key={item.id}
                    className={`px-6 py-4 flex items-center justify-between group hover:bg-muted/30 transition-colors ${
                      !isActive ? "opacity-60" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground truncate">
                          {item.description}
                        </p>
                        <span
                          className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md ${
                            isActive
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {isActive ? "Ativa" : "Pausada"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {freqLabels[item.frequency] || item.frequency} · próx.{" "}
                        {fmt.date(item.next_run_date)}
                        {item.end_date && ` → ${fmt.date(item.end_date)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p
                        className={`text-sm font-bold ${
                          isIncome ? "text-emerald-500" : "text-rose-500"
                        }`}
                      >
                        {isIncome ? "+" : "-"}
                        {formatBRL(item.amount)}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleActive(item)}
                          disabled={!permissions.canEdit}
                          className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                          aria-label={isActive ? "Pausar" : "Ativar"}
                          title={isActive ? "Pausar" : "Ativar"}
                        >
                          {isActive ? (
                            <Pause className="h-3.5 w-3.5" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => openEdit(item)}
                          className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={tc("edit")}
                          title={tc("edit")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => openDelete(item.id)}
                          className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          aria-label={tc("delete")}
                          title={tc("delete")}
                        >
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

      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title={t("deleteTitle")}>
        <p className="text-muted-foreground mb-6">{t("deleteMessage")}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setDeleteModalOpen(false)}
            className="px-5 py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-secondary transition-colors"
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleDelete}
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-destructive text-destructive-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? t("deleting") : t("delete")}
          </button>
        </div>
      </Modal>

      <AchievementToast achievement={newAchievement} onDone={() => setNewAchievement(null)} />
    </div>
  );
}
