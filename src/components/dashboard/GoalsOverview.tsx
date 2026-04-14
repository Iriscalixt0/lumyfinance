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
    <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 shadow-[var(--card-shadow)] h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-bold text-foreground">{t("goals")}</h3>
        <Link
          to="/goals"
          className="text-xs font-medium text-primary flex items-center gap-0.5 hover:underline"
        >
          {t("quickLinks")} <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="space-y-5">
        {goals.slice(0, 3).map((goal) => {
          const pct = goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0;
          return (
            <div key={goal.id}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground truncate max-w-[60%]">{goal.name}</span>
                <span className="text-base font-bold text-primary tabular-nums">{Math.round(pct)}%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
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
