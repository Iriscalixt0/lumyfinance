import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Check } from "lucide-react";

const FEATURES = [
  "7 dias de teste grátis",
  "Até 2 workspaces",
  "Até 3 membros",
  "Lançamentos ilimitados",
  "Metas ilimitadas",
  "Relatório Anual",
  "Suporte prioritário",
];

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

  return (
    <div className="animate-fade space-y-6 max-w-lg mx-auto pb-12">
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Plano</h1>

      {/* Pro card */}
      <div className="relative rounded-2xl overflow-hidden">
        {/* Badge */}
        <div className="absolute top-0 left-0 right-0 flex justify-center z-10 -translate-y-0">
          <span className="bg-amber-400 text-amber-950 text-xs font-bold px-4 py-1 rounded-b-lg tracking-wide">
            Mais popular
          </span>
        </div>

        <div className="bg-primary text-primary-foreground rounded-2xl p-8 pt-10">
          <h2 className="text-2xl font-bold mb-1">Pro</h2>
          <p className="text-primary-foreground/70 text-sm mb-4">
            Plano único com 7 dias grátis
          </p>

          <div className="flex items-baseline gap-1 mb-6">
            <span className="text-4xl font-extrabold">R$ 9,90</span>
            <span className="text-primary-foreground/60 text-base">/mês</span>
          </div>

          <ul className="space-y-3 mb-8">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm">
                <Check className="h-4 w-4 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          <button className="w-full bg-card text-foreground font-semibold py-3.5 rounded-xl hover:bg-card/90 transition-colors text-sm">
            {hasPlan ? "Gerenciar assinatura" : "Gerenciar assinatura"}
          </button>
        </div>
      </div>
    </div>
  );
}
