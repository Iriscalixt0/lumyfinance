"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useTranslations } from "next-intl";
import { Filter, CheckCircle, Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/dates";
import { ReceivableForm } from "@/components/forms/receivable-form";
import { EmptyState } from "@/components/ui/empty-state";
import { deleteReceivable, markReceivableAsPaid } from "@/actions/receivables";
import { useVisitor } from "@/components/visitor/visitor-context";
import type { ReceivableRow } from "@/actions/receivables";

function getStatusColor(status: string): string {
  switch (status) {
    case "paid":
      return "bg-green-500/15 text-green-700 dark:text-green-400";
    case "overdue":
      return "bg-red-500/15 text-red-700 dark:text-red-400";
    default:
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  }
}

export function CobrancasListWithModal({
  receivables,
  workspaceId,
}: {
  receivables: ReceivableRow[];
  workspaceId: string;
}) {
  const [editing, setEditing] = useState<ReceivableRow | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("forms.receivable");
  const tCobrancas = useTranslations("cobrancas");
  const tCommon = useTranslations("common");
  const { requirePro } = useVisitor();

  const totalPending = receivables
    .filter((r) => r.status !== "paid")
    .reduce((acc, r) => acc + r.amount, 0);

  const handleEditSuccess = () => {
    setEditing(null);
    router.refresh();
  };

  async function handleDelete(id: string) {
    if (!requirePro()) return;
    setDeletingId(id);
    setDeleteConfirmId(null);
    try {
      await deleteReceivable(id, workspaceId);
      router.refresh();
    } catch (error) {
      console.error("Failed to delete receivable:", error);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleMarkAsPaid(id: string) {
    if (!requirePro()) return;
    setPayingId(id);
    try {
      await markReceivableAsPaid(id, workspaceId);
      router.refresh();
    } catch (error) {
      console.error("Failed to mark receivable as paid:", error);
    } finally {
      setPayingId(null);
    }
  }

  return (
    <>
      <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden print:border-0 print:shadow-none">
        <div className="px-4 sm:px-6 py-4 sm:py-5 bg-secondary/30 border-b border-border flex flex-col sm:flex-row flex-wrap justify-between items-start sm:items-center gap-3">
          <h4 className="font-bold text-foreground text-sm sm:text-base flex items-center gap-2">
            <Filter size={18} className="text-muted-foreground" /> {tCobrancas("pageTitle")}
          </h4>
          <p className="text-sm font-bold text-primary">
            {tCobrancas("totalToReceive")}: {formatCurrency(totalPending, locale)}
          </p>
        </div>

        <div className="divide-y divide-border">
          {receivables.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={tCobrancas("emptyStateTitle")}
              description={tCobrancas("emptyStateDesc")}
            />
          ) : (
            receivables.map((r) => (
              <div
                key={r.id}
                className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-secondary/20 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-foreground truncate">{r.debtor_name}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span
                      className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${getStatusColor(r.status)}`}
                    >
                      {r.status === "pending" ? t("pending") : r.status === "overdue" ? t("overdue") : t("paid")}
                    </span>
                    {r.due_date && (
                      <span className="text-xs text-muted-foreground">
                        {t("dueDate")}: {formatDate(r.due_date, locale)}
                      </span>
                    )}
                    {r.phone && (
                      <span className="text-xs text-muted-foreground">{t("phone")}: {r.phone}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-sm font-bold ${r.status === "paid" ? "text-muted-foreground line-through" : "text-primary"}`}
                  >
                    {formatCurrency(r.amount, locale)}
                  </span>
                  <div className="flex gap-1 print:hidden">
                    {r.status !== "paid" && (
                      <button
                        type="button"
                        onClick={() => handleMarkAsPaid(r.id)}
                        disabled={!!payingId}
                        className="min-h-[44px] px-3 py-2 flex items-center gap-1.5 rounded-xl text-sm font-medium bg-green-500/15 text-green-700 dark:text-green-400 hover:bg-green-500/25 transition-colors disabled:opacity-50"
                        title={t("markAsPaid")}
                      >
                        <CheckCircle size={18} />
                        {t("paid")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditing(r)}
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
                      onClick={() => {
                        if (!requirePro()) return;
                        setDeleteConfirmId(r.id);
                      }}
                      disabled={!!deletingId}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      title="Excluir"
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
      </div>

      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-receivable-title"
          onClick={() => !deletingId && setDeleteConfirmId(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="modal-delete-receivable-title" className="mb-2 text-lg font-bold text-foreground">
              {t("confirmDelete")}
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              {t("confirmDeleteMessage")}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => !deletingId && setDeleteConfirmId(null)}
                disabled={!!deletingId}
                className="rounded-xl border border-border px-4 py-2 font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground disabled:opacity-50"
              >
                {tCommon("cancel")}
              </button>
              <button
                type="button"
                onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
                disabled={!!deletingId}
                className="rounded-xl bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deletingId ? t("deleting") : t("confirmDeleteButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 print:hidden">
          <div className="bg-card border border-border rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h5 className="font-bold text-foreground">Editar cobrança</h5>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-2 rounded-xl text-muted-foreground hover:bg-secondary"
                aria-label="Fechar"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <ReceivableForm
                workspaceId={workspaceId}
                receivable={editing}
                onEditSuccess={handleEditSuccess}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
