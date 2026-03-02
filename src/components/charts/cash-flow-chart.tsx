"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils/currency";

const INCOME_COLOR = "hsl(160 45% 45%)";
const EXPENSE_COLOR = "hsl(0 84% 60%)";

export function CashFlowChart({
  labels,
  incomeData,
  expenseData,
  locale = "pt-BR",
  incomeLabel = "Entradas",
  expenseLabel = "Saídas",
}: {
  labels: string[];
  incomeData: number[];
  expenseData: number[];
  locale?: string;
  incomeLabel?: string;
  expenseLabel?: string;
}) {
  const data = labels.map((label, i) => ({
    name: label,
    [incomeLabel]: incomeData[i] / 100,
    [expenseLabel]: expenseData[i] / 100,
  }));

  const formatValue = (reais: number) => formatCurrency(Math.round(reais * 100), locale);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: "bold" }} stroke="hsl(var(--muted-foreground))" />
        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatValue(v)} stroke="hsl(var(--muted-foreground))" />
        <Tooltip
          formatter={(value: number) => [formatValue(Number(value))]}
          labelFormatter={(label) => label}
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0.75rem",
          }}
        />
        <Legend />
        <Bar dataKey={incomeLabel} fill={INCOME_COLOR} radius={[8, 8, 0, 0]} />
        <Bar dataKey={expenseLabel} fill={EXPENSE_COLOR} radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
