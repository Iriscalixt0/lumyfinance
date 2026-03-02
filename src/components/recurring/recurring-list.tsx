"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { deleteRecurring, type RecurringTransaction } from "@/actions/recurring";
import { formatCurrency } from "@/lib/utils/currency";
import { Trash2, ChevronDown, Repeat } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { useVisitor } from "@/components/visitor/visitor-context";

export function RecurringList({
  recurrings,
  workspaceId,
  locale,
  freqLabels,
}: {
  recurrings: RecurringTransaction[];
  workspaceId: string;
  locale: string;
  freqLabels: Record<string, string>;
}) {
  const router = useRouter();
  const t = useTranslations("recurring");
  const tCommon = useTranslations("common");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const { requirePro } = useVisitor();

  const filteredRecurrings = categoryFilter
    ? recurrings.filter((r) => r.category_id === categoryFilter)
    : recurrings;
  const categories = [
    ...new Map(
      recurrings
        .filter((r) => r.category_id != null && r.category_name)
        .map((r) => [r.category_id!, r.category_name!])
    ).entries(),
  ];

  async function handleDelete(id: string) {
    if (!requirePro()) return;
    try {
      await deleteRecurring(id, workspaceId);
      router.refresh();
    } catch (error) {
      console.error("Failed to delete recurring transaction:", error);
    }
  }

  return (
    <>
      <div className="p-4 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:flex-wrap sm:justify-between sm:items-center gap-2 sm:gap-3 overflow-visible">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-foreground shrink-0">
            {t("myRecurring")}
          </h2>
          {categories.length >= 1 && (
            <div className="relative z-10 shrink-0 w-full sm:w-auto">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="appearance-none min-h-[44px] pl-3 pr-8 py-2 rounded-lg bg-background border border-border text-sm font-medium text-foreground cursor-pointer focus:ring-2 focus:ring-primary focus:outline-none w-full sm:w-auto min-w-[160px]"
                aria-label={t("filterByCategory")}
              >
                <option value="">{t("allCategories")}</option>
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
          {filteredRecurrings.length} {filteredRecurrings.length === 1 ? t("active") : t("actives")}
        </span>
      </div>
      {filteredRecurrings.length === 0 ? (
        <div className="p-12 sm:p-16 text-center">
          <Repeat size={40} className="mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground font-medium text-sm sm:text-base">{t("noRecurring")}</p>
        </div>
      ) : (
    <ul className="divide-y divide-border">
      {filteredRecurrings.map((r) => (
        <li
          key={r.id}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-secondary/30"
        >
          <div className="flex items-center gap-3 min-w-0">
            <CategoryIcon
              icon={r.category_icon ?? (r.type === "income" ? "wallet" : "shopping-cart")}
              className="w-5 h-5 shrink-0"
            />
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">{r.description}</p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(r.amount, locale)} • {freqLabels[r.frequency] ?? r.frequency} • {t("next")}: {r.next_run_date}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleDelete(r.id)}
            className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10 shrink-0"
            aria-label={tCommon("delete")}
          >
            <Trash2 size={16} />
          </button>
        </li>
      ))}
    </ul>
      )}
    </>
  );
}
