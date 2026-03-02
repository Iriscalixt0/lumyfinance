"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/logo";
import { User, Users, Building2, MoreHorizontal, Loader2, Link2, Copy } from "lucide-react";
import {
  saveOnboardingIntent,
  updateWorkspaceName,
  completeOnboarding,
} from "@/actions/onboarding";
import { createWorkspaceInviteLink } from "@/actions/invites";
import { setTourPending } from "./guided-tour";

const INTENT_OPTIONS = [
  { id: "personal" as const, icon: User },
  { id: "family" as const, icon: Users },
  { id: "business" as const, icon: Building2 },
  { id: "other" as const, icon: MoreHorizontal },
];

const SUGGESTIONS: Record<string, string[]> = {
  personal: ["Minhas Financas", "Financeiro Pessoal", "Meu Controle"],
  family: ["Familia Silva", "Casa", "Familia"],
  business: ["Empresa X", "Meu Negocio", "Financeiro Empresa"],
  other: ["Nossas Financas", "Equipe", "Compartilhado"],
};

type Intent = "personal" | "family" | "business" | "other";

interface OnboardingStepsProps {
  initialIntent: Intent | null;
  defaultWorkspaceId: string | null;
  defaultWorkspaceName: string;
  isBetaWorkspace?: boolean;
}

