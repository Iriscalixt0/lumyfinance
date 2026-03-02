"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useTranslations } from "next-intl";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/dates";
import { Wallet, ChevronDown } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { TransactionForm } from "@/components/forms/transaction-form";
import { EmptyState } from "@/components/ui/empty-state";
import { deleteTransaction } from "@/actions/transactions";
import { useVisitor } from "@/components/visitor/visitor-context";
import type { Category } from "@/types/database";
import type { WorkspaceMemberForPaidBy } from "@/actions/invites";

type TransactionRow = {
  id: string;
  category_id: string | null;
  type: "income" | "expense" | "transfer";
  amount: number;
  description: string;
  date: string;
  notes?: string | null;
  tags?: string[] | null;
  paid_by?: string | null;
  split_type?: "single" | "split_equal" | "split_custom" | null;
  paid_by_profile?: { id: string; full_name: string } | null;
  category?: { name?: string; icon?: string; color?: string };
};

export function TransactionHistoryWithModal({
  transactions,
  incomeCategories,
  expenseCategories,
  workspaceMembers = [],
  workspaceId,
  year,
  month,
  defaultDate,
}: {
  transactions: TransactionRow[];
  incomeCategories: Category[];
  expenseCategories: Category[];
  workspaceMembers?: WorkspaceMemberForPaidBy[];
  workspaceId: string;
  year: number;
  month: number;
  defaultDate: string;
}) {
  const [editingTransaction, setEditingTransaction] = useState<TransactionRow | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("transactions");
  const tCommon = useTranslations("common");
  const { requirePro } = useVisitor();

  const allCategories = [...incomeCategories, ...expenseCategories];
  const filteredTransactions = categoryFilter
    ? transactions.filter((tr) => tr.category_id === categoryFilter)
    : transactions;

  function descriptionWithPaidBy(tr: TransactionRow): string {
    const desc = tr.description ?? "";
    if (tr.split_type === "split_equal" || tr.split_type === "split_custom") {
      return `${t("paidByEveryone")}: ${desc}`;
    }
    if (tr.paid_by_profile?.full_name) {
      return `${t("paidByFormat", { name: tr.paid_by_profile.full_name })} ${desc}`;
    }
    return desc;
  }

  const handleEditSuccess = () => {
    setEditingTransaction(null);
    router.refresh();
  };

  async function handleDelete(id: string) {
    if (!requirePro()) return;
    try {
      await deleteTransaction(id, workspaceId);
      router.refresh();
    } catch (error) {
      console.error("Failed to delete transaction:", error);
    }
  }

  return (
    <>
      <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
        <div className="px-4 sm:px-8 py-4 sm:py-6 bg-secondary/50 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h4 className="font-bold text-foreground text-sm sm:text-base">{t("historyTitle")}</h4>
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="appearance-none min-h-[44px] pl-3 pr-8 py-2 rounded-lg bg-background border border-border text-sm font-medium text-foreground cursor-pointer focus:ring-2 focus:ring-primary focus:outline-none w-full sm:w-auto min-w-[160px]"
                aria-label={t("filterByCategory")}
              >
                <option value="">{t("allCategories")}</option>
                {allCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-muted-foreground"
                aria-hidden
              />
            </div>
          </div>
        </div>

        {/* Mobile: cards empilhados */}
        <div className="md:hidden divide-y divide-border">
          {filteredTransactions.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title={t("emptyStateTitle")}
              description={t("emptyStateDesc")}
            />
          ) : (
            filteredTransactions.map((tr) => (
              <div key={tr.id} className="p-4 flex flex-col gap-1">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase">
                      <CategoryIcon
                        icon={tr.category?.icon ?? "box"}
                        color={tr.category?.color}
                        className="w-3.5 h-3.5 shrink-0"
                      />
                      {tr.category?.name ?? t("noCategory")}
                    </span>
                    <p className="text-sm font-bold text-foreground truncate">
                      {descriptionWithPaidBy(tr)}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(tr.date, locale)}</p>
                    {tr.tags && tr.tags.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {tr.tags.join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`text-sm font-bold ${
                        tr.type === "income" ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      {formatCurrency(tr.amount, locale)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingTransaction(tr)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-primary transition-colors"
                      title={tCommon("edit")}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(tr.id)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-rose-500 transition-colors"
                      title={tCommon("delete")}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop: tabela */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[10px] font-black text-muted-foreground uppercase bg-secondary/30">
              <tr>
                <th className="px-4 lg:px-8 py-4">{t("date")}</th>
                <th className="px-4 lg:px-8 py-4">{t("categoryDescription")}</th>
                <th className="px-4 lg:px-8 py-4 text-right">{t("value")}</th>
                <th className="px-4 lg:px-8 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTransactions.map((trx) => (
                <tr key={trx.id} className="group hover:bg-secondary/50">
                  <td className="px-4 lg:px-8 py-4 text-xs font-bold text-muted-foreground">
                    {formatDate(trx.date, locale)}
                  </td>
                  <td className="px-4 lg:px-8 py-4">
                    <span className="flex items-center gap-1.5 text-[9px] font-black text-muted-foreground uppercase tracking-tighter">
                      <CategoryIcon
                        icon={trx.category?.icon ?? "box"}
                        color={trx.category?.color}
                        className="w-3.5 h-3.5 shrink-0"
                      />
                      {trx.category?.name ?? t("noCategory")}
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      {descriptionWithPaidBy(trx)}
                    </span>
                    {trx.tags && trx.tags.length > 0 && (
                      <span className="block text-[10px] text-muted-foreground mt-0.5">
                        {trx.tags.join(", ")}
                      </span>
                    )}
                  </td>
                  <td
                    className={`px-4 lg:px-8 py-4 text-right font-black ${
                      trx.type === "income" ? "text-emerald-500" : "text-rose-500"
                    }`}
                  >
                    {formatCurrency(trx.amount, locale)}
                  </td>
                  <td className="px-4 lg:px-8 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingTransaction(trx)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-primary transition-colors"
                        title={tCommon("edit")}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(trx.id)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-rose-500 transition-colors"
                        title={tCommon("delete")}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredTransactions.length === 0 && (
            <div className="p-6">
              <EmptyState
                icon={Wallet}
                title={t("emptyStateTitle")}
                description={t("emptyStateDesc")}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modal de edição */}
      {editingTransaction && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          onClick={() => setEditingTransaction(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl shadow-card w-full max-w-lg max-h-[90vh] overflow-y-auto relative z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
              <h3 id="modal-title" className="font-bold text-foreground text-sm sm:text-base">
                Editar transação
              </h3>
              <button
                type="button"
                onClick={() => setEditingTransaction(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground transition-colors"
                title="Fechar"
                aria-label="Fechar"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="p-4 sm:p-6">
              <TransactionForm
                workspaceId={workspaceId}
                year={year}
                month={month}
                incomeCategories={incomeCategories}
                expenseCategories={expenseCategories}
                workspaceMembers={workspaceMembers}
                defaultDate={defaultDate}
                transaction={{
                  id: editingTransaction.id,
                  category_id: editingTransaction.category_id,
                  type: editingTransaction.type,
                  amount: editingTransaction.amount,
                  description: editingTransaction.description,
                  date: editingTransaction.date,
                  notes: editingTransaction.notes,
                  tags: editingTransaction.tags,
                  paid_by: editingTransaction.paid_by,
                  split_type: editingTransaction.split_type,
                }}
                onEditSuccess={handleEditSuccess}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
