import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useTranslations } from "@/lib/i18n";
import { TrendingUp, AlertTriangle } from "lucide-react";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  date: string;
  category_id?: string | null;
}

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface SpendingInsightChartProps {
  transactions: Transaction[];
  categories: Category[];
  formatMoney: (v: number) => string;
}

const CATEGORY_COLORS = [
  "hsl(160, 60%, 48%)",  // primary green
  "hsl(200, 70%, 55%)",  // blue
  "hsl(38, 92%, 50%)",   // amber
  "hsl(280, 60%, 55%)",  // purple
  "hsl(340, 65%, 50%)",  // pink
  "hsl(25, 80%, 50%)",   // orange
  "hsl(170, 50%, 45%)",  // teal
  "hsl(0, 0%, 50%)",     // gray (outros)
];

export function SpendingInsightChart({ transactions, categories, formatMoney }: SpendingInsightChartProps) {
  const t = useTranslations("dashboard");

  const currentMonth = new Date().getMonth();
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;

  const { chartData, insight } = useMemo(() => {
    const catMap = new Map(categories.map(c => [c.id, c]));
    const currentMonthTx = transactions.filter(tx => {
      const m = new Date(tx.date).getMonth();
      return m === currentMonth && tx.type === "expense";
    });
    const prevMonthTx = transactions.filter(tx => {
      const m = new Date(tx.date).getMonth();
      return m === prevMonth && tx.type === "expense";
    });

    // Group by category
    const catTotals = new Map<string, { name: string; icon: string; current: number; previous: number }>();

    for (const tx of currentMonthTx) {
      const catId = tx.category_id || "_other";
      const cat = tx.category_id ? catMap.get(tx.category_id) : null;
      const existing = catTotals.get(catId) || {
        name: cat?.name || "Outros",
        icon: cat?.icon || "📦",
        current: 0,
        previous: 0,
      };
      existing.current += tx.amount;
      catTotals.set(catId, existing);
    }

    for (const tx of prevMonthTx) {
      const catId = tx.category_id || "_other";
      const cat = tx.category_id ? catMap.get(tx.category_id) : null;
      const existing = catTotals.get(catId) || {
        name: cat?.name || "Outros",
        icon: cat?.icon || "📦",
        current: 0,
        previous: 0,
      };
      existing.previous += tx.amount;
      catTotals.set(catId, existing);
    }

    // Sort by current spending descending
    const sorted = Array.from(catTotals.entries())
      .sort((a, b) => b[1].current - a[1].current)
      .slice(0, 6);

    const data = sorted.map(([, val], i) => ({
      name: `${val.icon} ${val.name}`,
      shortName: val.name.length > 8 ? val.name.slice(0, 7) + "…" : val.name,
      icon: val.icon,
      current: val.current / 100,
      previous: val.previous / 100,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      change: val.previous > 0
        ? Math.round(((val.current - val.previous) / val.previous) * 100)
        : null,
    }));

    // Auto-insight: find biggest increase
    let insightText = "";
    let insightType: "warning" | "info" = "info";

    const withChanges = data.filter(d => d.change !== null && d.change > 0);
    if (withChanges.length > 0) {
      const biggest = withChanges.sort((a, b) => (b.change ?? 0) - (a.change ?? 0))[0];
      insightText = `${biggest.icon} ${biggest.shortName}: +${biggest.change}% vs mês anterior`;
      insightType = (biggest.change ?? 0) > 30 ? "warning" : "info";
    } else if (data.length > 0) {
      insightText = `${data[0].icon} ${data[0].shortName} é sua maior despesa`;
      insightType = "info";
    }

    return { chartData: data, insight: { text: insightText, type: insightType } };
  }, [transactions, categories, currentMonth, prevMonth]);

  if (chartData.length === 0) {
    return (
      <div className="bg-card border border-border rounded-3xl p-5 sm:p-6 h-full shadow-[var(--card-shadow)]">
        <h3 className="text-sm font-bold text-foreground mb-3">{t("spendingByCategory") || "Pra onde foi a grana"}</h3>
        <div className="flex items-center justify-center h-32 text-muted-foreground text-xs">
          Nada ainda este mês
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-3xl p-5 sm:p-6 h-full shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-foreground">{t("spendingByCategory") || "Pra onde foi a grana"}</h3>
        <span className="text-[10px] text-muted-foreground font-medium">esse mês</span>
      </div>

      {/* Auto-insight highlight */}
      {insight.text && (
        <div className={`flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold ${
          insight.type === "warning"
            ? "bg-destructive/10 text-destructive"
            : "bg-primary/10 text-primary"
        }`}>
          {insight.type === "warning" ? (
            <AlertTriangle className="h-3 w-3 shrink-0" />
          ) : (
            <TrendingUp className="h-3 w-3 shrink-0" />
          )}
          <span className="truncate">{insight.text}</span>
        </div>
      )}

      {/* Chart */}
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barCategoryGap="20%" layout="vertical">
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: "hsl(155, 15%, 55%)" }}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v))}
            />
            <YAxis
              type="category"
              dataKey="icon"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 14 }}
              width={24}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(160, 35%, 13%)",
                border: "1px solid hsl(160, 25%, 20%)",
                borderRadius: "10px",
                fontSize: "11px",
                color: "hsl(150, 20%, 96%)",
              }}
              formatter={(value: number) => [formatMoney(Math.round(value * 100)), ""]}
              labelFormatter={(label) => {
                const item = chartData.find(d => d.icon === label);
                return item ? item.name : String(label);
              }}
            />
            <Bar dataKey="current" radius={[0, 4, 4, 0]} name="Este mês">
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Category legend with change indicators */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {chartData.slice(0, 4).map((cat, i) => (
          <div key={i} className="flex items-center gap-1 text-[10px]">
            <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
            <span className="text-muted-foreground">{cat.shortName}</span>
            {cat.change !== null && cat.change !== 0 && (
              <span className={`font-bold ${cat.change > 0 ? "text-destructive" : "text-primary"}`}>
                {cat.change > 0 ? "↑" : "↓"}{Math.abs(cat.change)}%
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
