import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Logo } from "@/components/logo";
import { useI18n, LOCALES, type Locale } from "@/lib/i18n";
import { useTranslations } from "@/lib/i18n";
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY, type CurrencyCode } from "@/lib/utils/exchange";
import { User, Users, Briefcase, Sparkles, ArrowRight, ArrowLeft, Check, Globe, Coins } from "lucide-react";

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

const LOCALE_DEFAULT_CURRENCY: Record<Locale, CurrencyCode> = {
  "pt-BR": "BRL",
  "pt-PT": "EUR",
  en: "USD",
  es: "EUR",
  fr: "EUR",
  de: "EUR",
};

export function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { locale, setLocale } = useI18n();
  const t = useTranslations("onboarding");
  const tCommon = useTranslations("common");

  const [step, setStep] = useState(0); // 0 = language, 1 = currency, 2 = intent, 3 = workspace name, 4 = confirm
  const [intent, setIntent] = useState<Intent | null>(null);
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>(LOCALE_DEFAULT_CURRENCY[locale as Locale] ?? DEFAULT_CURRENCY);
  const [workspaceName, setWorkspaceName] = useState("");
  const [saving, setSaving] = useState(false);

  const INTENTS: { value: Intent; label: string; desc: string; icon: typeof User }[] = [
    { value: "personal", label: t("intentPersonal") || "Pessoal", desc: t("intentPersonalDesc") || "Controle individual de finanças", icon: User },
    { value: "family", label: t("intentFamily") || "Família / Casal", desc: t("intentFamilyDesc") || "Finanças compartilhadas em casa", icon: Users },
    { value: "business", label: t("intentBusiness") || "Pequeno negócio", desc: t("intentBusinessDesc") || "Controle financeiro empresarial", icon: Briefcase },
    { value: "other", label: t("intentOther") || "Outro", desc: t("intentOtherDesc") || "Explorar o que a plataforma oferece", icon: Sparkles },
  ];

  // Auto-update currency when locale changes
  function handleLocaleChange(loc: Locale) {
    setLocale(loc);
    setBaseCurrency(LOCALE_DEFAULT_CURRENCY[loc] ?? DEFAULT_CURRENCY);
  }

  async function handleFinish() {
    if (!user || !intent || !workspaceName.trim()) return;
    setSaving(true);

    try {
      const baseSlug =
        workspaceName
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "") || "meu-workspace";
      // Sufixo curto para evitar colisão com a constraint UNIQUE de slug
      const uniqueSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

      localStorage.setItem("lmyf_base_currency", baseCurrency);

      // 1) Garante um workspace inicial via função do banco (evita falhas de RLS no create member)
      const ensuredWorkspace = await supabase.rpc("ensure_user_workspace");
      if (ensuredWorkspace.error) throw ensuredWorkspace.error;
      if (!ensuredWorkspace.data) {
        throw new Error("Workspace inicial não pôde ser carregado");
      }

      // 2) Renomeia o workspace inicial com o nome escolhido no onboarding
      const wsRes = await supabase
        .from("workspaces")
        .update({
          name: workspaceName.trim(),
          slug: uniqueSlug,
        })
        .eq("id", ensuredWorkspace.data)
        .eq("owner_id", user.id)
        .select("id")
        .single();

      if (wsRes.error) throw wsRes.error;

      // 3) Atualiza apenas campos que existem em profiles
      const profileRes = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            onboarding_intent: intent,
            onboarding_completed_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
      if (profileRes.error) throw profileRes.error;

      // 4) Persiste o locale escolhido na tabela correta de preferências
      const preferenceRes = await supabase
        .from("profile_preferences")
        .upsert(
          {
            user_id: user.id,
            locale_hint: locale,
          },
          { onConflict: "user_id" }
        );
      if (preferenceRes.error) throw preferenceRes.error;

      localStorage.setItem("lmyf_active_ws", wsRes.data.id);

      toast(t("welcome") || "Bem-vindo ao Lumy! 🎉");
      navigate("/dashboard");
    } catch (err) {
      console.error("[onboarding] handleFinish failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast(`${t("errorSetup") || "Erro ao configurar workspace"}: ${msg}`);
      setSaving(false);
    }
  }

  const totalSteps = 5;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Logo size="sm" />
          <span className="text-xl font-bold text-gradient-hero">Lumy</span>
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
                    onClick={() => handleLocaleChange(loc)}
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

        {/* Step 1: Currency Selection */}
        {step === 1 && (
          <div className="animate-fade space-y-6">
            <div className="text-center">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Coins className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">{t("selectCurrency") || "Qual é sua moeda principal?"}</h1>
              <p className="text-muted-foreground mt-2 text-sm">{t("selectCurrencyDesc") || "Transações em outras moedas serão convertidas automaticamente"}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-[340px] overflow-y-auto pr-1">
              {SUPPORTED_CURRENCIES.map((cur) => {
                const selected = baseCurrency === cur.code;
                return (
                  <button
                    key={cur.code}
                    onClick={() => setBaseCurrency(cur.code)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30 bg-card"
                    }`}
                  >
                    <span className="text-lg">{cur.flag}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-sm">{cur.code}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{cur.name}</p>
                    </div>
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
                onClick={() => setStep(2)}
                className="flex-1 bg-hero-gradient text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                {t("continue") || "Continuar"} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Intent */}
        {step === 2 && (
          <div className="animate-fade space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground">{t("howToUse") || "Como você quer usar o Lumy?"}</h1>
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
                onClick={() => setStep(1)}
                className="flex-1 border border-border bg-card text-foreground font-medium py-3 rounded-xl hover:bg-secondary transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" /> {tCommon("back") || "Voltar"}
              </button>
              <button
                onClick={() => intent && setStep(3)}
                disabled={!intent}
                className="flex-1 bg-hero-gradient text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {t("continue") || "Continuar"} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Workspace name */}
        {step === 3 && (
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
                placeholder={intent === "family" ? (t("placeholderFamily") || "Casa dos Silva") : intent === "business" ? (t("placeholderBusiness") || "Minha Empresa") : (t("placeholderPersonal") || "Minhas Finanças")}
                className="w-full bg-card border-2 border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors text-center text-lg font-medium"
                maxLength={50}
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 border border-border bg-card text-foreground font-medium py-3 rounded-xl hover:bg-secondary transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" /> {tCommon("back") || "Voltar"}
              </button>
              <button
                onClick={() => workspaceName.trim() && setStep(4)}
                disabled={!workspaceName.trim()}
                className="flex-1 bg-hero-gradient text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {t("continue") || "Continuar"} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
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
                <span className="text-sm text-muted-foreground">{t("currency") || "Moeda"}</span>
                <span className="text-sm font-medium text-foreground">
                  {SUPPORTED_CURRENCIES.find(c => c.code === baseCurrency)?.flag} {baseCurrency}
                </span>
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
                onClick={() => setStep(3)}
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
