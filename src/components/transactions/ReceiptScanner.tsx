import { useState, useRef } from "react";
import { Camera, Upload, Loader2, Check, AlertCircle, X, ScanLine } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface ExtractedData {
  description: string;
  amount: number;
  date: string;
  type: "income" | "expense";
  category: string;
  confidence: number;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  type: string;
}

interface ReceiptScannerProps {
  categories: Category[];
  onExtracted: (data: ExtractedData) => void;
  onClose: () => void;
}

export function ReceiptScanner({ categories, onExtracted, onClose }: ReceiptScannerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ExtractedData | null>(null);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setError("");
    setResult(null);

    if (!file.type.startsWith("image/")) {
      setError("Selecione uma imagem (foto do recibo).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Imagem muito grande. Máximo 10MB.");
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setPreview(base64);
      await scanReceipt(base64);
    };
    reader.readAsDataURL(file);
  }

  async function scanReceipt(imageBase64: string) {
    setScanning(true);
    setError("");

    try {
      const { data, error: fnError } = await supabase.functions.invoke("scan-receipt", {
        body: {
          image: imageBase64,
          categories: categories.map((c) => ({ name: c.name, icon: c.icon, type: c.type })),
        },
      });

      if (fnError) throw fnError;
      if (data?.error) {
        setError(data.error);
        return;
      }

      setResult(data as ExtractedData);
    } catch (err) {
      console.error("Scan error:", err);
      setError("Erro ao processar a imagem. Tente novamente com uma foto mais nítida.");
    } finally {
      setScanning(false);
    }
  }

  function handleConfirm() {
    if (!result) return;
    onExtracted(result);
  }

  function reset() {
    setPreview(null);
    setResult(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      {/* Upload area */}
      {!preview && (
        <>
          <p className="text-sm text-muted-foreground">
            Tire uma foto do recibo ou nota fiscal. A IA vai extrair o valor, data e categoria automaticamente.
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
              <span className="text-sm font-medium text-foreground">Tirar foto</span>
              <span className="text-xs text-muted-foreground">Câmera do celular</span>
            </button>

            <button
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Escolher arquivo</span>
              <span className="text-xs text-muted-foreground">Da galeria</span>
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
        </>
      )}

      {/* Preview + scanning */}
      {preview && (
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden border border-border">
            <img
              src={preview}
              alt="Recibo"
              className="w-full max-h-48 object-contain bg-muted/30"
            />
            {scanning && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                <div className="relative">
                  <ScanLine className="h-10 w-10 text-primary animate-pulse" />
                </div>
                <p className="text-sm font-medium text-foreground">Analisando recibo...</p>
                <p className="text-xs text-muted-foreground">A IA está extraindo os dados</p>
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

          {/* Extracted result */}
          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-emerald-500" />
                <span className="font-medium text-foreground">Dados extraídos</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  Confiança: {result.confidence}%
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50">
                  <span className="text-xs text-muted-foreground block mb-0.5">Descrição</span>
                  <span className="font-medium text-foreground">{result.description || "—"}</span>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <span className="text-xs text-muted-foreground block mb-0.5">Valor</span>
                  <span className="font-bold text-foreground">
                    R$ {result.amount?.toFixed(2).replace(".", ",")}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <span className="text-xs text-muted-foreground block mb-0.5">Data</span>
                  <span className="font-medium text-foreground">{result.date || "—"}</span>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <span className="text-xs text-muted-foreground block mb-0.5">Categoria</span>
                  <span className="font-medium text-foreground">{result.category || "—"}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={reset}
                  className="flex-1 py-2.5 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-secondary transition-colors"
                >
                  Tentar outra foto
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  Usar dados
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
