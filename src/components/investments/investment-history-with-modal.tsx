"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useTranslations } from "next-intl";
import { Filter, ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/dates";
import { InvestmentForm } from "@/components/forms/investment-form";
import { deleteInvestment } from "@/actions/investments";
import { useVisitor } from "@/components/visitor/visitor-context";

type InvestmentRow = {
  id: string;
  name: string;
  amount: number;
  date: string;
  type: string;
};

export function InvestmentHistoryWithModal({
  investments,
  workspaceId,
  periodLabel,
}: {
  investments: InvestmentRow[];
  workspaceId: string;
  periodLabel: string;
}) {
  const [editingInvestment, setEditingInvestment] = useState<InvestmentRow | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("investments");
  const tForm = useTranslations("forms.investment");
  const tTypes = useTranslations("forms.investment.types");
  const tCommon = useTranslations("common");
  const { requirePro } = useVisitor();

  const INVESTMENT_TYPES = ["outro", "cdb", "lci", "lca", "tesouro", "acao", "fii", "crypto"] as const;
  const filteredInvestments = typeFilter
    ? investments.filter((i) => i.type === typeFilter)
    : investments;
  const total = filteredInvestments.reduce((a, b) => a + b.amount, 0);

  function getTypeLabel(type: string): string {
    try {
      return tTypes(type as "outro" | "cdb" | "lci" | "lca" | "tesouro" | "acao" | "fii" | "crypto");
    } catch {
      return type;
    }
  }

  const handleEditSuccess = () => {
    setEditingInvestment(null);
    router.refresh();
  };

  async function handleDelete(id: string) {
    if (!requirePro()) return;
    try {
      await deleteInvestment(id, workspaceId);
      router.refresh();
    } catch (error) {
      console.error("Failed to delete investment:", error);
    }
  }

  return (
    <>
      <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
        <div className="px-4 sm:px-6 py-4 sm:py-5 bg-secondary/30 border-b border-border flex flex-col sm:flex-row flex-wrap justify-between items-start sm:items-center gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
            <h4 className="font-bold text-foreground text-sm sm:text-base flex items-center gap-2">
              <Filter size={18} className="text-muted-foreground" /> {t("historyTitle")}
              {periodLabel && (
                <span className="text-muted-foreground font-normal">({periodLabel})</span>
              )}
            </h4>
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="appearance-none min-h-[44px] pl-3 pr-8 py-2 rounded-lg bg-background border border-border text-sm font-medium text-foreground cursor-pointer focus:ring-2 focus:ring-primary focus:outline-none w-full sm:w-auto min-w-[160px]"
                aria-label={t("filterByCategory")}
              >
                <option value="">{t("allCategories")}</option>
                {INVESTMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {getTypeLabel(type)}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-muted-foreground"
                aria-hidden
              />
            </div>
          </div>
          <p className="text-sm font-bold text-primary">{t("totalLabel")}: {formatCurrency(total, locale)}</p>
        </div>

        {/* Mobile: cards empilhados */}
        <div className="md:hidden divide-y divide-border">
          {filteredInvestments.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground italic text-sm">
              {t("noneInPeriod")}
            </div>
          ) : (
            filteredInvestments.map((i) => (
              <div key={i.id} className="p-4 flex justify-between items-center gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-foreground text-sm truncate">{i.name}</p>
                  <span className="inline-block text-[10px] font-medium text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded mt-1 w-fit">
                    {getTypeLabel(i.type)}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(i.date, locale)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold text-primary">{formatCurrency(i.amount, locale)}</span>
                  <button
                    type="button"
                    onClick={() => setEditingInvestment(i)}
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
                    onClick={() => handleDelete(i.id)}
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
            ))
          )}
        </div>

        {/* Desktop: tabela */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border bg-secondary/20">
                <th className="px-4 sm:px-6 py-3 sm:py-4">Data</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4">Ativo / Categoria</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-right">Valor</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {investments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 sm:px-6 py-12 sm:py-20 text-center text-muted-foreground italic">
                    {t("noneInPeriod")}
                  </td>
                </tr>
              ) : (
                filteredInvestments.map((i) => (
                  <tr key={i.id} className="group hover:bg-secondary/30 transition-colors">
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm text-muted-foreground">
                      {formatDate(i.date, locale)}
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-foreground">{i.name}</span>
                        <span className="text-[10px] font-medium text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded w-fit">
                          {getTypeLabel(i.type)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-right font-bold text-primary">
                      {formatCurrency(i.amount, locale)}
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingInvestment(i)}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary transition-colors transition-opacity opacity-0 group-hover:opacity-100"
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
                          onClick={() => handleDelete(i.id)}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-rose-500 transition-colors transition-opacity opacity-0 group-hover:opacity-100"
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
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 sm:p-5 bg-primary/5 border-t border-primary/10 text-right">
          <span className="text-xs font-bold text-primary uppercase mr-2 sm:mr-4">{t("totalMonthly")}</span>
          <span className="text-base sm:text-xl font-black text-primary">
            {formatCurrency(total, locale)}
          </span>
        </div>
      </div>

      {/* Modal de edição */}
      {editingInvestment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-investment-title"
          onClick={() => setEditingInvestment(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl shadow-card w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
              <h3 id="modal-investment-title" className="font-bold text-foreground text-sm sm:text-base">
                {tForm("edit")}
              </h3>
              <button
                type="button"
                onClick={() => setEditingInvestment(null)}
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
              <InvestmentForm
                workspaceId={workspaceId}
                investment={{
                  id: editingInvestment.id,
                  name: editingInvestment.name,
                  amount: editingInvestment.amount,
                  date: editingInvestment.date,
                  type: editingInvestment.type,
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
