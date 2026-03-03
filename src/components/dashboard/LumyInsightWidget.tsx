import { useState, useEffect, useMemo } from "react";
import { Bot, X, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useTranslations } from "@/lib/i18n";
import { analyzeTransactions, type LumyInsight } from "@/lib/lumy-engine";
import { Link } from "react-router-dom";

export function LumyInsightWidget() {
  const t = useTranslations("dashboard");
  const { activeWorkspace } = useWorkspace();
  const [insight, setInsight] = useState<LumyInsight | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInsight() {
      if (!activeWorkspace) { setLoading(false); return; }

      const now = new Date();
      const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const endOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-31`;

      const [txRes, catRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("id, description, amount, type, date, category_id, notes")
          .eq("workspace_id", activeWorkspace.id)
          .gte("date", startOfMonth)
          .lte("date", endOfMonth),
        supabase
          .from("categories")
          .select("id, name, icon, type")
          .eq("workspace_id", activeWorkspace.id),
      ]);

      const transactions = txRes.data ?? [];
      const categories = catRes.data ?? [];

      if (transactions.length > 0) {
        const insights = analyzeTransactions(transactions, categories);
        // Pick a relevant insight — prefer alerts and tips over praise/info
        const prioritized = insights.sort((a, b) => {
          const priority: Record<string, number> = { alert: 0, tip: 1, praise: 2, info: 3 };
          return (priority[a.type] ?? 4) - (priority[b.type] ?? 4);
        });
        // Rotate daily based on day of month
        const dayIndex = now.getDate() % prioritized.length;
        setInsight(prioritized[dayIndex] || prioritized[0]);
      }
      setLoading(false);
    }

    setLoading(true);
    fetchInsight();
  }, [activeWorkspace]);

  if (loading || !insight || dismissed) return null;

  const typeColors: Record<string, string> = {
    alert: "border-destructive/30 bg-destructive/5",
    tip: "border-primary/30 bg-primary/5",
    praise: "border-emerald-500/30 bg-emerald-500/5",
    info: "border-border bg-card",
  };

  return (
    <div className={`relative rounded-2xl border p-4 ${typeColors[insight.type] || typeColors.info} transition-all animate-fade`}>
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
              {t("lumyInsight")}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">{insight.title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{insight.body}</p>
          <Link
            to="/lumy"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline mt-2"
          >
            {t("askLumy")} →
          </Link>
        </div>
      </div>
    </div>
  );
}
