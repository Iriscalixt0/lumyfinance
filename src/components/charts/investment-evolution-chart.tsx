"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils/currency";

const INVESTMENT_COLOR = "hsl(217 91% 60%)"; // blue-500

export function InvestmentEvolutionChart({
  labels,
  investmentData,
  locale = "pt-BR",
  investmentLabel = "Investido",
}: {
  labels: string[];
  investmentData: number[];
  locale?: string;
  investmentLabel?: string;
}) {
  const data = labels.map((label, i) => ({
    name: label,
    [investmentLabel]: investmentData[i] / 100,
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
        <Bar dataKey={investmentLabel} fill={INVESTMENT_COLOR} radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
