import { Sparkles, Bot } from "lucide-react";
import { type LumyInsight } from "@/lib/lumy-engine";
import { TrendingUp, AlertTriangle, Lightbulb, Info } from "lucide-react";

const INSIGHT_STYLES: Record<string, { icon: typeof Sparkles; color: string }> = {
  praise: { icon: TrendingUp, color: "text-emerald-500" },
  alert: { icon: AlertTriangle, color: "text-amber-500" },
  tip: { icon: Lightbulb, color: "text-primary" },
  info: { icon: Info, color: "text-blue-500" },
};

interface LumyInsightsProps {
  insights: LumyInsight[];
}

export function LumyInsights({ insights }: LumyInsightsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lumy</h1>
          <p className="text-sm text-muted-foreground">Seu assistente financeiro inteligente</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-foreground text-sm">Análises automáticas</h2>
      </div>

      {insights.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <Bot className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">Sem dados suficientes para análise.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((insight) => {
            const style = INSIGHT_STYLES[insight.type] || INSIGHT_STYLES.info;
            const Icon = style.icon;
            return (
              <div key={insight.id} className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${style.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{insight.icon} {insight.title}</p>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{insight.body}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
