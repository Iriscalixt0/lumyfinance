import { useMemo } from "react";
import { useIntlFormat } from "@/hooks/useIntlFormat";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  date: string;
}

interface WeeklySummaryCardProps {
  transactions: Transaction[];
}

const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function WeeklySummaryCard({ transactions }: WeeklySummaryCardProps) {
  const fmt = useIntlFormat();

  const { dailyData, weekIncome, weekExpense } = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    // Monday-based week
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const daily = Array(7).fill(0);
    let income = 0;
    let expense = 0;

    for (const tx of transactions) {
      const d = new Date(tx.date);
      if (d >= monday) {
        const idx = Math.min(Math.floor((d.getTime() - monday.getTime()) / (24 * 60 * 60 * 1000)), 6);
        if (tx.type === "expense") {
          daily[idx] += tx.amount;
          expense += tx.amount;
        } else if (tx.type === "income") {
          income += tx.amount;
        }
      }
    }

    return { dailyData: daily, weekIncome: income, weekExpense: expense };
  }, [transactions]);

  const maxVal = Math.max(...dailyData, 1);

  return (
    <div className="bg-card border border-border rounded-3xl p-6 shadow-[var(--card-shadow)] h-full flex flex-col">
      <h3 className="text-base font-bold text-foreground mb-5">Resumo da semana</h3>

      {/* Bar chart */}
      <div className="flex items-end gap-2 flex-1 min-h-[100px] mb-4">
        {dailyData.map((val, i) => {
          const height = maxVal > 0 ? Math.max((val / maxVal) * 100, 4) : 4;
          const isToday = i === ((new Date().getDay() + 6) % 7);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full flex items-end justify-center" style={{ height: "100px" }}>
                <div
                  className={`w-full max-w-[28px] rounded-md transition-all duration-500 ${
                    isToday
                      ? "bg-gradient-to-t from-primary to-accent"
                      : val > 0
                        ? "bg-primary/30"
                        : "bg-muted/50"
                  }`}
                  style={{ height: `${height}%` }}
                />
              </div>
              <span className={`text-[10px] font-medium ${
                isToday ? "text-primary font-bold" : "text-muted-foreground"
              }`}>
                {DAY_LABELS[i]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Income / Expense summary */}
      <div className="space-y-2.5 pt-3 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <ArrowDownLeft className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">Entradas</span>
          </div>
          <span className="text-sm font-bold text-foreground tabular-nums">{fmt.money(weekIncome)}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-destructive/10 flex items-center justify-center">
              <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />
            </div>
            <span className="text-sm text-muted-foreground">Saídas</span>
          </div>
          <span className="text-sm font-bold text-foreground tabular-nums">{fmt.money(weekExpense)}</span>
        </div>
      </div>
    </div>
  );
}
