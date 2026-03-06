import { useState, useCallback, useEffect } from "react";
import { Mic, MicOff, Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useIntlFormat } from "@/hooks/useIntlFormat";
import { useTranslations } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { useGamification } from "@/hooks/useGamification";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { parseVoiceTransaction, type VoiceParsedTransaction } from "@/lib/utils/voice-parser";

/** Category prediction keywords (same as QuickTransactionModal) */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Alimentação": ["mercado", "supermercado", "restaurante", "lanche", "ifood", "padaria", "pizza", "burger", "café", "almoço", "jantar", "comida"],
  "Transporte": ["uber", "99", "gasolina", "combustível", "estacionamento", "pedágio", "ônibus", "metrô", "taxi"],
  "Moradia": ["aluguel", "condomínio", "iptu", "luz", "água", "gás", "internet", "energia"],
  "Saúde": ["farmácia", "médico", "dentista", "hospital", "plano de saúde", "remédio", "consulta"],
  "Educação": ["curso", "escola", "faculdade", "livro", "material", "mensalidade"],
  "Lazer": ["cinema", "show", "viagem", "netflix", "spotify", "jogo", "bar", "festa", "parque"],
  "Vestuário": ["roupa", "calçado", "tênis", "camisa", "vestido", "sapato"],
  "Investimento": ["cdb", "tesouro", "fundo", "ação", "ações", "cripto", "bitcoin", "eth", "poupança", "lci", "lca", "debenture"],
  "Salário": ["salário", "pagamento", "freelance", "renda", "dividendo", "pix recebido"],
};

function predictCategory(description: string): string | null {
  const lower = description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return category;
  }
  return null;
}

type Stage = "idle" | "listening" | "confirm" | "saving" | "done" | "error";

