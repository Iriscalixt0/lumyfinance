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
  const fmt = useIntlFormat();

  if (members.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-[var(--card-shadow)]">
      <div className="space-y-3">
        {members.map((member, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 text-primary text-sm font-bold flex items-center justify-center flex-shrink-0">
              {member.avatar || member.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-sm font-semibold text-foreground">{member.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">{member.percentage}%</span>
                  <span className="text-sm font-bold text-foreground tabular-nums">{fmt.money(member.spent)}</span>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                  style={{ width: `${member.percentage}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-1">Restam R$ 0.000,00 do orçamento mensal</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
