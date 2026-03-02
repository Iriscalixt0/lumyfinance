"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { updateBudget, deleteBudget, type BudgetWithUsage } from "@/actions/budgets";
import { formatCurrency } from "@/lib/utils/currency";
import { parseBRL } from "@/lib/utils/currency";
import { Pencil, Trash2, ChevronDown, PiggyBank } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { useVisitor } from "@/components/visitor/visitor-context";

export function BudgetsListWithModal({
  budgets,
  workspaceId,
  locale,
  monthLabel,
  year,
}: {
  budgets: BudgetWithUsage[];
  workspaceId: string;
  locale: string;
  monthLabel?: string;
  year?: number;
}) {
  const router = useRouter();
  const tBudgets = useTranslations("budgets");
  const tCommon = useTranslations("common");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { requirePro } = useVisitor();

  function startEdit(b: BudgetWithUsage) {
    setEditingId(b.id);
    setEditAmount((b.limit_amount / 100).toFixed(2).replace(".", ","));
  }

  async function saveEdit(id: string) {
    if (!requirePro()) return;
    const parsed = parseBRL(editAmount);
    if (isNaN(parsed) || parsed <= 0) return;
    try {
      await updateBudget(id, workspaceId, { limit_amount: parsed });
      setEditingId(null);
      router.refresh();
    } catch (error) {
      console.error("Failed to update budget:", error);
    }
  }

  async function handleDelete(id: string) {
    if (!requirePro()) return;
    setDeletingId(id);
    try {
      await deleteBudget(id, workspaceId);
      router.refresh();
    } catch (error) {
      console.error("Failed to delete budget:", error);
    } finally {
      setDeletingId(null);
    }
  }

  const filteredBudgets = categoryFilter
    ? budgets.filter((b) => b.category_id === categoryFilter)
    : budgets;
  const categories = [...new Map(budgets.map((b) => [b.category_id, b.category_name])).entries()];

  return (
    <>
      {monthLabel !== undefined && year !== undefined && (
        <div className="p-4 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:flex-wrap sm:justify-between sm:items-center gap-2 sm:gap-3 overflow-visible">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-foreground shrink-0">
              {tBudgets("budgetsFor", { month: monthLabel, year })}
            </h2>
            {categories.length >= 1 && (
              <div className="relative z-10 shrink-0 w-full sm:w-auto">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="appearance-none min-h-[44px] pl-3 pr-8 py-2 rounded-lg bg-background border border-border text-sm font-medium text-foreground cursor-pointer focus:ring-2 focus:ring-primary focus:outline-none w-full sm:w-auto min-w-[160px]"
                  aria-label={tBudgets("filterByCategory")}
                >
                  <option value="">{tBudgets("allCategories")}</option>
                  {categories.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-muted-foreground"
                  aria-hidden
                />
              </div>
            )}
          </div>
          <span className="text-[11px] sm:text-xs font-bold text-muted-foreground">
            {filteredBudgets.length} {filteredBudgets.length === 1 ? tBudgets("active") : tBudgets("actives")}
          </span>
        </div>
      )}
    {filteredBudgets.length === 0 ? (
      <div className="p-12 sm:p-16 text-center">
        <PiggyBank className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground font-medium text-sm sm:text-base">{tBudgets("noBudgets")}</p>
      </div>
    ) : (
    <ul className="divide-y divide-border">
      {filteredBudgets.map((b) => {
        const pct = b.limit_amount > 0 ? Math.min((b.used_amount / b.limit_amount) * 100, 150) : 0;
        const isOver = b.used_amount > b.limit_amount;
        const isWarning = pct >= 80 && !isOver;
        const isEditing = editingId === b.id;

        return (
          <li
            key={b.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 p-3 sm:p-4 hover:bg-secondary/30"
          >
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <CategoryIcon icon={b.category_icon} color={b.category_color} className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground text-sm sm:text-base truncate">{b.category_name}</p>
                <p className="text-[11px] sm:text-xs text-muted-foreground tabular-nums">
                  {formatCurrency(b.used_amount, locale)} / {formatCurrency(b.limit_amount, locale)}
                </p>
                <div className="mt-1 h-1.5 sm:h-2 bg-secondary rounded-full overflow-hidden w-full sm:max-w-[200px]">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isOver ? "bg-rose-500" : isWarning ? "bg-amber-500" : "bg-primary"
                    }`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0 self-end sm:self-auto">
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-24 sm:w-28 rounded-lg border border-border px-2 py-1.5 sm:py-1 text-sm"
                    placeholder="0,00"
                  />
                  <button
                    type="button"
                    onClick={() => saveEdit(b.id)}
                    className="rounded-lg bg-primary px-2.5 sm:px-3 py-1.5 sm:py-1 text-xs sm:text-sm font-medium text-primary-foreground"
                  >
                    {tCommon("save")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-lg border border-border px-2.5 sm:px-3 py-1.5 sm:py-1 text-xs sm:text-sm"
                  >
                    {tCommon("cancel")}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => startEdit(b)}
                    className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:p-2 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
                    aria-label={tCommon("edit")}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(b.id)}
                    disabled={deletingId === b.id}
                    className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:p-2 flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-500/10 disabled:opacity-50"
                    aria-label={tCommon("delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
    )}
    </>
  );
}
