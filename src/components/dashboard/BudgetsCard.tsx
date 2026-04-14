import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

interface BudgetMember {
  name: string;
  percentage: number;
  color: string;
}

interface BudgetsCardProps {
  members: BudgetMember[];
}

export function BudgetsCard({ members }: BudgetsCardProps) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 h-full shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-foreground">Orçamentos</h3>
        <Link
          to="/budgets"
          className="text-xs font-medium text-primary flex items-center gap-0.5 hover:underline"
        >
          Abrir <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="space-y-3">
        {members.map((member, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-primary-foreground text-xs font-bold"
                style={{ backgroundColor: member.color }}
              >
                {member.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-foreground">{member.name}</span>
            </div>
            <span className="text-sm font-bold text-foreground tabular-nums">{member.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
