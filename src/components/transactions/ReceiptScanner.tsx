import { useState, useRef, useCallback } from "react";
import { Camera, Upload, Check, AlertCircle, X, Lock, ScanLine } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

interface ExtractedData {
  description: string;
  amount: number;
  date: string;
  type: "income" | "expense";
  category: string;
  confidence: number;
}

interface ReceiptScannerProps {
  onExtracted: (data: ExtractedData) => void;
  onClose: () => void;
}

/* ── Regex-based extraction from OCR text ── */
function extractReceiptData(text: string): Partial<ExtractedData> {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // 1. Extract total amount — look for "total" keywords near monetary values
  const totalPatterns = [
    /(?:total|total\s*a\s*pagar|valor\s*total|montant\s*total|gesamtbetrag|total\s*amount|grand\s*total|subtotal|importe)\s*:?\s*[$€£¥R\$]?\s*([\d.,]+)/i,
    /[$€£¥R\$]\s*([\d.,]+)\s*(?:total|total\s*a\s*pagar)/i,
  ];

  let amount: number | undefined;
  let allAmounts: number[] = [];

  // Collect all monetary values
  const moneyRegex = /[$€£¥]?\s*R?\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2}))/g;
  let match: RegExpExecArray | null;
  while ((match = moneyRegex.exec(text)) !== null) {
    const raw = match[1].replace(/\./g, "").replace(",", ".");
    const val = parseFloat(raw);
    if (!isNaN(val) && val > 0) allAmounts.push(val);
  }

  // Try total-specific patterns first
  for (const pattern of totalPatterns) {
    const m = text.match(pattern);
    if (m) {
      const raw = m[1].replace(/\./g, "").replace(",", ".");
      const val = parseFloat(raw);
      if (!isNaN(val) && val > 0) {
        amount = val;
        break;
      }
    }
  }

  // Fallback: largest amount
  if (!amount && allAmounts.length > 0) {
    amount = Math.max(...allAmounts);
  }

  // 2. Extract date
  const datePatterns = [
    /(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})/,  // DD/MM/YYYY or MM/DD/YYYY
    /(\d{4})[\/\-.](\d{2})[\/\-.](\d{2})/,  // YYYY-MM-DD
  ];

  let date: string | undefined;
  for (const pattern of datePatterns) {
    const m = text.match(pattern);
    if (m) {
      if (m[0].match(/^\d{4}/)) {
        date = `${m[1]}-${m[2]}-${m[3]}`;
      } else {
        // Assume DD/MM/YYYY
        const day = parseInt(m[1]), month = parseInt(m[2]);
        if (day > 12) {
          date = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
        } else if (month > 12) {
          date = `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
        } else {
          date = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
        }
      }
      break;
    }
  }

  // 3. Extract establishment (first significant line)
  let description = "";
  for (const line of lines) {
    // Skip very short lines, lines with only numbers/symbols, common headers
    if (line.length < 3) continue;
    if (/^[\d\s\-\/.,;:*#]+$/.test(line)) continue;
    if (/^(cupom|nota|fiscal|nf-?e|cnpj|cpf|ie|im|endereco|address|tel|fone|phone)/i.test(line)) continue;
    description = line.substring(0, 60);
    break;
  }

  // 4. Auto-categorize
  const lowerText = text.toLowerCase();
  const categoryMap: [string, RegExp][] = [
    ["Alimentação", /restaurante|café|coffee|lunch|dinner|supermercado|grocery|supermarché|lebensmittel|padaria|bakery|mercado|food|burger|pizza|sushi|bar\b/],
    ["Transporte", /uber|lyft|taxi|metro|ônibus|bus|gasolina|gas|fuel|posto|estacionamento|parking|essence|tankstelle/],
    ["Moradia", /aluguel|rent|loyer|miete|condomínio|luz|energia|elétrica|água|water|internet|gás/],
    ["Assinatura", /netflix|spotify|amazon|apple|google|youtube|disney|hbo|prime|icloud|subscription/],
    ["Saúde", /farmácia|pharmacy|médico|doctor|hospital|clínica|clinic|drogaria|consulta|dentista|dentist/],
    ["Compras", /loja|store|shopping|magazine|roupa|clothes|sapato|shoe|eletrônico|electronic/],
  ];

  let category = "";
  for (const [cat, regex] of categoryMap) {
    if (regex.test(lowerText)) {
      category = cat;
      break;
    }
  }

  const confidence = (amount ? 30 : 0) + (date ? 20 : 0) + (description ? 25 : 0) + (category ? 25 : 0);

  return {
    amount,
    date: date || new Date().toISOString().split("T")[0],
    description,
    category,
    type: "expense",
    confidence,
  };
}

export function ReceiptScanner({ onExtracted, onClose }: ReceiptScannerProps) {
  const t = useTranslations("receiptScanner");
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [result, setResult] = useState<ExtractedData | null>(null);
  const [error, setError] = useState("");

  const handleFile = useCallback(async (file: File) => {
    setError("");
    setResult(null);

    if (!file.type.startsWith("image/")) {
      setError(t("errorNotImage"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(t("errorTooLarge"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
      runOCR(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, [t]);

  const runOCR = useCallback(async (imageData: string) => {
    setScanning(true);
    setProgress(0);
    setProgressMsg(t("analyzing"));

    try {
      // Access Tesseract from CDN global
      const Tesseract = (window as any).Tesseract;
      if (!Tesseract) {
        throw new Error("Tesseract.js not loaded");
      }

      const worker = await Tesseract.createWorker("por+eng+spa+fra+deu", 1, {
        logger: (m: any) => {
          if (m.status === "recognizing text") {
            const pct = Math.round((m.progress || 0) * 100);
            setProgress(pct);
            if (pct < 30) setProgressMsg(t("analyzing"));
            else if (pct < 70) setProgressMsg(t("extracting"));
            else setProgressMsg(t("finishing"));
          }
        },
      });

      const { data } = await worker.recognize(imageData);
      await worker.terminate();

      const extracted = extractReceiptData(data.text);

      if (!extracted.amount && !extracted.description) {
        setError(t("errorNoData"));
        setScanning(false);
        return;
      }

      const finalResult: ExtractedData = {
        description: extracted.description || "",
        amount: extracted.amount || 0,
        date: extracted.date || new Date().toISOString().split("T")[0],
        type: "expense",
        category: extracted.category || "",
        confidence: extracted.confidence || 0,
      };

      setResult(finalResult);
    } catch (err) {
      console.error("OCR error:", err);
      setError(t("errorProcessing"));
    } finally {
      setScanning(false);
    }
  }, [t]);

  const handleConfirm = useCallback(() => {
    if (!result) return;
    onExtracted(result);
  }, [result, onExtracted]);

  const reset = useCallback(() => {
    setPreview(null);
    setResult(null);
    setError("");
    setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  return (
    <div className="space-y-4">
      {/* Upload area */}
      {!preview && (
        <>
          <p className="text-sm text-muted-foreground">
            {t("description")}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.capture = "environment";
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleFile(file);
                };
                input.click();
              }}
              className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer"
            >
              <Camera className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium text-foreground">{t("takePhoto")}</span>
              <span className="text-xs text-muted-foreground">{t("camera")}</span>
            </button>

            <button
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{t("chooseFile")}</span>
              <span className="text-xs text-muted-foreground">{t("gallery")}</span>
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
            className="hidden"
          />

          {/* Privacy notice */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
            <Lock className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-[11px] text-muted-foreground leading-tight">
              {t("privacyNotice")}
            </span>
          </div>
        </>
      )}

      {/* Preview + scanning */}
      {preview && (
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden border border-border">
            <img
              src={preview}
              alt="Receipt"
              className="w-full max-h-48 object-contain bg-muted/30"
            />
            {scanning && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 px-6">
                <ScanLine className="h-10 w-10 text-primary animate-pulse" />
                <p className="text-sm font-medium text-foreground">{progressMsg}</p>
                {/* Progress bar */}
                <div className="w-full max-w-xs h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">{progress}%</p>
              </div>
            )}
            {!scanning && (
              <button
                onClick={reset}
                className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded-full bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Privacy notice under preview */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
            <Lock className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-[11px] text-muted-foreground leading-tight">
              {t("privacyNotice")}
            </span>
          </div>

          {/* Extracted result */}
          {result && (
            <div className="space-y-3 animate-fade">
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-emerald-500" />
                <span className="font-medium text-foreground">{t("dataExtracted")}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {t("confidence")}: {result.confidence}%
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50">
                  <span className="text-xs text-muted-foreground block mb-0.5">{t("establishment")}</span>
                  <span className="font-medium text-foreground">{result.description || "—"}</span>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <span className="text-xs text-muted-foreground block mb-0.5">{t("amount")}</span>
                  <span className="font-bold text-foreground">
                    {result.amount?.toFixed(2)}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <span className="text-xs text-muted-foreground block mb-0.5">{t("date")}</span>
                  <span className="font-medium text-foreground">{result.date || "—"}</span>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <span className="text-xs text-muted-foreground block mb-0.5">{t("category")}</span>
                  <span className="font-medium text-foreground">{result.category || "—"}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={reset}
                  className="flex-1 py-2.5 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-secondary transition-colors"
                >
                  {t("tryAnother")}
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  {t("useData")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
