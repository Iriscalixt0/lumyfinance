import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

interface QuickStatsRowProps {
  income: string;
  expenses: string;
  incomeLabel?: string;
  expensesLabel?: string;
}

export function QuickStatsRow({ income, expenses, incomeLabel = "Receitas", expensesLabel = "Despesas" }: QuickStatsRowProps) {
  return (
    <div className="flex gap-3">
      <div className="flex-1 bg-card border border-border rounded-2xl p-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
          <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{incomeLabel}</p>
          <p className="text-sm font-bold text-emerald-500 tabular-nums">{income}</p>
        </div>
      </div>
      <div className="flex-1 bg-card border border-border rounded-2xl p-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-rose-500/10 flex items-center justify-center flex-shrink-0">
          <ArrowUpRight className="h-4 w-4 text-rose-500" />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{expensesLabel}</p>
          <p className="text-sm font-bold text-rose-500 tabular-nums">{expenses}</p>
        </div>
      </div>
    </div>
  );
}
