import { useTranslations } from "@/lib/i18n";
import { useIntlFormat } from "@/hooks/useIntlFormat";

interface Member {
  name: string;
  avatar?: string;
  spent: number;
  percentage: number;
}

interface MemberSpendingProps {
  members: Member[];
}

export function MemberSpending({ members }: MemberSpendingProps) {
  const t = useTranslations("dashboard");
  const fmt = useIntlFormat();

  if (members.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <h3 className="text-sm font-bold text-foreground mb-3">Gastos</h3>
      <div className="space-y-3">
        {members.map((member, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center ring-1 ring-primary/20 flex-shrink-0">
              {member.avatar || member.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-medium text-foreground truncate">{member.name}</span>
                <span className="text-xs font-bold text-primary tabular-nums">{member.percentage}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${member.percentage}%` }}
                />
              </div>
            </div>
            <span className="text-xs font-semibold text-muted-foreground tabular-nums flex-shrink-0">
              {fmt.money(member.spent)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
