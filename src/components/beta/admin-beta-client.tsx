"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  createBetaProgram,
  deleteBetaProgram,
  endBetaProgram,
  finalizeBetaProgram,
  type BetaProgramWithParticipants,
} from "@/actions/beta";
import type {
  BetaConversionStats,
  BetaFeedbackItem,
  BetaLeadItem,
  OnboardingStats,
  UserLocaleStats,
} from "@/actions/admin";
import { triggerBetaConversionCampaign, type BetaCampaignStage } from "@/actions/beta-conversion";
import {
  Loader2,
  Copy,
  Plus,
  Trash2,
  Users,
  Calendar,
  Link2,
  MessageSquare,
  BarChart3,
  User,
  Mail,
  Globe,
  Download,
} from "lucide-react";

function exportFeedbacksToCSV(feedbacks: BetaFeedbackItem[]) {
  const header = ["Nome", "Email", "Programa", "NPS", "Feedback", "Assinou", "Data"];
  const rows = feedbacks.map((f) => {
    // Extrai NPS do prefixo "[NPS: X/10]" se existir
    const npsMatch = f.feedback_text.match(/^\[NPS:\s*(\d+)\/10\]/);
    const nps = npsMatch ? npsMatch[1] : "";
    const cleanText = f.feedback_text.replace(/^\[NPS:\s*\d+\/10\]\n\n?/, "");
    return [
      f.user_name,
      f.user_email ?? "",
      f.program_name,
      nps,
      `"${cleanText.replace(/"/g, '""')}"`,
      f.feedback_upgraded ? "Sim" : "Não",
      new Date(f.feedback_at).toLocaleString("pt-BR"),
    ];
  });

  const csv = [header, ...rows].map((r) => r.join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `feedbacks-beta-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportBetaLeadsToCSV(leads: BetaLeadItem[]) {
  const header = [
    "Nome",
    "Email",
    "WhatsApp",
    "Programa",
    "Status",
    "Opt-in Email",
    "Opt-in WhatsApp",
    "Bloqueado em",
    "Exclusao em",
    "Upgrade em",
    "Feedback em",
  ];
  const rows = leads.map((l) => [
    l.user_name,
    l.user_email ?? "",
    l.whatsapp_e164 ?? "",
    l.program_name,
    l.status,
    l.marketing_email_opt_in ? "Sim" : "Nao",
    l.marketing_whatsapp_opt_in ? "Sim" : "Nao",
    l.blocked_at ? new Date(l.blocked_at).toLocaleString("pt-BR") : "",
    l.data_delete_after ? new Date(l.data_delete_after).toLocaleString("pt-BR") : "",
    l.upgraded_at ? new Date(l.upgraded_at).toLocaleString("pt-BR") : "",
    l.feedback_at ? new Date(l.feedback_at).toLocaleString("pt-BR") : "",
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `beta-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const APP_URL = (typeof window !== "undefined" ? process.env.NEXT_PUBLIC_APP_URL : null) ?? "http://localhost:3000";

type TabId = "programs" | "feedbacks" | "onboarding" | "regions";

export function AdminBetaClient({
  programs: initialPrograms,
  feedbacks,
  onboardingStats,
  localeStats,
  conversionStats,
  betaLeads,
  initialTab = "programs",
}: {
  programs: BetaProgramWithParticipants[];
  feedbacks: BetaFeedbackItem[];
  onboardingStats: OnboardingStats;
  localeStats: UserLocaleStats;
  conversionStats: BetaConversionStats;
  betaLeads: BetaLeadItem[];
  initialTab?: TabId;
}) {
  const [programs, setPrograms] = useState(initialPrograms);
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  function switchTab(tab: TabId) {
    setActiveTab(tab);
    const url = new URL(pathname, window.location.origin);
    url.searchParams.set("tab", tab);
    router.replace(url.pathname + url.search);
  }
  const [loading, setLoading] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [createDays, setCreateDays] = useState(3);
  const [createMax, setCreateMax] = useState(200);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    setLoading("create");
    const result = await createBetaProgram({
      name: createName.trim(),
      durationDays: createDays,
      maxParticipants: createMax,
    });
    setLoading(null);
    if (result.ok) {
      setCreateName("");
      setCreateSuccess(result.inviteUrl);
      setPrograms((prev) => [
        {
          id: result.programId,
          name: createName.trim(),
          token: result.token,
          status: "active",
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + createDays * 24 * 60 * 60 * 1000).toISOString(),
          max_participants: createMax,
          created_at: new Date().toISOString(),
          participants: [],
          participantCount: 0,
        },
        ...prev,
      ]);
    } else {
      setCreateError(result.error ?? t("errorCreate"));
    }
  }

  async function handleEnd(programId: string) {
    setLoading(`end-${programId}`);
    const result = await endBetaProgram(programId);
    setLoading(null);
    if (result.ok) {
      setPrograms((prev) =>
        prev.map((p) =>
          p.id === programId ? { ...p, status: "ended" as const } : p
        )
      );
    }
  }

  async function handleFinalize(programId: string) {
    setLoading(`fin-${programId}`);
    const result = await finalizeBetaProgram(programId);
    setLoading(null);
    if (result.ok) {
      setPrograms((prev) =>
        prev.map((p) =>
          p.id === programId ? { ...p, status: "blocked" as const } : p
        )
      );
    }
  }

  async function handleTriggerCampaign(programId: string, stage: BetaCampaignStage) {
    setLoading(`campaign-${programId}-${stage}`);
    await triggerBetaConversionCampaign(programId, stage);
    setLoading(null);
  }

  const [programToDelete, setProgramToDelete] = useState<BetaProgramWithParticipants | null>(null);

  async function handleDelete(programId: string) {
    if (!programToDelete || programToDelete.id !== programId) return;
    setLoading(`del-${programId}`);
    const result = await deleteBetaProgram(programId);
    setLoading(null);
    setProgramToDelete(null);
    if (result.ok) {
      setPrograms((prev) => prev.filter((p) => p.id !== programId));
    } else {
      setCreateError(result.error ?? t("errorDelete"));
    }
  }

  function getInviteUrl(token: string) {
    const base = APP_URL.replace(/\/$/, "");
    return `${base}/${locale}/beta/${token}`;
  }

  function copyLink(token: string) {
    const url = getInviteUrl(token);
    navigator.clipboard.writeText(url);
  }

  const tabs = [
    { id: "programs" as const, label: t("tabs.programs"), icon: Users },
    { id: "feedbacks" as const, label: t("tabs.feedbacks"), icon: MessageSquare },
    { id: "onboarding" as const, label: t("tabs.onboarding"), icon: BarChart3 },
    { id: "regions" as const, label: t("tabs.regions"), icon: Globe },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1 p-1 rounded-xl bg-secondary/50 border border-border w-full max-w-2xl">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => switchTab(tab.id)}
            className={`flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon size={16} className="shrink-0" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "programs" && (
      <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("conv.totalBlocked")}</p>
          <p className="text-2xl font-bold text-foreground">{conversionStats.totalBlocked}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("conv.totalUpgraded")}</p>
          <p className="text-2xl font-bold text-foreground">{conversionStats.totalUpgraded}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("conv.expiringSoon")}</p>
          <p className="text-2xl font-bold text-amber-600">{conversionStats.expiringSoon}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("conv.sentTotal")}</p>
          <p className="text-2xl font-bold text-emerald-600">
            {conversionStats.channelSent.in_app + conversionStats.channelSent.email + conversionStats.channelSent.whatsapp}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => exportBetaLeadsToCSV(betaLeads)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          <Download size={15} />
          {t("conv.exportLeads")}
        </button>
        <span className="text-xs text-muted-foreground">
          {t("conv.leadsCount", { count: betaLeads.length })}
        </span>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          {t("newProgram")}
        </h2>
        <form onSubmit={handleCreate} className="space-y-4 max-w-md">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
              {t("name")}
            </label>
            <input
              id="name"
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              required
              minLength={2}
              maxLength={80}
              className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground"
              placeholder={t("placeholderName")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="days" className="block text-sm font-medium text-foreground mb-1">
                {t("durationDays")}
              </label>
              <input
                id="days"
                type="number"
                value={createDays}
                onChange={(e) => setCreateDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                min={1}
                max={90}
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground"
              />
            </div>
            <div>
              <label htmlFor="max" className="block text-sm font-medium text-foreground mb-1">
                {t("maxParticipants")}
              </label>
              <input
                id="max"
                type="number"
                value={createMax}
                onChange={(e) => setCreateMax(Math.max(1, parseInt(e.target.value, 10) || 1))}
                min={1}
                max={500}
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground"
              />
            </div>
          </div>
          {createError && (
            <p className="text-sm text-rose-600">{createError}</p>
          )}
          {createSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 text-emerald-700 text-sm">
              <Link2 size={16} />
              <span>{t("linkCreated")}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(createSuccess);
                }}
                className="ml-auto text-xs font-semibold hover:underline"
              >
                Copiar link
              </button>
            </div>
          )}
          <button
            type="submit"
            disabled={!!loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-70"
          >
            {loading === "create" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            {t("createProgram")}
          </button>
        </form>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{t("programs")}</h2>
        {programs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noPrograms")}</p>
        ) : (
          <div className="space-y-4">
            {programs.map((prog) => (
              <div
                key={prog.id}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-foreground">{prog.name}</h3>
                    <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Users size={14} />
                        {prog.participantCount}/{prog.max_participants}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={14} />
                        {t("until")} {new Date(prog.ends_at).toLocaleDateString(locale)}
                      </span>
                      <span
                        className={
                          prog.status === "active"
                            ? "text-emerald-600"
                            : prog.status === "ended"
                            ? "text-amber-600"
                            : "text-muted-foreground"
                        }
                      >
                        {prog.status === "active"
                          ? t("statusActive")
                          : prog.status === "ended"
                          ? t("statusEnded")
                          : t("statusBlocked")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyLink(prog.token)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/50"
                    >
                      <Copy size={14} />
                      {t("copyLink")}
                    </button>
                    {prog.status === "active" && (
                      <button
                        type="button"
                        onClick={() => handleEnd(prog.id)}
                        disabled={!!loading}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-700 text-sm hover:bg-amber-500/30 disabled:opacity-70"
                      >
                        {loading === `end-${prog.id}` ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : null}
                        {t("endTest")}
                      </button>
                    )}
                    {prog.status === "ended" && (
                      <button
                        type="button"
                        onClick={() => handleFinalize(prog.id)}
                        disabled={!!loading}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-700 text-sm hover:bg-rose-500/30 disabled:opacity-70"
                      >
                        {loading === `fin-${prog.id}` ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : null}
                        {t("finalize")}
                      </button>
                    )}
                    {prog.status === "blocked" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleTriggerCampaign(prog.id, "d0")}
                          disabled={!!loading}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/50 disabled:opacity-70"
                        >
                          {loading === `campaign-${prog.id}-d0` ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : null}
                          D0
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTriggerCampaign(prog.id, "d2")}
                          disabled={!!loading}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/50 disabled:opacity-70"
                        >
                          {loading === `campaign-${prog.id}-d2` ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : null}
                          D2
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTriggerCampaign(prog.id, "d7")}
                          disabled={!!loading}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/50 disabled:opacity-70"
                        >
                          {loading === `campaign-${prog.id}-d7` ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : null}
                          D7
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTriggerCampaign(prog.id, "d9")}
                          disabled={!!loading}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/50 disabled:opacity-70"
                        >
                          {loading === `campaign-${prog.id}-d9` ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : null}
                          D9
                        </button>
                      </>
                    )}
                    {prog.status === "blocked" && (
                      <button
                        type="button"
                        onClick={() => setProgramToDelete(prog)}
                        disabled={!!loading}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-300 text-rose-600 text-sm hover:bg-rose-500/10 disabled:opacity-70"
                        title={t("deleteTestTitle")}
                      >
                        <Trash2 size={14} />
                        {t("delete")}
                      </button>
                    )}
                  </div>
                </div>
                {prog.participants.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      {t("participants")}
                    </p>
                    <ul className="space-y-1 text-sm">
                      {prog.participants.map((p) => (
                        <li
                          key={p.id}
                          className="flex items-center justify-between"
                        >
                          <span>{p.profile.full_name}</span>
                          <span
                            className={
                              p.status === "upgraded"
                                ? "text-emerald-600"
                                : p.status === "feedback_given"
                                ? "text-muted-foreground"
                                : p.status === "blocked"
                                ? "text-rose-600"
                                : "text-amber-600"
                            }
                          >
                            {p.status === "upgraded"
                              ? t("participantUpgraded")
                              : p.status === "feedback_given"
                              ? t("participantFeedback")
                              : p.status === "blocked"
                              ? t("participantBlocked")
                              : t("statusActive")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
      )}

      {activeTab === "feedbacks" && (
        <div className="space-y-4">
          {feedbacks.length > 0 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => exportFeedbacksToCSV(feedbacks)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                <Download size={15} />
                Exportar CSV
              </button>
            </div>
          )}
          {feedbacks.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">
                {t("noFeedbacks")}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {feedbacks.map((f) => (
                <div
                  key={f.id}
                  className="rounded-xl border border-border bg-card p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{f.user_name}</p>
                        {f.user_email && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" />
                            {f.user_email}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {f.program_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span
                        className={`rounded-full px-2.5 py-1 font-medium ${
                          f.feedback_upgraded
                            ? "bg-emerald-500/15 text-emerald-700"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {f.feedback_upgraded ? t("feedbackUpgraded") : t("feedbackOnly")}
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(f.feedback_at).toLocaleDateString(locale, {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {f.feedback_text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "onboarding" && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            {t("onboardingTitle")}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {t("onboardingDesc")}
          </p>
          {onboardingStats.total === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {t("noOnboarding")}
            </p>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users size={16} />
                <span>Total: {onboardingStats.total} usuários completaram o onboarding</span>
              </div>
              <div className="space-y-4">
                {onboardingStats.byIntent.map((item) => (
                  <div key={item.intent}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-medium text-foreground">{item.label}</span>
                      <span className="text-muted-foreground">
                        {item.count} ({item.percentage}%)
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    {item.details && item.details.length > 0 && (
                      <ul className="mt-2 text-xs text-muted-foreground space-y-0.5 pl-2 border-l-2 border-muted">
                        {item.details.slice(0, 10).map((d, i) => (
                          <li key={i}>• {d}</li>
                        ))}
                        {item.details.length > 10 && (
                          <li>... e mais {item.details.length - 10}</li>
                        )}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "regions" && (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6 overflow-x-auto">
          <h2 className="text-lg font-semibold text-foreground mb-2 sm:mb-4">
            {t("regionsTitle")}
          </h2>
          <p className="text-sm text-muted-foreground mb-4 sm:mb-6">
            {t("regionsDesc")}
          </p>
          {localeStats.totalUsers === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {t("noRegionsData")}
            </p>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                <Users size={16} />
                {t("totalUsers")}: {localeStats.totalUsers}
              </span>
                {localeStats.totalWithGeolocation > 0 && (
                  <span className="rounded-full bg-emerald-500/15 text-emerald-700 px-2.5 py-1 font-medium">
                    {t("withGeolocation")}: {localeStats.totalWithGeolocation}
                  </span>
                )}
                <span className="rounded-full bg-amber-500/15 text-amber-700 px-2.5 py-1 font-medium">
                  {t("beta")}: {localeStats.totalBeta}
                </span>
                <span className="rounded-full bg-primary/15 text-primary px-2.5 py-1 font-medium">
                  {t("normal")}: {localeStats.totalNormal}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  {t("byLanguage")}
                </h3>
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full min-w-[320px] text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 sm:px-3 font-medium text-foreground">
                          {t("language")}
                        </th>
                        <th className="text-right py-2 px-2 sm:px-3 font-medium text-foreground">
                          Total
                        </th>
                        <th className="text-right py-2 px-2 sm:px-3 font-medium text-foreground hidden sm:table-cell">
                          Beta
                        </th>
                        <th className="text-right py-2 px-2 sm:px-3 font-medium text-foreground hidden sm:table-cell">
                          Normal
                        </th>
                        <th className="text-right py-2 px-2 sm:px-3 font-medium text-muted-foreground">
                          %
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {localeStats.byLocale.map((item) => (
                        <tr
                          key={item.locale}
                          className="border-b border-border/50 last:border-0"
                        >
                          <td className="py-2.5 px-2 sm:px-3 text-foreground">
                            {item.label}
                          </td>
                          <td className="text-right py-2.5 px-2 sm:px-3 tabular-nums">
                            {item.count}
                          </td>
                          <td className="text-right py-2.5 px-2 sm:px-3 tabular-nums text-amber-600 hidden sm:table-cell">
                            {item.beta}
                          </td>
                          <td className="text-right py-2.5 px-2 sm:px-3 tabular-nums text-primary hidden sm:table-cell">
                            {item.normal}
                          </td>
                          <td className="text-right py-2.5 px-2 sm:px-3 tabular-nums text-muted-foreground">
                            {item.percentage}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  {t("byCountry")}
                </h3>
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full min-w-[280px] text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 sm:px-3 font-medium text-foreground">
                          {t("country")}
                        </th>
                        <th className="text-right py-2 px-2 sm:px-3 font-medium text-foreground">
                          Total
                        </th>
                        <th className="text-right py-2 px-2 sm:px-3 font-medium text-foreground hidden sm:table-cell">
                          Beta
                        </th>
                        <th className="text-right py-2 px-2 sm:px-3 font-medium text-foreground hidden sm:table-cell">
                          Normal
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {localeStats.byCountry.map((item) => (
                        <tr
                          key={item.country}
                          className="border-b border-border/50 last:border-0"
                        >
                          <td className="py-2.5 px-2 sm:px-3 text-foreground">
                            {item.country}
                          </td>
                          <td className="text-right py-2.5 px-2 sm:px-3 tabular-nums">
                            {item.count}
                          </td>
                          <td className="text-right py-2.5 px-2 sm:px-3 tabular-nums text-amber-600 hidden sm:table-cell">
                            {item.beta}
                          </td>
                          <td className="text-right py-2.5 px-2 sm:px-3 tabular-nums text-primary hidden sm:table-cell">
                            {item.normal}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {localeStats.byRegion.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">
                    {t("byRegion")}
                  </h3>
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <table className="w-full min-w-[280px] text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-2 sm:px-3 font-medium text-foreground">
                            {t("region")}
                          </th>
                          <th className="text-right py-2 px-2 sm:px-3 font-medium text-foreground">
                            Total
                          </th>
                          <th className="text-right py-2 px-2 sm:px-3 font-medium text-foreground hidden sm:table-cell">
                            Beta
                          </th>
                          <th className="text-right py-2 px-2 sm:px-3 font-medium text-foreground hidden sm:table-cell">
                            Normal
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {localeStats.byRegion.map((item) => (
                          <tr
                            key={item.region}
                            className="border-b border-border/50 last:border-0"
                          >
                            <td className="py-2.5 px-2 sm:px-3 text-foreground">
                              {item.region}
                            </td>
                            <td className="text-right py-2.5 px-2 sm:px-3 tabular-nums">
                              {item.count}
                            </td>
                            <td className="text-right py-2.5 px-2 sm:px-3 tabular-nums text-amber-600 hidden sm:table-cell">
                              {item.beta}
                            </td>
                            <td className="text-right py-2.5 px-2 sm:px-3 tabular-nums text-primary hidden sm:table-cell">
                              {item.normal}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {localeStats.byCity.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">
                    {t("byCity")}
                  </h3>
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <table className="w-full min-w-[280px] text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-2 sm:px-3 font-medium text-foreground">
                            {t("city")}
                          </th>
                          <th className="text-right py-2 px-2 sm:px-3 font-medium text-foreground">
                            Total
                          </th>
                          <th className="text-right py-2 px-2 sm:px-3 font-medium text-foreground hidden sm:table-cell">
                            Beta
                          </th>
                          <th className="text-right py-2 px-2 sm:px-3 font-medium text-foreground hidden sm:table-cell">
                            Normal
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {localeStats.byCity.map((item) => (
                          <tr
                            key={item.city}
                            className="border-b border-border/50 last:border-0"
                          >
                            <td className="py-2.5 px-2 sm:px-3 text-foreground">
                              {item.city}
                            </td>
                            <td className="text-right py-2.5 px-2 sm:px-3 tabular-nums">
                              {item.count}
                            </td>
                            <td className="text-right py-2.5 px-2 sm:px-3 tabular-nums text-amber-600 hidden sm:table-cell">
                              {item.beta}
                            </td>
                            <td className="text-right py-2.5 px-2 sm:px-3 tabular-nums text-primary hidden sm:table-cell">
                              {item.normal}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {programToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
            <h3 className="text-lg font-bold text-foreground">{t("deleteTestTitle")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("deleteConfirm", { name: programToDelete.name })}
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setProgramToDelete(null)}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted/50"
              >
                {tCommon("cancel")}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(programToDelete.id)}
                disabled={!!loading}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-70 inline-flex items-center gap-2"
              >
                {loading === `del-${programToDelete.id}` ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                {t("delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
