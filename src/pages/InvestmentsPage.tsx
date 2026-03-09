import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionBanner } from "@/components/ui/PermissionBanner";
import { useGamification, type AchievementDef } from "@/hooks/useGamification";
import { AchievementToast } from "@/components/gamification/AchievementToast";
import { useIntlFormat } from "@/hooks/useIntlFormat";
import { useTranslations } from "@/lib/i18n";
import {
  Plus, TrendingUp, Download, DollarSign, Clock, ChevronDown, Pencil, Trash2, BarChart3,
} from "lucide-react";
import { Link } from "react-router-dom";
import { downloadCSV } from "@/lib/utils/csv";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";

interface Investment {
  id: string;
  name: string;
  type: string;
  amount: number;
  current_value: number | null;
  date: string;
  notes: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  cdb: "CDB", lci: "LCI", lca: "LCA", tesouro: "Tesouro",
  acao: "Ação", fii: "FII", crypto: "Crypto", outro: "Outro",
};

export function InvestmentsPage() {
  const fmt = useIntlFormat();
  const formatBRL = fmt.money;
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const wsId = activeWorkspace?.id ?? null;
  const permissions = usePermissions();
  const { checkAchievements } = useGamification(wsId);
  const t = useTranslations("investmentsPage");
  const tc = useTranslations("common");
  const [newAchievement, setNewAchievement] = useState<AchievementDef | null>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const [periodType, setPeriodType] = useState("year");
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [filterCategory, setFilterCategory] = useState("all");

  const PERIOD_OPTIONS = useMemo(() => [
    { value: "year", label: t("byYear") },
    { value: "month", label: t("byMonth") },
    { value: "all", label: t("all") },
  ], [t]);

  const emptyForm = {
    name: "", type: "outro", amount: "", date: now.toISOString().split("T")[0],
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    async function load() {
      if (!wsId) { setLoading(false); return; }
      const { data } = await supabase.from("investments").select("*").eq("workspace_id", wsId).order("date", { ascending: false });
      setInvestments(data ?? []);
      setLoading(false);
    }
    load();
  }, [wsId]);

  const filtered = useMemo(() => {
    return investments.filter((inv) => {
      if (periodType === "year") {
        if (new Date(inv.date).getFullYear() !== selectedYear) return false;
      }
      if (filterCategory !== "all" && inv.type !== filterCategory) return false;
      return true;
    });
  }, [investments, periodType, selectedYear, filterCategory]);

  const totalInvested = useMemo(() => filtered.reduce((s, i) => s + i.amount, 0), [filtered]);
  const activeCount = filtered.length;
  const lastDate = useMemo(() => {
    if (!filtered.length) return null;
    return filtered.reduce((latest, i) => (i.date > latest ? i.date : latest), filtered[0].date);
  }, [filtered]);
  const totalFiltered = useMemo(() => filtered.reduce((s, i) => s + i.amount, 0), [filtered]);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i + 1);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsId || !form.name.trim()) return;
    setSaving(true);

    const amountCents = Math.round(parseFloat(form.amount.replace(",", ".")) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      toast(t("invalidValue"));
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("investments").insert({
      workspace_id: wsId, name: form.name.trim(), type: form.type,
      amount: amountCents, date: form.date, created_by: user!.id,
    });

    if (error) { toast(t("errorSave")); setSaving(false); return; }

    const { data } = await supabase.from("investments").select("*").eq("workspace_id", wsId).order("date", { ascending: false });
    setInvestments(data ?? []);
    setForm(emptyForm);
    setSaving(false);
    toast(t("contributionRegistered"));
    const newAchs = await checkAchievements();
    if (newAchs && newAchs.length > 0) setNewAchievement(newAchs[0]);
  };

  async function handleDelete() {
    if (!deletingId) return;
    setSaving(true);
    await supabase.from("investments").delete().eq("id", deletingId);
    setInvestments((prev) => prev.filter((i) => i.id !== deletingId));
    setSaving(false);
    setDeleteModalOpen(false);
    setDeletingId(null);
    toast(t("investmentDeleted"));
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

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
        <button
          onClick={() => {
            const rows = filtered.map((inv) => [
              fmt.date(inv.date), inv.name, TYPE_LABELS[inv.type] ?? inv.type,
              (inv.amount / 100).toFixed(2).replace(".", ","),
            ]);
            downloadCSV("investimentos.csv", [t("dateCol"), t("assetName"), t("categoryLabel"), t("valueCol")], rows);
          }}
          className="border border-border text-foreground font-medium px-3 py-2.5 rounded-xl text-sm hover:bg-secondary transition-colors flex items-center gap-2"
        >
          <Download className="h-4 w-4" /> {t("exportCsv")}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground font-medium">{t("period")}:</span>
        <select
          value={periodType}
          onChange={(e) => setPeriodType(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {PERIOD_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        {periodType === "year" && (
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-card border border-border rounded-lg px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {years.map((y) => (<option key={y} value={y}>{y}</option>))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("totalInvested")} ({periodType === "year" ? selectedYear : t("general")})
            </span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatBRL(totalInvested)}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("assetsInPeriod")}</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{activeCount} {t("assets")}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("lastContribution")}</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{lastDate ? fmt.date(lastDate) : t("none")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-semibold text-foreground mb-5 flex items-center gap-2">
            <Plus className="h-4 w-4" /> {t("newContribution")}
          </h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{t("date")}</label>
              <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{t("assetName")}</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t("assetNamePlaceholder")}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                maxLength={200} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{t("categoryLabel")}</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">
                {Object.entries(TYPE_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{t("valueLabel")}</label>
              <input type="text" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0,00"
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <button type="submit" disabled={saving || !permissions.canEdit}
              className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 text-sm">
              {saving ? t("saving") : t("confirmContribution")}
            </button>
          </form>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              {t("historyTitle")} ({periodType === "year" ? selectedYear : t("all")})
            </h3>
            <div className="flex items-center gap-2">
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none">
                <option value="all">{t("allCategories")}</option>
                {Object.entries(TYPE_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
              </select>
              <span className="text-xs text-muted-foreground">{t("total")}: {formatBRL(totalFiltered)}</span>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <TrendingUp className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground italic">{t("noInvestments")}</p>
            </div>
          ) : (
            <>
              <div className="px-6 py-2 border-b border-border grid grid-cols-4 gap-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t("dateCol")}</span>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t("assetCategory")}</span>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">{t("valueCol")}</span>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">{t("actions")}</span>
              </div>
              <div className="divide-y divide-border">
                {filtered.map((inv) => (
                  <div key={inv.id} className="px-6 py-3 grid grid-cols-4 gap-2 items-center group hover:bg-muted/30 transition-colors">
                    <span className="text-xs text-muted-foreground">{fmt.date(inv.date)}</span>
                    <div>
                      <p className="text-sm font-medium text-foreground truncate">{inv.name}</p>
                      <p className="text-xs text-muted-foreground">{TYPE_LABELS[inv.type] ?? inv.type}</p>
                    </div>
                    <p className="text-sm font-bold text-foreground text-right">{formatBRL(inv.amount)}</p>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setDeletingId(inv.id); setDeleteModalOpen(true); }}
                        className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        aria-label={tc("delete")}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-6 py-3 border-t border-border flex justify-end">
                <p className="text-xs text-muted-foreground">
                  {t("monthlyTotal")}: <span className="font-bold text-foreground">{formatBRL(totalFiltered)}</span>
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-primary rounded-2xl p-5 flex items-center justify-between">
        <div>
          <h3 className="text-primary-foreground font-bold text-lg">{t("wealthEvolution")}</h3>
          <p className="text-primary-foreground/80 text-sm">{t("wealthEvolutionDesc")}</p>
        </div>
        <Link to="/annual-report"
          className="bg-primary-foreground text-primary font-semibold px-4 py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> {t("viewCharts")}
        </Link>
      </div>

      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title={t("deleteTitle")}>
        <p className="text-muted-foreground mb-6">{t("deleteMessage")}</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteModalOpen(false)} className="px-5 py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-secondary transition-colors">{t("cancel")}</button>
          <button onClick={handleDelete} disabled={saving} className="px-5 py-2.5 rounded-lg bg-destructive text-destructive-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {saving ? t("deleting") : t("delete")}
          </button>
        </div>
      </Modal>

      <AchievementToast achievement={newAchievement} onDone={() => setNewAchievement(null)} />
    </div>
  );
}
