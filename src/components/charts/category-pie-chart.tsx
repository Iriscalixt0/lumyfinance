"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { formatCurrency } from "@/lib/utils/currency";

const COLORS = ["#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

function CustomLegend(props: { payload?: { value: string; color: string }[] }) {
  const { payload } = props;
  if (!payload?.length) return null;
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-4 sm:mt-2 justify-items-start">
      {payload.map((entry, i) => (
        <li key={i} className="flex items-center gap-2 min-w-0 text-xs sm:text-sm">
          <span
            className="shrink-0 w-3 h-3 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span className="truncate" title={entry.value}>
            {entry.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function CategoryPieChart({
  data,
  locale = "pt-BR",
}: {
  data: { name: string; value: number }[];
  locale?: string;
}) {
  const formatted = data.map((d) => ({ ...d, value: d.value / 100 }));
  const formatValue = (v: number) => formatCurrency(Math.round(v * 100), locale);

  return (
    <div className="w-full flex flex-col sm:block">
      <div className="h-[220px] sm:h-[260px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie
              data={formatted}
              cx="50%"
              cy="45%"
              innerRadius="35%"
              outerRadius="65%"
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
            >
              {formatted.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number) => formatValue(v)}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.75rem",
                fontSize: "0.75rem",
              }}
            />
            <Legend content={<CustomLegend />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
