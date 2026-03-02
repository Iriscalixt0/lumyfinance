"use client";

import { useState } from "react";
import { Loader2, Mail, CheckCircle } from "lucide-react";
import { joinWaitlist } from "@/actions/waitlist";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await joinWaitlist({ email: email.trim(), name: name.trim() || undefined });
    setLoading(false);
    if (result.ok) {
      setSuccess(true);
    } else {
      setError(result.error ?? "Erro ao entrar na lista. Tente novamente.");
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
          <CheckCircle className="h-6 w-6" />
        </div>
        <p className="font-semibold text-foreground">Você está na lista!</p>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Avisaremos por email assim que seu acesso estiver disponível.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 w-full max-w-md mx-auto">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Seu nome (opcional)"
        maxLength={80}
        className="flex-1 min-w-0 px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="seu@email.com"
        required
        className="flex-1 min-w-0 px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
      />
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 bg-hero-gradient text-primary-foreground font-semibold px-5 py-3 rounded-xl text-sm hover:opacity-90 transition-opacity disabled:opacity-70 whitespace-nowrap"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
        {loading ? "Enviando..." : "Entrar na lista"}
      </button>
      {error && (
        <p className="w-full text-sm text-rose-600 text-center sm:col-span-3">{error}</p>
      )}
    </form>
  );
}
