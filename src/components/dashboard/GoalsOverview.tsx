import { useTranslations } from "@/lib/i18n";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

interface Goal {
  id: string;
  name: string;
  current: number;
  target: number;
  color?: string;
}

interface GoalsOverviewProps {
  goals: Goal[];
}

export function GoalsOverview({ goals }: GoalsOverviewProps) {
  const t = useTranslations("dashboard");

  if (goals.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground">{t("goals")}</h3>
        <Link
          to="/goals"
          className="text-xs font-medium text-primary flex items-center gap-0.5 hover:underline"
        >
          {t("quickLinks")} <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="space-y-3">
        {goals.slice(0, 4).map((goal) => {
          const pct = goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0;
          return (
            <div key={goal.id}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-foreground truncate max-w-[60%]">{goal.name}</span>
                <span className="text-xs font-bold text-primary tabular-nums">{Math.round(pct)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
