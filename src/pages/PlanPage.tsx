import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { CreditCard, Check, Sparkles } from "lucide-react";

export function PlanPage() {
  const { activeWorkspace } = useWorkspace();
  const [stripeSubId, setStripeSubId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const hasPlan = !!stripeSubId;

  useEffect(() => {
    async function load() {
      if (!activeWorkspace) { setLoading(false); return; }
      const { data } = await supabase
        .from("workspaces")
        .select("stripe_subscription_id")
        .eq("id", activeWorkspace.id)
        .single();
      setStripeSubId(data?.stripe_subscription_id ?? null);
      setLoading(false);
    }
    setLoading(true);
    load();
  }, [activeWorkspace]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const FEATURES = [
    "Até 2 workspaces",
    "Até 3 membros por workspace",
    "Transações ilimitadas",
    "Investimentos e metas",
    "Orçamentos e recorrências",
    "Relatórios completos",
    "Suporte prioritário",
  ];

  return (
    <div className="animate-fade space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Plano</h1>
        <p className="text-muted-foreground mt-1">Gerencie sua assinatura</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Current plan */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {hasPlan ? "Plano Pro" : "Sem plano ativo"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Workspace: {activeWorkspace?.name || "—"}
              </p>
            </div>
          </div>

          {hasPlan ? (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <p className="text-sm text-foreground font-medium">Assinatura ativa ✓</p>
              <p className="text-xs text-muted-foreground mt-1">
                Gerencie sua assinatura pelo portal de cobrança do Stripe.
              </p>
            </div>
          ) : (
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
              <p className="text-sm text-foreground font-medium">Nenhuma assinatura ativa</p>
              <p className="text-xs text-muted-foreground mt-1">
                Você está limitado a 1 workspace e 3 transações. Assine o Pro para desbloquear tudo.
              </p>
            </div>
          )}
        </div>

        {/* Pro plan card */}
        <div className="bg-card border-2 border-primary/30 rounded-2xl p-6 relative">
          <div className="absolute -top-3 left-6">
            <span className="bg-hero-gradient text-primary-foreground text-xs font-bold px-3 py-1 rounded-full inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Recomendado
            </span>
          </div>
          <h2 className="text-xl font-bold text-foreground mt-2 mb-1">Pro</h2>
          <p className="text-3xl font-bold text-foreground mb-1">
            R$29<span className="text-base font-normal text-muted-foreground">/mês</span>
          </p>
          <p className="text-sm text-muted-foreground mb-5">7 dias grátis para testar</p>

          <ul className="space-y-2.5 mb-6">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                <Check className="h-4 w-4 text-primary flex-shrink-0" /> {f}
              </li>
            ))}
          </ul>

          {!hasPlan && (
            <button className="w-full bg-hero-gradient text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              <CreditCard className="h-4 w-4" /> Assinar Pro
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
