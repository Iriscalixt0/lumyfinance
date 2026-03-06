import { useState, useRef, useEffect } from "react";
import { X, Zap, Mic, MicOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useIntlFormat } from "@/hooks/useIntlFormat";
import { useTranslations, useLocale } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { useGamification } from "@/hooks/useGamification";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { parseVoiceTransaction, predictCategory } from "@/lib/utils/voice-parser";


interface QuickTransactionModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function QuickTransactionModal({ open, onClose, onSaved }: QuickTransactionModalProps) {
  const t = useTranslations("quickTransaction");
  const locale = useLocale();
  const fmt = useIntlFormat();
  const { activeWorkspace } = useWorkspace();
  const { recordActivity } = useGamification(activeWorkspace?.id ?? null);
  const { toast: showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [saving, setSaving] = useState(false);
  const [predictedCategory, setPredictedCategory] = useState<string | null>(null);

  // Voice input
  const voiceLang = locale === "pt-BR" ? "pt-BR" : locale === "pt-PT" ? "pt-PT" : locale === "es" ? "es-ES" : "en-US";
  const { listening, supported: voiceSupported, start: startVoice, stop: stopVoice } = useVoiceInput({
    lang: voiceLang,
    onResult: (transcript) => {
      const parsed = parseVoiceTransaction(transcript);
      if (parsed.amount) setAmount(String(parsed.amount));
      if (parsed.description) setDescription(parsed.description);
      setType(parsed.type);
      showToast(t("voiceRecognized"), "success");
    },
    onError: (err) => {
      if (err === "not_supported") showToast(t("voiceNotSupported"), "error");
      else if (err === "not-allowed" || err === "audio-capture") showToast(t("voiceMicDenied"), "error");
      else if (err !== "no-speech") showToast(t("voiceError"), "error");
    },
  });

  useEffect(() => {
    if (open) {
      setAmount("");
      setDescription("");
      setType("expense");
      setPredictedCategory(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (description.length >= 3) {
      setPredictedCategory(predictCategory(description));
    } else {
      setPredictedCategory(null);
    }
  }, [description]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !amount || !description) return;

    const numericAmount = parseFloat(amount.replace(",", "."));
    if (isNaN(numericAmount) || numericAmount <= 0) return;

    setSaving(true);

    // Find category id if predicted
    let categoryId: string | null = null;
    if (predictedCategory) {
      const { data: cats } = await supabase
        .from("categories")
        .select("id, name")
        .eq("workspace_id", activeWorkspace.id);
      const match = cats?.find(c => c.name.toLowerCase() === predictedCategory.toLowerCase());
      categoryId = match?.id ?? null;
    }

    const { error } = await supabase.from("transactions").insert({
      workspace_id: activeWorkspace.id,
      description: description.trim(),
      amount: Math.round(numericAmount * 100),
      type,
      date: new Date().toISOString().split("T")[0],
      category_id: categoryId,
      currency: fmt.currency,
    });

    if (error) {
      showToast(t("error"), "error");
      setSaving(false);
      return;
    }

    await recordActivity();
    showToast(t("saved"), "success");
    setSaving(false);
    onSaved?.();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-xl animate-fade mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-base font-bold text-foreground">{t("title")}</h2>
          </div>
          <div className="flex items-center gap-2">
            {voiceSupported && (
              <button
                type="button"
                onClick={listening ? stopVoice : startVoice}
                className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${
                  listening
                    ? "bg-destructive/10 text-destructive animate-pulse"
                    : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                }`}
                title={listening ? t("voiceStop") : t("voiceStart")}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Type toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType("expense")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                type === "expense"
                  ? "bg-destructive/10 text-destructive border border-destructive/30"
                  : "bg-secondary text-muted-foreground border border-transparent hover:bg-secondary/80"
              }`}
            >
              {t("expense")}
            </button>
            <button
              type="button"
              onClick={() => setType("income")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                type === "income"
                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                  : "bg-secondary text-muted-foreground border border-transparent hover:bg-secondary/80"
              }`}
            >
              {t("income")}
            </button>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t("howMuch")}</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                {fmt.currency === "BRL" ? "R$" : fmt.currency === "EUR" ? "€" : "$"}
              </span>
              <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-xl border border-input bg-secondary/50 pl-10 pr-4 py-3 text-2xl font-bold text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t("whatFor")}</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("placeholder")}
              className="w-full rounded-xl border border-input bg-secondary/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              required
            />
          </div>

          {/* Voice hint */}
          {voiceSupported && !amount && !description && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Mic className="h-3 w-3" />
              {t("voiceHint")}
            </p>
          )}

          {predictedCategory && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
              <span className="text-xs text-primary font-medium">🤖 {t("predicted")}:</span>
              <span className="text-xs font-semibold text-foreground">{predictedCategory}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving || !amount || !description}
            className="w-full bg-primary text-primary-foreground font-semibold py-3.5 rounded-xl hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <div className="h-5 w-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Zap className="h-4 w-4" />
                {t("save")}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
