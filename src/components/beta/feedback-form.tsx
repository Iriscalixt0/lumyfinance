"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export function FeedbackForm({
  onSubmit,
  loading,
  placeholder = "Conte-nos o que achou do teste.",
}: {
  onSubmit: (text: string, npsScore?: number) => Promise<void>;
  loading: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [nps, setNps] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = text.trim();
    if (trimmed.length < 10) {
      setError("Escreva pelo menos 10 caracteres.");
      return;
    }
    await onSubmit(trimmed, nps ?? undefined);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* NPS */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">
          De 0 a 10, qual a chance de você recomendar o Lumyf?
        </p>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 11 }, (_, i) => i).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNps(n)}
              className={`h-9 w-9 rounded-lg text-sm font-medium border transition-colors ${
                nps === n
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border bg-background text-foreground hover:bg-muted/50"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        {nps !== null && (
          <p className="text-xs text-muted-foreground mt-1.5">
            {nps >= 9
              ? "Promotor — obrigado! 🎉"
              : nps >= 7
              ? "Neutro — o que poderíamos melhorar?"
              : "Detrator — queremos entender o que deu errado."}
          </p>
        )}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        required
        minLength={10}
        rows={4}
        className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
      />
      {error && (
        <p className="text-sm text-rose-600">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 font-medium hover:bg-muted/50 disabled:opacity-70"
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : null}
        {loading ? "Enviando..." : "Enviar feedback"}
      </button>
    </form>
  );
}
