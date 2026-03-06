import { useState, useEffect, useRef, useCallback } from "react";
import { Sparkles, ArrowRight, Pencil, Check, X, RefreshCw, Mic } from "lucide-react";
import { parseMagicInput, type MagicParsed } from "@/lib/utils/magic-parser";
import { recordCorrection } from "@/lib/utils/magic-learn";
import { convertCurrency, formatAmount, type CurrencyCode, DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from "@/lib/utils/exchange";
import { useIntlFormat } from "@/hooks/useIntlFormat";
import { useTranslations } from "@/lib/i18n";

interface ConversionResult {
  convertedCents: number;
  rate: number;
  timestamp: number;
}

interface MagicInputProps {
  baseCurrency?: CurrencyCode;
  onSubmit: (data: {
    description: string;
    amount: number; // in cents (base currency)
    type: "expense" | "income";
    date: string;
    category: string | null;
    currency: CurrencyCode;
    originalAmount?: number; // cents in original currency
    exchangeRate?: number;
  }) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MagicInput({ baseCurrency = DEFAULT_CURRENCY, onSubmit, disabled, placeholder }: MagicInputProps) {
  const t = useTranslations("magicInput");
  const fmt = useIntlFormat();
  const inputRef = useRef<HTMLInputElement>(null);

  const [rawInput, setRawInput] = useState("");
  const [parsed, setParsed] = useState<MagicParsed | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [conversion, setConversion] = useState<ConversionResult | null>(null);
  const [converting, setConverting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields in preview
  const [editDesc, setEditDesc] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState<string | null>(null);
  const [editType, setEditType] = useState<"expense" | "income">("expense");
  const [editDate, setEditDate] = useState("");
  const [categoryChanged, setCategoryChanged] = useState(false);

  // Parse on input change (debounced)
  useEffect(() => {
    if (!rawInput.trim()) {
      setParsed(null);
      setShowPreview(false);
      setConversion(null);
      return;
    }

    const timeout = setTimeout(() => {
      const result = parseMagicInput(rawInput, baseCurrency);
      setParsed(result);

      if (result.amount && result.description) {
        setEditDesc(result.description);
        setEditAmount(String(result.amount));
        setEditCategory(result.category);
        setEditType(result.type);
        setEditDate(result.date);
        setCategoryChanged(false);
        setShowPreview(true);

        // Convert currency if different from base
        if (result.currency && result.currency !== baseCurrency && result.amount) {
          fetchConversion(result.amount, result.currency);
        } else {
          setConversion(null);
        }
      } else {
        setShowPreview(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [rawInput, baseCurrency]);

  const fetchConversion = useCallback(async (amount: number, from: CurrencyCode) => {
    setConverting(true);
    try {
      const result = await convertCurrency(Math.round(amount * 100), from, baseCurrency);
      setConversion({
        convertedCents: result.convertedCents,
        rate: result.rate,
        timestamp: Date.now(),
      });
    } catch {
      setConversion(null);
    }
    setConverting(false);
  }, [baseCurrency]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && showPreview && parsed) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    const amount = parseFloat(editAmount);
    if (!amount || amount <= 0 || !editDesc.trim()) return;

    setSaving(true);

    // Record learning if category was manually changed
    if (categoryChanged && editCategory && parsed) {
      const learned = recordCorrection(editDesc, editCategory);
      if (learned) {
        // Could show a toast: "Regra aprendida!"
      }
    }

    const sourceCurrency = parsed?.currency || baseCurrency;
    let finalAmountCents = Math.round(amount * 100);
    let originalAmount: number | undefined;
    let exchangeRate: number | undefined;

    if (sourceCurrency !== baseCurrency && conversion) {
      originalAmount = finalAmountCents;
      finalAmountCents = conversion.convertedCents;
      exchangeRate = conversion.rate;
    }

    onSubmit({
      description: editDesc.trim(),
      amount: finalAmountCents,
      type: editType,
      date: editDate,
      category: editCategory,
      currency: sourceCurrency,
      originalAmount,
      exchangeRate,
    });

    // Reset
    setRawInput("");
    setParsed(null);
    setShowPreview(false);
    setConversion(null);
    setSaving(false);
    inputRef.current?.focus();
  };

  const handleCancel = () => {
    setShowPreview(false);
    inputRef.current?.focus();
  };

  const sourceCurrency = parsed?.currency || baseCurrency;
  const currencySymbol = SUPPORTED_CURRENCIES.find(c => c.code === sourceCurrency)?.symbol || "$";

  return (
    <div className="space-y-3">
      {/* Main magic input */}
      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || saving}
          placeholder={placeholder || t("placeholder")}
          className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-border bg-secondary/50 text-foreground text-sm font-medium placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all disabled:opacity-50"
          autoComplete="off"
        />
        {rawInput && !showPreview && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <button
              onClick={() => setRawInput("")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Currency conversion indicator */}
      {converting && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10 text-xs text-muted-foreground">
          <RefreshCw className="h-3 w-3 animate-spin" />
          {t("converting")}
        </div>
      )}

      {conversion && parsed?.currency && parsed.currency !== baseCurrency && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-primary/5 border border-primary/10 text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">
              1 {parsed.currency} = {conversion.rate.toFixed(4)} {baseCurrency}
            </span>
          </div>
          <span className="font-bold text-foreground">
            ≈ {formatAmount(conversion.convertedCents, baseCurrency)}
          </span>
        </div>
      )}

      {/* Preview card */}
      {showPreview && parsed && (
        <div
          className="bg-card border border-border rounded-2xl shadow-lg overflow-hidden transition-all duration-300 ease-out"
          style={{
            animation: "magic-preview-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          }}
        >
          <div className="p-4 space-y-3">
            {/* Type toggle */}
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setEditType("expense")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  editType === "expense"
                    ? "bg-destructive/10 text-destructive border border-destructive/20"
                    : "text-muted-foreground hover:bg-secondary border border-transparent"
                }`}
              >
                {t("expense")}
              </button>
              <button
                type="button"
                onClick={() => setEditType("income")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  editType === "income"
                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                    : "text-muted-foreground hover:bg-secondary border border-transparent"
                }`}
              >
                {t("income")}
              </button>
            </div>

            {/* Amount */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground font-medium">{currencySymbol}</span>
              <input
                type="text"
                inputMode="decimal"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="flex-1 text-2xl font-extrabold text-foreground bg-transparent outline-none tabular-nums"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("description")}</label>
              <input
                type="text"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full mt-0.5 text-sm font-semibold text-foreground bg-transparent outline-none border-b border-border focus:border-primary transition-colors pb-1"
              />
            </div>

            {/* Category + Date row */}
            <div className="flex items-center gap-3">
              {/* Category */}
              <div className="flex-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("category")}</label>
                <input
                  type="text"
                  value={editCategory || ""}
                  onChange={(e) => {
                    setEditCategory(e.target.value || null);
                    setCategoryChanged(true);
                  }}
                  placeholder={t("categoryPlaceholder")}
                  className="w-full mt-0.5 text-xs font-medium text-foreground bg-transparent outline-none border-b border-border focus:border-primary transition-colors pb-1"
                />
              </div>

              {/* Date */}
              <div className="w-32">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("date")}</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full mt-0.5 text-xs font-medium text-foreground bg-transparent outline-none border-b border-border focus:border-primary transition-colors pb-1"
                />
              </div>
            </div>

            {/* Detected info chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {editCategory && (
                <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  🤖 {editCategory}
                </span>
              )}
              {parsed.currency && parsed.currency !== baseCurrency && (
                <span className="text-[10px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                  {parsed.currency} → {baseCurrency}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                {parsed.detectedLang}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex border-t border-border">
            <button
              onClick={handleCancel}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              {t("cancel")}
            </button>
            <div className="w-px bg-border" />
            <button
              onClick={handleSubmit}
              disabled={saving || !editAmount || !editDesc}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  {t("save")}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
