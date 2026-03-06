import { useState, useCallback, useEffect, useRef } from "react";
import { Mic, Check, X, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useIntlFormat } from "@/hooks/useIntlFormat";
import { useTranslations, useLocale } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { useGamification } from "@/hooks/useGamification";
import { useHybridVoice } from "@/hooks/useHybridVoice";
import { useVoiceInput, speak } from "@/hooks/useVoiceInput";
import { buildVoiceResponse } from "@/lib/utils/voice-response";
import {
  parseVoiceTransaction,
  predictCategory,
  buildConfirmationPhrase,
  YES_WORDS,
  NO_WORDS,
  type VoiceParsedTransaction,
} from "@/lib/utils/voice-parser";

const LOCALE_TO_VOICE: Record<string, string> = {
  "pt-BR": "pt-BR",
  "pt-PT": "pt-PT",
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
};

type Stage = "idle" | "listening" | "confirm" | "voice-confirm" | "saving" | "done" | "error";

export function VoiceFAB() {
  const t = useTranslations("voiceFAB");
  const locale = useLocale();
  const fmt = useIntlFormat();
  const { activeWorkspace } = useWorkspace();
  const { recordActivity } = useGamification(activeWorkspace?.id ?? null);
  const { toast } = useToast();

  const [stage, setStage] = useState<Stage>("idle");
  const [parsed, setParsed] = useState<VoiceParsedTransaction | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [interimText, setInterimText] = useState("");

  // Editable fields
  const [editAmount, setEditAmount] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCategory, setEditCategory] = useState<string | null>(null);

  // Missing field highlights (orange)
  const [missingAmount, setMissingAmount] = useState(false);
  const [missingDesc, setMissingDesc] = useState(false);

  const autoSaveRef = useRef<number | null>(null);

  // Stable refs for handleSave/handleCancel (used in voice confirm)
  const handleSaveRef = useRef<() => void>(() => {});
  const handleCancelRef = useRef<() => void>(() => {});

  const voiceLang = LOCALE_TO_VOICE[locale] || "en-US";

  // ========== Voice input handlers ==========

  const handleResult = useCallback((transcript: string) => {
    setInterimText("");
    const result = parseVoiceTransaction(transcript, voiceLang);
    setParsed(result);

    const hasAmount = result.amount !== null && result.amount > 0;
    const hasDesc = result.description.length > 0;

    setEditAmount(hasAmount ? String(result.amount) : "");
    setEditDesc(result.description);
    setEditCategory(predictCategory(result.description) || predictCategory(result.raw));
    setMissingAmount(!hasAmount);
    setMissingDesc(!hasDesc);

    if (hasAmount && hasDesc) {
      setStage("confirm");
      setCountdown(5);
      // TTS confirmation
      const amtStr = fmt.money(Math.round(result.amount! * 100));
      const cat = predictCategory(result.description) || result.description;
      const phrase = buildConfirmationPhrase(result.detectedLang, amtStr, cat);
      speak(phrase, result.detectedLang);
    } else {
      // Partial parse — show confirm card but highlight missing fields, no auto-save
      setStage("confirm");
      setCountdown(0); // no auto-save
    }
  }, [fmt, voiceLang]);

  const handleInterim = useCallback((transcript: string) => {
    setInterimText(transcript);
  }, []);

  const handleError = useCallback((err: string) => {
    setInterimText("");
    if (err === "no-speech") {
      toast(t("noSpeech"), "error");
    } else if (err === "not_supported" || err === "start-failed") {
      toast(t("notSupported"), "error");
    } else if (err === "not-allowed" || err === "service-not-allowed" || err === "audio-capture") {
      toast(t("micDenied"), "error");
    } else if (err === "network") {
      toast(t("networkError"), "error");
    } else {
      console.warn("[VoiceFAB] Voice error:", err);
      toast(t("voiceError"), "error");
    }
    setStage("idle");
  }, [t, toast]);

  const { listening, supported, start: startVoice, stop: stopVoice } = useHybridVoice({
    lang: voiceLang,
    onResult: handleResult,
    onInterim: handleInterim,
    onError: handleError,
  });

  // ========== Voice confirmation listener ==========

  const handleVoiceConfirm = useCallback((transcript: string) => {
    const lower = transcript.toLowerCase().trim();
    if (YES_WORDS.some(w => lower.includes(w))) {
      handleSaveRef.current();
    } else if (NO_WORDS.some(w => lower.includes(w))) {
      handleCancelRef.current();
    }
  }, []);

  const confirmVoice = useVoiceInput({
    lang: voiceLang,
    onResult: handleVoiceConfirm,
    onError: () => {}, // silent errors for confirmation
  });

  // Start voice confirmation listener after TTS
  useEffect(() => {
    if (stage === "voice-confirm") {
      const timeout = setTimeout(() => confirmVoice.start(), 500);
      return () => clearTimeout(timeout);
    }
  }, [stage, confirmVoice]);

  // ========== Auto-save countdown ==========

  useEffect(() => {
    if (stage !== "confirm" || countdown <= 0) {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
      return;
    }

    const interval = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSaveRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    autoSaveRef.current = interval;
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, countdown > 0]);

  // ========== Actions ==========

  const handleStartListening = async () => {
    if (!activeWorkspace) { toast(t("noWorkspace"), "error"); return; }
    setStage("listening");
    setMissingAmount(false);
    setMissingDesc(false);
    await startVoice();
  };

  // Sync stage when voice stops
  useEffect(() => {
    if (!listening && stage === "listening") {
      // Voice stopped but no result came — stay listening briefly for late results
    }
  }, [listening, stage]);

  const handleCancel = useCallback(() => {
    if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    stopVoice();
    confirmVoice.stop();
    setParsed(null);
    setInterimText("");
    setEditAmount("");
    setEditDesc("");
    setEditCategory(null);
    setMissingAmount(false);
    setMissingDesc(false);
    setStage("idle");
  }, [stopVoice, confirmVoice]);

  const handleSave = useCallback(async () => {
    const amount = parseFloat(editAmount);
    if (!amount || amount <= 0) { setMissingAmount(true); return; }
    if (!editDesc.trim()) { setMissingDesc(true); return; }
    if (!activeWorkspace) return;

    if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    confirmVoice.stop();
    setStage("saving");

    // Resolve category ID
    let categoryId: string | null = null;
    if (editCategory) {
      const { data: cats } = await supabase
        .from("categories")
        .select("id, name")
        .eq("workspace_id", activeWorkspace.id);
      const match = cats?.find(c => c.name.toLowerCase() === editCategory.toLowerCase());
      categoryId = match?.id ?? null;
    }

    const { error } = await supabase.from("transactions").insert({
      workspace_id: activeWorkspace.id,
      description: editDesc.trim(),
      amount: Math.round(amount * 100),
      type: parsed?.type || "expense",
      date: parsed?.date || new Date().toISOString().split("T")[0],
      category_id: categoryId,
      currency: parsed?.currency || fmt.currency,
    });

    if (error) {
      setStage("error");
      toast(t("saveError"), "error");
      setTimeout(() => setStage("idle"), 2000);
      return;
    }

    await recordActivity();

    // Voice budget feedback (non-blocking)
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      let monthlyTotal = 0;
      let budgetLimit: number | null = null;

      if (categoryId) {
        const { data: monthTx } = await supabase
          .from("transactions")
          .select("amount")
          .eq("workspace_id", activeWorkspace.id)
          .eq("category_id", categoryId)
          .gte("date", `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`)
          .lte("date", `${currentYear}-${String(currentMonth).padStart(2, "0")}-31`);
        if (monthTx) {
          monthlyTotal = monthTx.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        }

        const { data: budget } = await supabase
          .from("budgets")
          .select("limit_amount")
          .eq("workspace_id", activeWorkspace.id)
          .eq("category_id", categoryId)
          .eq("year", currentYear)
          .eq("month", currentMonth)
          .maybeSingle();
        if (budget) {
          const raw = budget.limit_amount;
          budgetLimit = raw > 10000 ? raw / 100 : raw;
        }
      }

      const voiceResponse = buildVoiceResponse({
        lang: voiceLang,
        amount,
        category: editCategory,
        monthlyTotal,
        budgetLimit,
        fmt,
      });
      if (voiceResponse) {
        speak(voiceResponse, voiceLang); // fire-and-forget
      }
    } catch {
      // Silent fail — just speak "Anotado!"
      try { speak(buildVoiceResponse({ lang: voiceLang, amount, category: null, monthlyTotal: 0, budgetLimit: null, fmt }), voiceLang); } catch {}
    }

    setStage("done");
    toast(
      `✅ ${parsed?.type === "income" ? "+" : "-"}${fmt.money(Math.round(amount * 100))} • ${editDesc}`,
      "success"
    );
    setTimeout(() => {
      setStage("idle");
      setParsed(null);
      setEditAmount("");
      setEditDesc("");
      setEditCategory(null);
    }, 2000);
  }, [editAmount, editDesc, editCategory, parsed, activeWorkspace, fmt, recordActivity, t, toast, confirmVoice]);

  // Keep refs in sync
  useEffect(() => { handleSaveRef.current = handleSave; }, [handleSave]);
  useEffect(() => { handleCancelRef.current = handleCancel; }, [handleCancel]);

  if (!supported) return null;

  // ========== Confirmation Card ==========
  if (stage === "confirm" && parsed) {
    const hasMissing = missingAmount || missingDesc;

    return (
      <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-50 animate-fade">
        <div className="bg-card border border-border rounded-2xl shadow-xl p-4 w-full sm:w-80 mx-auto sm:mx-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("confirm")}</span>
            {countdown > 0 && (
              <span className="text-xs font-medium text-primary tabular-nums">{countdown}s</span>
            )}
          </div>

          {/* Editable fields */}
          <div className="space-y-2.5 mb-4">
            {/* Amount */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("amount")}</label>
              <input
                type="number"
                inputMode="decimal"
                value={editAmount}
                onChange={(e) => { setEditAmount(e.target.value); setMissingAmount(false); }}
                className={`w-full mt-0.5 px-3 py-2 rounded-lg text-lg font-bold tabular-nums bg-secondary border transition-colors outline-none ${
                  missingAmount
                    ? "border-orange-400 bg-orange-50 dark:bg-orange-950/20 text-orange-600 ring-1 ring-orange-400/50"
                    : "border-border text-foreground focus:border-primary"
                }`}
                placeholder="0.00"
                autoFocus={missingAmount}
              />
              {missingAmount && (
                <div className="flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3 text-orange-500" />
                  <span className="text-[10px] text-orange-500 font-medium">{t("missingAmount")}</span>
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("whatFor")}</label>
              <input
                type="text"
                value={editDesc}
                onChange={(e) => { setEditDesc(e.target.value); setMissingDesc(false); }}
                className={`w-full mt-0.5 px-3 py-2 rounded-lg text-sm font-semibold bg-secondary border transition-colors outline-none ${
                  missingDesc
                    ? "border-orange-400 bg-orange-50 dark:bg-orange-950/20 text-orange-600 ring-1 ring-orange-400/50"
                    : "border-border text-foreground focus:border-primary"
                }`}
                placeholder={t("whatFor")}
                autoFocus={missingDesc && !missingAmount}
              />
              {missingDesc && (
                <div className="flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3 text-orange-500" />
                  <span className="text-[10px] text-orange-500 font-medium">{t("missingDesc")}</span>
                </div>
              )}
            </div>

            {/* Category + Currency (read-only display) */}
            <div className="flex items-center gap-2">
              {editCategory && (
                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {editCategory}
                </span>
              )}
              {parsed.currency && (
                <span className="text-xs font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                  {parsed.currency}
                </span>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {parsed.detectedLang}
              </span>
            </div>
          </div>

          {/* Raw transcript */}
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
              disabled={hasMissing && (!editAmount || !editDesc)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              {t("saveNow")}
            </button>
          </div>

          {/* Progress bar */}
          {countdown > 0 && (
            <div className="mt-3 h-1 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${(countdown / 5) * 100}%` }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ========== Saving / Done states ==========
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

  // ========== Main FAB ==========
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center justify-center">
      {stage === "listening" && (
        <>
          <span
            className="absolute h-14 w-14 rounded-full border-2 border-destructive pointer-events-none"
            style={{ animation: "voice-ripple 1.5s ease-out infinite" }}
          />
          <span
            className="absolute h-14 w-14 rounded-full border-2 border-destructive pointer-events-none"
            style={{ animation: "voice-ripple-delay 1.5s ease-out infinite 0.5s" }}
          />
        </>
      )}

      <button
        onClick={stage === "listening" ? handleCancel : handleStartListening}
        className={`relative group h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          stage === "listening"
            ? "bg-destructive text-destructive-foreground scale-110"
            : "bg-primary text-primary-foreground hover:scale-105 active:scale-95 hover:shadow-xl"
        }`}
        aria-label={stage === "listening" ? t("stopListening") : t("startListening")}
        title={stage === "listening" ? t("stopListening") : t("startListening")}
      >
        {stage === "listening" ? (
          <div className="flex items-center justify-center gap-[3px] h-6 w-6 text-destructive-foreground">
            <span className="voice-bar voice-bar-1 w-[3px]" />
            <span className="voice-bar voice-bar-2 w-[3px]" />
            <span className="voice-bar voice-bar-3 w-[3px]" />
            <span className="voice-bar voice-bar-4 w-[3px]" />
            <span className="voice-bar voice-bar-5 w-[3px]" />
          </div>
        ) : (
          <Mic className="h-6 w-6" />
        )}
      </button>

      {/* Live transcript bubble */}
      {stage === "listening" && (
        <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-card border border-border text-foreground text-xs font-semibold px-3 py-2 rounded-xl shadow-md animate-fade max-w-[280px]">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-destructive animate-pulse shrink-0" />
            {interimText ? (
              <span className="text-primary italic font-normal truncate">{interimText}</span>
            ) : (
              <span>{t("listening")}</span>
            )}
          </div>
        </div>
      )}

      {/* Idle hint */}
      {stage === "idle" && (
        <div className="absolute -top-10 right-0 bg-card border border-border text-foreground text-[10px] font-medium px-2.5 py-1 rounded-lg shadow-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {t("hint")}
        </div>
      )}
    </div>
  );
}
