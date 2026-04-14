import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useTranslations } from "@/lib/i18n";

interface DependentSpendingChartProps {
  data: { name: string; income: number; expense: number }[];
  formatMoney: (v: number) => string;
}

export function DependentSpendingChart({ data, formatMoney }: DependentSpendingChartProps) {
  const t = useTranslations("dashboard");

  return (
    <div className="bg-card border border-border rounded-2xl p-4 h-full shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground">Gastos por dependente</h3>
        <span className="text-[10px] text-muted-foreground font-medium">mensal</span>
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="25%">
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }}
              width={30}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(160, 40%, 15%)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "10px",
                fontSize: "11px",
                color: "#fff",
              }}
              formatter={(value: number) => [formatMoney(Math.round(value * 100)), ""]}
            />
            <Bar dataKey="income" fill="#fbbf24" radius={[3, 3, 0, 0]} name={t("income") || "Receitas"} />
            <Bar dataKey="expense" fill="#3b82f6" radius={[3, 3, 0, 0]} name={t("expenses") || "Despesas"} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
