import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useIntlFormat } from "@/hooks/useIntlFormat";
import { TrendingUp, Calendar, ArrowRight } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

interface ProjectionPoint {
  label: string;
  balance: number;
  projected: boolean;
}

export function ProjectionPage() {
  const fmt = useIntlFormat();
  const formatBRL = fmt.money;
  const { activeWorkspace } = useWorkspace();
  const wsId = activeWorkspace?.id ?? null;
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<{ amount: number; type: string; date: string }[]>([]);
  const [recurring, setRecurring] = useState<{ amount: number; type: string }[]>([]);
  const [projectionMonths, setProjectionMonths] = useState(6);

  useEffect(() => {
    async function load() {
      if (!wsId) { setLoading(false); return; }
      const [txRes, recRes] = await Promise.all([
        supabase.from("transactions").select("amount, type, date").eq("workspace_id", wsId).order("date"),
        supabase.from("recurring_transactions").select("amount, type").eq("workspace_id", wsId).eq("active", true),
      ]);
      setTransactions(txRes.data ?? []);
      setRecurring(recRes.data ?? []);
      setLoading(false);
    }
    load();
  }, [wsId]);

  const data = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Calculate monthly balances from history (last 6 months)
    const historyMonths = 6;
    const points: ProjectionPoint[] = [];

    for (let i = historyMonths - 1; i >= 0; i--) {
      const m = new Date(currentYear, currentMonth - i, 1);
      const monthKey = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
      const monthTxs = transactions.filter((tx) => tx.date.startsWith(monthKey));
      const balance = monthTxs.reduce((acc, tx) => {
        return acc + (tx.type === "income" ? tx.amount : -tx.amount);
      }, 0);

      points.push({
        label: `${MONTH_NAMES[m.getMonth()]} ${m.getFullYear().toString().slice(2)}`,
        balance,
        projected: false,
      });
    }

    // Calculate monthly recurring net
    const recurringNet = recurring.reduce((acc, r) => {
      return acc + (r.type === "income" ? r.amount : -r.amount);
    }, 0);

    // Average historical monthly balance
    const historicalAvg = points.reduce((s, p) => s + p.balance, 0) / (points.length || 1);

    // Project future months
    let cumulativeBalance = points.reduce((s, p) => s + p.balance, 0);
    for (let i = 1; i <= projectionMonths; i++) {
      const m = new Date(currentYear, currentMonth + i, 1);
      const projected = historicalAvg + recurringNet;
      cumulativeBalance += projected;
      points.push({
        label: `${MONTH_NAMES[m.getMonth()]} ${m.getFullYear().toString().slice(2)}`,
        balance: cumulativeBalance,
        projected: true,
      });
    }

    // Make cumulative for historical too
    let cumulative = 0;
    for (let i = 0; i < historyMonths; i++) {
      cumulative += points[i].balance;
      points[i].balance = cumulative;
    }

    return points;
  }, [transactions, recurring, projectionMonths]);

  const currentBalance = data.find((d) => !d.projected)
    ? data.filter((d) => !d.projected).slice(-1)[0]?.balance ?? 0
    : 0;
  const futureBalance = data.slice(-1)[0]?.balance ?? 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projeção de Saldo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Estimativa baseada no histórico e recorrentes ativos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Projetar</span>
          <select
            value={projectionMonths}
            onChange={(e) => setProjectionMonths(Number(e.target.value))}
            className="bg-card border border-border rounded-lg px-2 py-2 text-sm font-medium text-foreground focus:outline-none"
          >
            <option value={3}>3 meses</option>
            <option value={6}>6 meses</option>
            <option value={12}>12 meses</option>
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Saldo atual</p>
          <p className={`text-2xl font-bold ${currentBalance >= 0 ? "text-emerald-500" : "text-destructive"}`}>
            {formatBRL(Math.abs(currentBalance))}
          </p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Projeção em {projectionMonths} meses
          </p>
          <p className={`text-2xl font-bold ${futureBalance >= 0 ? "text-primary" : "text-destructive"}`}>
            {formatBRL(Math.abs(futureBalance))}
          </p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Recorrentes ativos</p>
          <p className="text-2xl font-bold text-foreground">{recurring.length}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="font-semibold text-foreground mb-4">Evolução do saldo</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <YAxis
                tickFormatter={(v: number) => `R$${(v / 100).toFixed(0)}`}
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                formatter={(value: number) => [formatBRL(value), "Saldo"]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  return (
                    <circle
                      key={payload.label}
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill={payload.projected ? "transparent" : "hsl(var(--primary))"}
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      strokeDasharray={payload.projected ? "4 2" : "0"}
                    />
                  );
                }}
                strokeDasharray="0"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-6 bg-primary rounded-full" />
            <span>Histórico</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-6 bg-primary/40 rounded-full border border-primary border-dashed" />
            <span>Projeção</span>
          </div>
        </div>
      </div>
    </div>
  );
}
