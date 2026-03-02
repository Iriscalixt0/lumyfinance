import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/components/ui/Toast";
import { z } from "zod";
import { MessageCircle, Send, Phone, Mail, Instagram } from "lucide-react";

const supportSchema = z.object({
  subject: z.string().trim().min(1, "Assunto obrigatório").max(200),
  category: z.string().min(1, "Categoria obrigatória"),
  message: z.string().trim().min(10, "Mensagem deve ter pelo menos 10 caracteres").max(2000),
  priority: z.string().min(1, "Prioridade obrigatória"),
});

const CATEGORIES = [
  { value: "bug", label: "Bug" },
  { value: "billing", label: "Cobrança" },
  { value: "feature", label: "Sugestão" },
  { value: "account", label: "Conta" },
  { value: "other", label: "Outro" },
];

const PRIORITIES = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
];

export function SupportPage() {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [form, setForm] = useState({
    subject: "",
    category: "",
    message: "",
    priority: "Média",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  const userEmail = user?.email || "";
  const wsName = activeWorkspace?.name || "";

  function buildMailto() {
    const subject = encodeURIComponent(
      `[${form.category || "Suporte"}] ${form.subject || "(sem assunto)"}`
    );
    const body = encodeURIComponent(
      `Workspace: ${wsName}\nE-mail: ${userEmail}\nCategoria: ${form.category}\nPrioridade: ${form.priority}\nAssunto: ${form.subject}\n\n${form.message}`
    );
    return `mailto:graphyx.s@gmail.com?subject=${subject}&body=${body}`;
  }

  function handleSubmit(e: React.FormEvent) {
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

    // Open mailto
    window.open(buildMailto(), "_blank");
    toast("Cliente de e-mail aberto!");
  }

  return (
    <div className="animate-fade space-y-6 max-w-xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Suporte</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Entre em contato por e-mail, WhatsApp ou redes sociais. Use o formulário abaixo para abrir o cliente de e-mail com assunto e a mensagem preenchidos.
        </p>
      </div>

      {/* ── Contato e formulário ── */}
      <section className="bg-card border border-border rounded-2xl p-5 space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <MessageCircle className="h-4 w-4 text-primary" />
            <h2 className="text-base font-bold text-foreground">Contato e formulário</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Compartilhe o e-mail e clique em envio, com assunto e a mensagem preenchidos.
          </p>
        </div>

        {/* Contato direto */}
        <div>
          <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Contato direto
          </label>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> +55 21 99066289
            </span>
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> graphyx.s@gmail.com
            </span>
          </div>
          <div className="flex gap-2 mt-2">
            <a
              href="https://wa.me/5521990066289"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </a>
            <a
              href="https://instagram.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <Instagram className="h-3.5 w-3.5" /> Instagram
            </a>
          </div>
        </div>

        {/* Divider */}
        <hr className="border-border" />

        {/* Formulário */}
        <p className="text-xs text-muted-foreground">
          Preencha os campos e clique em Enviar e-mail para abrir seu cliente de e-mail (Gmail, Outlook, etc.) com assunto e mensagem preenchidos.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Workspace + Email readonly */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                Workspace
              </label>
              <input
                type="text"
                readOnly
                value={wsName}
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground text-sm cursor-default focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                E-mail (preenchido)
              </label>
              <input
                type="email"
                readOnly
                value={userEmail}
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground text-sm cursor-default focus:outline-none"
              />
            </div>
          </div>

          {/* Assunto + Categoria */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                Assunto
              </label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Ex: Problema ao adicionar transação..."
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                maxLength={200}
              />
              {errors.subject && <p className="text-xs text-destructive mt-1">{errors.subject}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                Categoria
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Selecione...</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.label}>{c.label}</option>
                ))}
              </select>
              {errors.category && <p className="text-xs text-destructive mt-1">{errors.category}</p>}
            </div>
          </div>

          {/* Mensagem */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">
              Mensagem
            </label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Descreva seu problema ou dúvida..."
              rows={4}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              maxLength={2000}
            />
            {errors.message && <p className="text-xs text-destructive mt-1">{errors.message}</p>}
          </div>

          {/* Prioridade */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">
              Prioridade
            </label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.label}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={sending}
            className="bg-hero-gradient text-primary-foreground font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-2 text-sm"
          >
            <Send className="h-4 w-4" /> Enviar e-mail
          </button>
        </form>
      </section>
    </div>
  );
}
