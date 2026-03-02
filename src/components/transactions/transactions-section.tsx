"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Download, MessageCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { TransactionForm } from "@/components/forms/transaction-form";
import { TransactionHistoryWithModal } from "@/components/transactions/transaction-history-with-modal";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";
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

function isDateInMonth(dateStr: string, year: number, month: number): boolean {
  const d = new Date(dateStr + "T12:00:00");
  return d.getFullYear() === year && d.getMonth() === month;
}

export function TransactionsSection({
  initialTransactions,
  incomeCategories,
  expenseCategories,
  workspaceMembers,
  workspaceId,
  year,
  month,
  defaultDate,
  invAmount,
  goalsAmount,
  labels,
}: {
  initialTransactions: TransactionRow[];
  incomeCategories: Category[];
  expenseCategories: Category[];
  workspaceMembers: WorkspaceMemberForPaidBy[];
  workspaceId: string;
  year: number;
  month: number;
  defaultDate: string;
  invAmount: number;
  goalsAmount: number;
  labels: { income: string; expenses: string; invested: string; goals: string; freeBalance: string };
}) {
  const locale = useLocale();
  const t = useTranslations("transactions");
  const [transactions, setTransactions] = useState<TransactionRow[]>(initialTransactions);
  const [whatsappCopied, setWhatsappCopied] = useState(false);

  const monthName = new Date(year, month - 1).toLocaleDateString(locale, { month: "long", year: "numeric" });

  useEffect(() => {
    setTransactions(initialTransactions);
  }, [initialTransactions]);

  const handleTransactionCreated = useCallback(
    (tx: { id: string; date: string; [key: string]: unknown }) => {
      if (isDateInMonth(tx.date, year, month)) {
        setTransactions((prev) => [tx as TransactionRow, ...prev]);
      }
    },
    [year, month]
  );

  let inc = 0,
    exp = 0;
  transactions.forEach((tx) => {
    if (tx.type === "income") inc += tx.amount;
    else exp += tx.amount;
  });
  const balance = inc - exp - invAmount - goalsAmount;

  const handleCopyReportWhatsApp = useCallback(async () => {
    const lines: string[] = [
      `📊 ${t("historyTitle")} – ${monthName}`,
      "",
      `${labels.income}: ${formatCurrency(inc, locale)}`,
      `${labels.expenses}: ${formatCurrency(exp, locale)}`,
      `${labels.invested}: ${formatCurrency(invAmount, locale)}`,
      `${labels.goals}: ${formatCurrency(goalsAmount, locale)}`,
      `${labels.freeBalance}: ${formatCurrency(balance, locale)}`,
    ];
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setWhatsappCopied(true);
      setTimeout(() => setWhatsappCopied(false), 2500);
    } catch {
      // clipboard não disponível em alguns contextos
    }
  }, [locale, monthName, labels, inc, exp, invAmount, goalsAmount, balance, t]);

  return (
    <>
      <RealtimeRefresher
        workspaceId={workspaceId}
        options={{ transactions: true, goals: true, investments: true }}
      />
      <div className="flex items-center gap-2 flex-wrap print:hidden">
        <a
          href={`/api/transactions/export-csv?locale=${locale}&year=${year}&month=${month}`}
          download
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
        >
          <Download className="h-4 w-4" />
          {t("exportCsv")}
        </a>
        <button
          type="button"
          onClick={handleCopyReportWhatsApp}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          {whatsappCopied ? t("reportCopied") : t("shareWhatsApp")}
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-6 items-start">
        <div className="bg-card border border-border rounded-xl sm:rounded-2xl shadow-card p-4 sm:p-6 border-b-4 border-emerald-400 min-w-0">
          <p className="text-[10px] sm:text-[11px] font-extrabold text-muted-foreground uppercase">{labels.income}</p>
          <p className="text-lg sm:text-2xl font-black text-emerald-600 tabular-nums">{formatCurrency(inc, locale)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl sm:rounded-2xl shadow-card p-4 sm:p-6 border-b-4 border-rose-400 min-w-0">
          <p className="text-[10px] sm:text-[11px] font-extrabold text-muted-foreground uppercase">{labels.expenses}</p>
          <p className="text-lg sm:text-2xl font-black text-rose-600 tabular-nums">{formatCurrency(exp, locale)}</p>
        </div>
        <div
          className="bg-card border rounded-xl sm:rounded-2xl shadow-card p-4 sm:p-6 border-b-4 min-w-0"
          style={{ borderColor: "#0D47A1" }}
        >
          <p className="text-[10px] sm:text-[11px] font-extrabold text-muted-foreground uppercase">{labels.invested}</p>
          <p className="text-lg sm:text-2xl font-black text-blue-600 tabular-nums">{formatCurrency(invAmount, locale)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl sm:rounded-2xl shadow-card p-4 sm:p-6 border-b-4 border-primary min-w-0">
          <p className="text-[10px] sm:text-[11px] font-extrabold text-muted-foreground uppercase">{labels.goals}</p>
          <p className="text-lg sm:text-2xl font-black text-primary tabular-nums">{formatCurrency(goalsAmount, locale)}</p>
        </div>
      </div>
      <p className="text-sm font-bold mt-3 text-right">
        {labels.freeBalance}:{" "}
        <span className={balance >= 0 ? "text-emerald-600" : "text-rose-600"}>
          {formatCurrency(balance, locale)}
        </span>
      </p>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-10">
        <div className="md:col-span-4">
          <TransactionForm
            workspaceId={workspaceId}
            year={year}
            month={month}
            incomeCategories={incomeCategories}
            expenseCategories={expenseCategories}
            workspaceMembers={workspaceMembers}
            defaultDate={defaultDate}
            onTransactionCreated={handleTransactionCreated}
          />
        </div>
        <div className="md:col-span-8">
          <TransactionHistoryWithModal
            transactions={transactions}
            incomeCategories={incomeCategories}
            expenseCategories={expenseCategories}
            workspaceMembers={workspaceMembers}
            workspaceId={workspaceId}
            year={year}
            month={month}
            defaultDate={defaultDate}
          />
        </div>
      </div>
    </>
  );
}