export function OnboardingSteps({
  initialIntent,
  defaultWorkspaceId,
  defaultWorkspaceName,
  isBetaWorkspace = false,
}: OnboardingStepsProps) {
  const router = useRouter();
  const t = useTranslations("onboarding");
  const [step, setStep] = useState(1);
  const [intent, setIntent] = useState<Intent | null>(initialIntent);
  const [workspaceName, setWorkspaceName] = useState(defaultWorkspaceName);
  const [intentDetail, setIntentDetail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  async function handleSelectIntent(selected: Intent) {
    setIntent(selected);
    setError(null);
    setLoading(true);
    try {
      await saveOnboardingIntent(selected, selected === "other" ? intentDetail : null);
      setStep(isBetaWorkspace ? 3 : 2);
      const suggestions = SUGGESTIONS[selected];
      if (suggestions?.length) setWorkspaceName(suggestions[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  async function handleWorkspaceSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!defaultWorkspaceId) return;
    setError(null);
    setLoading(true);
    try {
      if (intent) {
        await saveOnboardingIntent(intent, intent === "other" ? intentDetail : null);
      }
      await updateWorkspaceName(defaultWorkspaceId, workspaceName);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete() {
    setError(null);
    setLoading(true);
    try {
      setTourPending();
      await completeOnboarding();
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao concluir");
      setLoading(false);
    }
  }

  async function handleSkip() {
    setError(null);
    setLoading(true);
    try {
      await completeOnboarding();
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao pular");
      setLoading(false);
    }
  }

  async function handleInviteNow() {
    if (!defaultWorkspaceId || !partnerName.trim()) return;
    setInviteLoading(true);
    setInviteError(null);
    setInviteCopied(false);
    const result = await createWorkspaceInviteLink(
      defaultWorkspaceId,
      partnerName.trim(),
      "viewer",
      partnerEmail.trim() ? partnerEmail.trim() : null
    );
    setInviteLoading(false);
    if (!result.ok) {
      setInviteError(result.error ?? t("inviteNowError"));
      return;
    }
    setInviteLink(result.inviteUrl);
  }

  async function handleCopyInviteLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 1800);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border p-5">
        <div className="flex items-start justify-between gap-4">
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-2 text-xl font-bold tracking-tight text-foreground"
          >
            <Logo size="sm" />
            <span className="text-gradient-hero">Lumyf</span>
          </Link>
          <button
            type="button"
            onClick={handleSkip}
            disabled={loading}
            className="shrink-0 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            {t("skip")}
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${step >= s ? "bg-primary" : "bg-secondary"}`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs font-medium text-muted-foreground">{t("stepOf", { current: step })}</p>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-5 py-8 sm:py-12">
        {step === 1 && (
          <div className="w-full animate-fade">
            <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t("whoUse")}</h1>
            <p className="mb-8 text-muted-foreground">{t("chooseOption")}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {INTENT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectIntent(opt.id)}
                  disabled={loading}
                  className={`flex flex-col items-start gap-2 rounded-2xl border-2 p-5 text-left transition-all hover:border-primary/50 ${
                    intent === opt.id ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-secondary/50"
                  }`}
                >
                  <opt.icon className="h-6 w-6 text-primary" />
                  <span className="font-semibold text-foreground">{t(`intents.${opt.id}`)}</span>
                  <span className="text-sm text-muted-foreground">{t(`intents.${opt.id}Desc`)}</span>
                </button>
              ))}
            </div>
            {intent === "other" && (
              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Qual o motivo principal de acesso?
                </label>
                <input
                  type="text"
                  value={intentDetail}
                  onChange={(e) => setIntentDetail(e.target.value)}
                  maxLength={220}
                  placeholder="Ex: gestão de equipe, projeto compartilhado"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}
            {error && (
              <p className="mt-4 text-sm font-medium text-rose-600" role="alert">
                {error}
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="w-full animate-fade">
            <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t("workspaceName")}</h1>
            <p className="mb-6 text-muted-foreground">{t("workspaceNameDesc")}</p>
            <form onSubmit={handleWorkspaceSubmit} className="space-y-4">
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder={t("placeholderName")}
                required
                maxLength={100}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {intent && SUGGESTIONS[intent]?.length ? (
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS[intent].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setWorkspaceName(s)}
                      className="rounded-lg bg-secondary px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : null}

              {intent === "family" && defaultWorkspaceId && (
                <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{t("inviteNowTitle")}</h3>
                    <p className="text-xs text-muted-foreground">{t("inviteNowDesc")}</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      value={partnerName}
                      onChange={(e) => setPartnerName(e.target.value)}
                      placeholder={t("inviteNowNamePlaceholder")}
                      maxLength={80}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <input
                      type="email"
                      value={partnerEmail}
                      onChange={(e) => setPartnerEmail(e.target.value)}
                      placeholder={t("inviteNowEmailPlaceholder")}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleInviteNow}
                    disabled={inviteLoading || !partnerName.trim()}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary/50 disabled:opacity-60"
                  >
                    {inviteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                    {inviteLoading ? t("inviteNowGenerating") : t("inviteNowButton")}
                  </button>
                  {inviteLink && (
                    <div className="rounded-lg border border-border bg-background p-2.5">
                      <p className="mb-2 text-xs text-muted-foreground">{t("inviteNowLinkReady")}</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={inviteLink}
                          className="flex-1 rounded-md border border-border bg-secondary/30 px-2 py-1.5 text-xs text-foreground"
                        />
                        <button
                          type="button"
                          onClick={handleCopyInviteLink}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/50"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {inviteCopied ? t("inviteNowCopied") : t("inviteNowCopy")}
                        </button>
                      </div>
                    </div>
                  )}
                  {inviteError && (
                    <p className="text-xs font-medium text-rose-600" role="alert">
                      {inviteError}
                    </p>
                  )}
                </div>
              )}

              {error && (
                <p className="text-sm font-medium text-rose-600" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-hero-gradient py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("saving")}
                  </>
                ) : (
                  t("continue")
                )}
              </button>
            </form>
          </div>
        )}

        {step === 3 && (
          <div className="w-full animate-fade">
            <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t("readyTitle")}</h1>
            <p className="mb-6 text-muted-foreground">{t("readyDesc")}</p>
            <button
              type="button"
              onClick={handleComplete}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-hero-gradient py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("entering")}
                </>
              ) : (
                t("seeTourInApp")
              )}
            </button>
            {error && (
              <p className="mt-4 text-center text-sm font-medium text-rose-600" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
