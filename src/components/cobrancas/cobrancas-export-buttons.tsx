"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, MessageCircle, Check } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDateLocale } from "@/lib/utils/dates";
import type { ReceivableRow } from "@/actions/receivables";

function buildWhatsAppText(
  receivables: ReceivableRow[],
  locale: string,
  t: (key: string) => string
): string {
  const lines = [`*${t("pendingCharges")}:*`, ""];
  let total = 0;
  for (const r of receivables) {
    if (r.status === "paid") continue;
    const duePart = r.due_date ? ` (${t("dueShort")}: ${formatDateLocale(r.due_date, locale)})` : "";
    lines.push(`• ${r.debtor_name}: ${formatCurrency(r.amount, locale)}${duePart}`);
    total += r.amount;
  }
  if (total > 0) {
    lines.push("");
    lines.push(`${t("total")}: ${formatCurrency(total, locale)}`);
  }
  return lines.join("\n");
}

export function CobrancasExportButtons({
  receivables,
  queryString,
  locale,
}: {
  receivables: ReceivableRow[];
  queryString: string;
  locale: string;
}) {
  const t = useTranslations("cobrancas");
  const [copied, setCopied] = useState(false);

  const handleCopyWhatsApp = useCallback(async () => {
    const text = buildWhatsAppText(receivables, locale, t);
    if (!text.trim() || text === `*${t("pendingCharges")}:*\n\n`) {
      return;
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [receivables, locale, t]);

  const exportCsvUrl = `/api/cobrancas/export-csv${queryString ? `?${queryString}` : ""}`;
  const pendingCount = receivables.filter((r) => r.status !== "paid").length;

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <a
        href={exportCsvUrl}
        download
        className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm font-medium bg-card hover:bg-secondary/50 transition-all shadow-sm"
      >
        <Download size={16} /> {t("exportCsv")}
      </a>
      <button
        type="button"
        onClick={handleCopyWhatsApp}
        disabled={pendingCount === 0}
        title="Copiar texto para colar no WhatsApp"
        className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm font-medium bg-card hover:bg-secondary/50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {copied ? <Check size={16} className="text-green-600" /> : <MessageCircle size={16} />}
        {copied ? t("copied") : t("copyWhatsApp")}
      </button>
    </div>
  );
}
