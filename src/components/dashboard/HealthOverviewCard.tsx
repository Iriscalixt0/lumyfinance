import { Heart, Shield, Target, PiggyBank } from "lucide-react";
import { useIntlFormat } from "@/hooks/useIntlFormat";

interface HealthOverviewCardProps {
  healthPercent: number;
  healthLabel: string;
  healthColor: string;
  goalsCount: number;
  savingsAmount: number;
}

export function HealthOverviewCard({
  healthPercent,
  healthLabel,
  healthColor,
  goalsCount,
  savingsAmount,
}: HealthOverviewCardProps) {
  const fmt = useIntlFormat();

  const barColor =
    healthPercent >= 80 ? "from-emerald-400 to-emerald-500" :
    healthPercent >= 60 ? "from-primary to-accent" :
    healthPercent >= 40 ? "from-yellow-400 to-yellow-500" :
    "from-red-400 to-red-500";

  return (
    <div className="bg-card border border-border rounded-3xl p-6 shadow-[var(--card-shadow)] h-full flex flex-col">
      <div className="flex items-center gap-2 mb-5">
        <h3 className="text-base font-bold text-foreground">Como está sua grana</h3>
      </div>

      {/* Health bar + percentage */}
      <div className="flex items-center gap-4 mb-2">
        <div className="flex-1 h-3 bg-muted/50 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-1000 ease-out`}
            style={{ width: `${healthPercent}%` }}
          />
        </div>
        <span className={`text-3xl font-black tabular-nums ${healthColor}`}>
          {healthPercent}%
        </span>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        Saúde financeira • {healthLabel}
      </p>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 mt-auto">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <span className="text-[11px] text-muted-foreground leading-tight">Sem<br />pendências</span>
        </div>
        <div className="flex flex-col items-center gap-1.5 text-center">
          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Target className="h-4 w-4 text-primary" />
          </div>
          <span className="text-[11px] text-muted-foreground leading-tight">
            {goalsCount} meta{goalsCount !== 1 ? "s" : ""}<br />ativa{goalsCount !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1.5 text-center">
          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <PiggyBank className="h-4 w-4 text-primary" />
          </div>
          <span className="text-[11px] text-muted-foreground leading-tight">
            {fmt.money(savingsAmount)}<br />economizados
          </span>
        </div>
      </div>
    </div>
  );
}
