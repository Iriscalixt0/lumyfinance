import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { z } from "zod";
import { MessageCircle, Mail, Phone, Send } from "lucide-react";

const supportSchema = z.object({
  subject: z.string().trim().min(1, "Assunto obrigatório").max(200),
  category: z.string().min(1, "Categoria obrigatória"),
  message: z.string().trim().min(10, "Mensagem deve ter pelo menos 10 caracteres").max(2000),
});

const CATEGORIES = [
  "Problema técnico",
  "Dúvida sobre o plano",
  "Sugestão de funcionalidade",
  "Erro na cobrança",
  "Outro",
];

export function SupportPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ subject: "", category: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const parsed = supportSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (!user) return;
    setSending(true);

    const { error } = await supabase.from("support_requests").insert({
      user_id: user.id,
      email: user.email!,
      subject: parsed.data.subject,
      category: parsed.data.category,
      message: parsed.data.message,
    });

    setSending(false);
    if (error) { toast("Erro ao enviar. Tente novamente."); return; }
    setSent(true);
    toast("Mensagem enviada com sucesso!");
  }

  if (sent) {
    return (
      <div className="animate-fade flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Send className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Recebemos sua mensagem!</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Nossa equipe vai analisar e responder o mais breve possível. Você receberá uma resposta por e-mail.
        </p>
        <button
          onClick={() => { setSent(false); setForm({ subject: "", category: "", message: "" }); }}
          className="text-primary font-medium hover:underline"
        >
          Enviar outra mensagem
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Suporte</h1>
        <p className="text-muted-foreground mt-1">Fale com nossa equipe</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Form */}
        <div className="md:col-span-2">
          <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Assunto</label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Descreva brevemente"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                maxLength={200}
              />
              {errors.subject && <p className="text-sm text-destructive mt-1">{errors.subject}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Categoria</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Selecione...</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {errors.category && <p className="text-sm text-destructive mt-1">{errors.category}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Mensagem</label>
              <textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Descreva o que aconteceu em detalhes..."
                rows={5}
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                maxLength={2000}
              />
              {errors.message && <p className="text-sm text-destructive mt-1">{errors.message}</p>}
            </div>
            <button
              type="submit"
              disabled={sending}
              className="bg-hero-gradient text-primary-foreground font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-2"
            >
              {sending ? "Enviando..." : "Enviar mensagem"} <Send className="h-4 w-4" />
            </button>
          </form>
        </div>

        {/* Contact channels */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground mb-3">Canais diretos</h3>
            <div className="space-y-3">
              <a href="mailto:suporte@lumyf.com" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Mail className="h-4 w-4" /> suporte@lumyf.com
              </a>
              <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
              <a href="tel:+5511999999999" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Phone className="h-4 w-4" /> (11) 99999-9999
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
