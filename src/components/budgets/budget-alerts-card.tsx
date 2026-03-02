"use client";

import { useState, useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { formatCurrency } from "@/lib/utils/currency";
import type { BudgetWithUsage } from "@/actions/budgets";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";

const STORAGE_KEY = "budget-alerts-collapsed";

export function BudgetAlertsCard({
  alerts,
  locale,
}: {
  alerts: BudgetWithUsage[];
  locale: string;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setCollapsed(stored === "true");
    } catch {
      // localStorage indisponível (SSR, modo privado, etc.)
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl sm:rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 sm:p-4">
      <button
        type="button"
        onClick={toggleCollapsed}
        className="w-full flex items-center justify-between gap-2 mb-2 sm:mb-3 -m-1 p-1 rounded-lg hover:bg-amber-500/10 transition-colors text-left"
        aria-expanded={!collapsed}
        aria-controls="budget-alerts-list"
        aria-label={collapsed ? "Expandir alertas de orçamento" : "Minimizar alertas de orçamento"}
      >
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 shrink-0" />
          <h3 className="font-bold text-foreground text-xs sm:text-sm">
            Alertas de orçamento
          </h3>
        </div>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>
      <div id="budget-alerts-list" className={collapsed ? "hidden" : ""}>
        <ul className="space-y-2.5 sm:space-y-2 text-xs sm:text-sm">
          {alerts.map((b) => {
            const pctRaw = b.limit_amount > 0 ? Math.round((b.used_amount / b.limit_amount) * 100) : 0;
            const pct = pctRaw > 999 ? "999+" : String(pctRaw);
            const isOver = b.used_amount > b.limit_amount;
            return (
              <li key={b.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 sm:gap-0">
                <span className="flex items-center gap-2 min-w-0">
                  <CategoryIcon icon={b.category_icon} color={b.category_color} className="w-4 h-4 shrink-0" />
                  <span className="truncate">{b.category_name}</span>
                  <span className="text-muted-foreground shrink-0">— {pct}%</span>
                </span>
                <span className={`text-right shrink-0 tabular-nums sm:ml-2 ${isOver ? "text-rose-600 font-semibold" : "text-amber-600"}`}>
                  {formatCurrency(b.used_amount, locale)} / {formatCurrency(b.limit_amount, locale)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <Link
        href="/dashboard/budgets"
        className="mt-2 sm:mt-3 inline-block text-xs sm:text-sm font-semibold text-primary hover:underline"
      >
        Ver orçamentos →
      </Link>
    </div>
  );
}