export function VoiceFAB() {
  const t = useTranslations("voiceFAB");
  const fmt = useIntlFormat();
  const { activeWorkspace } = useWorkspace();
  const { recordActivity } = useGamification(activeWorkspace?.id ?? null);
  const { toast } = useToast();

  const [stage, setStage] = useState<Stage>("idle");
  const [parsed, setParsed] = useState<VoiceParsedTransaction | null>(null);
  const [autoSaveTimer, setAutoSaveTimer] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(5);

  const voiceLang = fmt.currency === "BRL" ? "pt-BR" : fmt.currency === "EUR" ? "es-ES" : "en-US";

  const handleResult = useCallback((transcript: string) => {
    const result = parseVoiceTransaction(transcript);
    setParsed(result);
    if (result.amount && result.description) {
      setStage("confirm");
      setCountdown(5);
    } else {
      toast(t("couldNotParse"), "error");
      setStage("idle");
    }
  }, [t, toast]);

  const handleError = useCallback((err: string) => {
    if (err === "no-speech") {
      toast(t("noSpeech"), "error");
    } else if (err === "not_supported") {
      toast(t("notSupported"), "error");
    } else {
      toast(t("voiceError"), "error");
    }
    setStage("idle");
  }, [t, toast]);

  const { listening, supported, start: startVoice, stop: stopVoice } = useVoiceInput({
    lang: voiceLang,
    onResult: handleResult,
    onError: handleError,
  });

  // Auto-save countdown
  useEffect(() => {
    if (stage !== "confirm") {
      if (autoSaveTimer) clearInterval(autoSaveTimer);
      return;
    }

    const interval = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSave();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    setAutoSaveTimer(interval);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const handleStartListening = () => {
    if (!activeWorkspace) {
      toast(t("noWorkspace"), "error");
      return;
    }
    setStage("listening");
    startVoice();
  };

  const handleCancel = () => {
    if (autoSaveTimer) clearInterval(autoSaveTimer);
    stopVoice();
    setParsed(null);
    setStage("idle");
  };

  const handleSave = async () => {
    if (!parsed || !activeWorkspace || !parsed.amount) return;
    if (autoSaveTimer) clearInterval(autoSaveTimer);
    setStage("saving");

    // Find category
    const categoryName = predictCategory(parsed.description) || predictCategory(parsed.raw);
    let categoryId: string | null = null;
    if (categoryName) {
      const { data: cats } = await supabase
        .from("categories")
        .select("id, name")
        .eq("workspace_id", activeWorkspace.id);
      const match = cats?.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
      categoryId = match?.id ?? null;
    }

    const { error } = await supabase.from("transactions").insert({
      workspace_id: activeWorkspace.id,
      description: parsed.description.trim(),
      amount: Math.round(parsed.amount * 100),
      type: parsed.type,
      date: parsed.date,
      category_id: categoryId,
      currency: fmt.currency,
    });

    if (error) {
      setStage("error");
      toast(t("saveError"), "error");
      setTimeout(() => setStage("idle"), 2000);
      return;
    }

    await recordActivity();
    setStage("done");
    toast(
      `✅ ${parsed.type === "income" ? "+" : "-"}${fmt.money(Math.round(parsed.amount * 100))} • ${parsed.description}`,
      "success"
    );
    setTimeout(() => {
      setStage("idle");
      setParsed(null);
    }, 2000);
  };

  if (!supported) return null;

  // Confirmation card
  if (stage === "confirm" && parsed) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-fade">
        <div className="bg-card border border-border rounded-2xl shadow-xl p-4 w-72">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("confirm")}</span>
            <span className="text-xs font-medium text-primary tabular-nums">{countdown}s</span>
          </div>

          {/* Parsed data */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("amount")}</span>
              <span className={`text-lg font-bold ${parsed.type === "income" ? "text-emerald-500" : "text-destructive"}`}>
                {parsed.type === "income" ? "+" : "-"}{fmt.money(Math.round((parsed.amount ?? 0) * 100))}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("whatFor")}</span>
              <span className="text-sm font-semibold text-foreground truncate max-w-[160px]">{parsed.description}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("date")}</span>
              <span className="text-sm text-foreground">{fmt.date(parsed.date)}</span>
            </div>
            {predictCategory(parsed.description) && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("category")}</span>
                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {predictCategory(parsed.description)}
                </span>
              </div>
            )}
          </div>

          {/* Transcript */}
          <p className="text-[10px] text-muted-foreground italic mb-3 line-clamp-2">"{parsed.raw}"</p>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              {t("cancel")}
            </button>
            <button
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all"
            >
              <Check className="h-3.5 w-3.5" />
              {t("saveNow")}
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-1 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${(countdown / 5) * 100}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Saving / Done states
  if (stage === "saving") {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center animate-pulse">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </div>
    );
  }

  if (stage === "done") {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center animate-fade">
          <Check className="h-6 w-6" />
        </div>
      </div>
    );
  }

  // Main FAB button
  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Hint tooltip */}
      {stage === "idle" && (
        <div className="absolute -top-10 right-0 bg-card border border-border text-foreground text-[10px] font-medium px-2.5 py-1 rounded-lg shadow-sm whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity pointer-events-none group-hover:opacity-100">
          {t("hint")}
        </div>
      )}

      <button
        onClick={stage === "listening" ? handleCancel : handleStartListening}
        className={`group h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          stage === "listening"
            ? "bg-destructive text-destructive-foreground animate-pulse scale-110 ring-4 ring-destructive/30"
            : "bg-primary text-primary-foreground hover:scale-105 active:scale-95 hover:shadow-xl"
        }`}
        aria-label={stage === "listening" ? t("stopListening") : t("startListening")}
        title={stage === "listening" ? t("stopListening") : t("startListening")}
      >
        {stage === "listening" ? (
          <MicOff className="h-6 w-6" />
        ) : (
          <Mic className="h-6 w-6" />
        )}
      </button>

      {/* Listening indicator */}
      {stage === "listening" && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-card border border-border text-foreground text-xs font-medium px-3 py-1.5 rounded-lg shadow-sm whitespace-nowrap animate-fade">
          <span className="inline-block h-2 w-2 rounded-full bg-destructive animate-pulse mr-1.5" />
          {t("listening")}
        </div>
      )}
    </div>
  );
}
