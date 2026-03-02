"use client";

import { useState, useEffect } from "react";
import { getCashFlowProjection } from "@/actions/projections";
import { formatCurrency } from "@/lib/utils/currency";

export function ProjectionsCard({
  workspaceId,
  locale,
}: {
  workspaceId: string;
  locale: string;
}) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getCashFlowProjection>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCashFlowProjection(workspaceId, 6).then(setData).finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) return <p className="text-sm text-muted-foreground">Carregando projeção...</p>;
  if (data.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-2xl shadow-card p-6">
      <h4 className="text-lg font-bold text-foreground mb-4">Projeção de saldo (próximos 6 meses)</h4>
      <div className="space-y-2 text-sm">
        {data.map((m, i) => (
          <div key={i} className="flex justify-between items-center">
            <span className="text-muted-foreground">
              {m.month} {m.year}
            </span>
            <span className={m.cumulativeBalance >= 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
              {formatCurrency(m.cumulativeBalance, locale)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
