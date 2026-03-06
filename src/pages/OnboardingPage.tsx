import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Logo } from "@/components/logo";
import { useI18n, LOCALES, type Locale } from "@/lib/i18n";
import { useTranslations } from "@/lib/i18n";
import { User, Users, Briefcase, Sparkles, ArrowRight, ArrowLeft, Check, Globe } from "lucide-react";

type Intent = "personal" | "family" | "business" | "other";

const FLAGS: Record<Locale, string> = {
  "pt-BR": "🇧🇷",
  "pt-PT": "🇵🇹",
  en: "🇺🇸",
  es: "🇪🇸",
  fr: "🇫🇷",
  de: "🇩🇪",
};

const LANG_LABELS: Record<Locale, string> = {
  "pt-BR": "Português (Brasil)",
  "pt-PT": "Português (Portugal)",
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
};

export function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { locale, setLocale } = useI18n();
  const t = useTranslations("onboarding");
  const tCommon = useTranslations("common");

  const [step, setStep] = useState(0); // 0 = language, 1 = intent, 2 = workspace name, 3 = confirm
  const [intent, setIntent] = useState<Intent | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [saving, setSaving] = useState(false);

  const INTENTS: { value: Intent; label: string; desc: string; icon: typeof User }[] = [
    { value: "personal", label: t("intentPersonal") || "Pessoal", desc: t("intentPersonalDesc") || "Controle individual de finanças", icon: User },
    { value: "family", label: t("intentFamily") || "Família / Casal", desc: t("intentFamilyDesc") || "Finanças compartilhadas em casa", icon: Users },
    { value: "business", label: t("intentBusiness") || "Pequeno negócio", desc: t("intentBusinessDesc") || "Controle financeiro empresarial", icon: Briefcase },
    { value: "other", label: t("intentOther") || "Outro", desc: t("intentOtherDesc") || "Explorar o que a plataforma oferece", icon: Sparkles },
  ];

  async function handleFinish() {
    if (!user || !intent || !workspaceName.trim()) return;
    setSaving(true);
    navigate("/dashboard");

    try {
      const slug = workspaceName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

      const [, wsRes] = await Promise.all([
        supabase
          .from("profiles")
          .update({
            onboarding_intent: intent,
            onboarding_completed_at: new Date().toISOString(),
            preferred_locale: locale,
          })
          .eq("id", user.id),
        supabase
          .from("workspaces")
          .insert({
            name: workspaceName.trim(),
            slug: slug || "meu-workspace",
            owner_id: user.id,
          })
          .select()
          .single(),
      ]);

      if (wsRes.error) throw wsRes.error;

      await supabase.from("workspace_members").insert({
        workspace_id: wsRes.data.id,
        user_id: user.id,
        role: "owner",
      });

      toast(t("welcome") || "Bem-vindo ao Lumyf! 🎉");
    } catch {
      toast(t("errorSetup") || "Erro ao configurar workspace. Acesse Configurações para tentar novamente.");
    }
  }

  const totalSteps = 4;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Logo size="sm" />
          <span className="text-xl font-bold text-gradient-hero">Lumyf</span>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {Array.from({ length: totalSteps }, (_, s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${
                s === step ? "w-10 bg-primary" : s < step ? "w-6 bg-primary/40" : "w-6 bg-border"
              }`}
            />
          ))}
        </div>

        {/* Step 0: Language Selection */}
        {step === 0 && (
          <div className="animate-fade space-y-6">
            <div className="text-center">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Globe className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Como prefere continuar?</h1>
              <p className="text-muted-foreground mt-2 text-sm">How would you like to continue? · ¿Cómo prefiere continuar?</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {LOCALES.map((loc) => {
                const selected = locale === loc;
                return (
                  <button
                    key={loc}
                    onClick={() => setLocale(loc)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30 bg-card"
                    }`}
                  >
                    <span className="text-2xl">{FLAGS[loc]}</span>
                    <p className="font-semibold text-foreground text-sm mt-2">{LANG_LABELS[loc]}</p>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setStep(1)}
              className="w-full bg-hero-gradient text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              {t("continue") || "Continuar"} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Step 1: Intent */}
        {step === 1 && (
          <div className="animate-fade space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground">{t("howToUse") || "Como você quer usar o Lumyf?"}</h1>
              <p className="text-muted-foreground mt-2">{t("howToUseDesc") || "Isso nos ajuda a personalizar sua experiência"}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {INTENTS.map((item) => {
                const Icon = item.icon;
                const selected = intent === item.value;
                return (
                  <button
                    key={item.value}
                    onClick={() => setIntent(item.value)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30 bg-card"
                    }`}
                  >
                    <Icon className={`h-6 w-6 mb-2 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="font-semibold text-foreground text-sm">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(0)}
                className="flex-1 border border-border bg-card text-foreground font-medium py-3 rounded-xl hover:bg-secondary transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" /> {tCommon("back") || "Voltar"}
              </button>
              <button
                onClick={() => intent && setStep(2)}
                disabled={!intent}
                className="flex-1 bg-hero-gradient text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {t("continue") || "Continuar"} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Workspace name */}
        {step === 2 && (
          <div className="animate-fade space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground">{t("nameWorkspace") || "Dê um nome ao seu espaço"}</h1>
              <p className="text-muted-foreground mt-2">{t("nameWorkspaceDesc") || "Você pode mudar depois nas configurações"}</p>
            </div>

            <div>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder={intent === "family" ? "Casa dos Silva" : intent === "business" ? "Minha Empresa" : "Minhas Finanças"}
                className="w-full bg-card border-2 border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors text-center text-lg font-medium"
                maxLength={50}
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 border border-border bg-card text-foreground font-medium py-3 rounded-xl hover:bg-secondary transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" /> {tCommon("back") || "Voltar"}
              </button>
              <button
                onClick={() => workspaceName.trim() && setStep(3)}
                disabled={!workspaceName.trim()}
                className="flex-1 bg-hero-gradient text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {t("continue") || "Continuar"} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div className="animate-fade space-y-6">
            <div className="text-center">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">{t("allReady") || "Tudo pronto!"}</h1>
              <p className="text-muted-foreground mt-2">{t("allReadyDesc") || "Vamos começar a organizar suas finanças"}</p>
            </div>

            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t("language") || "Idioma"}</span>
                <span className="text-sm font-medium text-foreground">{FLAGS[locale as Locale]} {LANG_LABELS[locale as Locale]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t("usage") || "Uso"}</span>
                <span className="text-sm font-medium text-foreground">{INTENTS.find(i => i.value === intent)?.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Workspace</span>
                <span className="text-sm font-medium text-foreground">{workspaceName}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 border border-border bg-card text-foreground font-medium py-3 rounded-xl hover:bg-secondary transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" /> {tCommon("back") || "Voltar"}
              </button>
              <button
                onClick={handleFinish}
                disabled={saving}
                className="flex-1 bg-hero-gradient text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (t("settingUp") || "Configurando...") : (t("start") || "Começar!")} <Sparkles className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
