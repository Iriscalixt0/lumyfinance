"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { X, Upload } from "lucide-react";
import { importTransactions, type ImportRow } from "@/actions/import-transactions";
import type { Category } from "@/types/database";

const INCOME_KEYWORDS = [
  "entrada", "credit", "crédito", "income", "receita", "receipt", "deposit",
  "depósito", "ingreso", "entrée", "einnahme", "receita", "positive", "+",
];
const EXPENSE_KEYWORDS = [
  "saída", "debit", "débito", "expense", "despesa", "outcome", "withdrawal",
  "saque", "gasto", "dépense", "ausgabe", "spesa", "negative", "-", "pagamento",
  "payment", "transfer",
];

function parseAmount(s: string): number {
  const raw = s.trim().replace(/[^\d,.\s-]/g, "").trim();
  if (!raw) return 0;
  const negative = raw.startsWith("-") || /\([^)]*\)/.test(raw);
  let normalized = raw.replace(/[()]/g, "").replace(/\s/g, "");
  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  if (lastComma > lastDot) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    normalized = normalized.replace(/,/g, "");
  } else {
    normalized = normalized.replace(/,/g, ".");
  }
  const num = parseFloat(normalized) || 0;
  return negative ? -Math.abs(num) : Math.abs(num);
}

function parseDate(s: string): string {
  const d = s.trim();
  if (!d) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const m1 = d.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
  const m2 = d.match(/(\d{4})\/(\d{2})\/(\d{2})/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  const m3 = d.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (m3) return `${m3[3]}-${m3[2]}-${m3[1]}`;
  const m4 = d.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (m4) return `${m4[3]}-${m4[2]}-${m4[1]}`;
  const m5 = d.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m5) return d;
  const m6 = d.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m6) return `${m6[3]}-${m6[2].padStart(2, "0")}-${m6[1].padStart(2, "0")}`;
  const m7 = d.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (m7) return `${m7[3]}-${m7[2].padStart(2, "0")}-${m7[1].padStart(2, "0")}`;
  return "";
}

function guessColumnIndex(header: string[], keywords: string[]): number {
  const lower = header.map((h) => (h ?? "").trim().toLowerCase());
  for (const kw of keywords) {
    const idx = lower.findIndex((h) => h.includes(kw));
    if (idx >= 0) return idx;
  }
  return -1;
}

const DATE_HEADERS = ["data", "date", "datum", "fecha", "datevalue"];
const DESC_HEADERS = ["descrição", "descricao", "description", "desc", "memo", "details", "concepto", "concept"];
const AMOUNT_HEADERS = ["valor", "amount", "value", "montant", "betrag", "importo", "value"];
const TYPE_HEADERS = ["tipo", "type", "kind", "art", "entrada/saída", "income/expense", "credit/debit"];

export function ImportModal({
  workspaceId,
  currentYear,
  currentMonth,
  onClose,
}: {
  workspaceId: string;
  currentYear?: number;
  currentMonth?: number;
  expenseCategories?: Category[];
  incomeCategories?: Category[];
  onClose: () => void;
}) {
  const router = useRouter();
  const t = useTranslations("import");
  const tCommon = useTranslations("common");
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [skipHeader, setSkipHeader] = useState(true);
  const [dateCol, setDateCol] = useState(0);
  const [descCol, setDescCol] = useState(1);
  const [amountCol, setAmountCol] = useState(2);
  const [typeCol, setTypeCol] = useState(-1);

  const parseRows = useCallback((rows: string[][]) => {
    const data = skipHeader ? rows.slice(1) : rows;
    return data.slice(0, 200).map((row) => {
      const date = parseDate(row[dateCol] ?? "");
      const amount = parseAmount(row[amountCol] ?? "0");
      const typeVal = typeCol >= 0 ? (row[typeCol] ?? "").trim().toLowerCase() : "";
      const isIncome = INCOME_KEYWORDS.some((k) => typeVal.includes(k))
        ? true
        : EXPENSE_KEYWORDS.some((k) => typeVal.includes(k))
        ? false
        : amount > 0;
      return {
        date: date || new Date().toISOString().slice(0, 10),
        description: (row[descCol] ?? "").trim() || "Importado",
        amount: Math.abs(amount),
        type: isIncome ? "income" : "expense",
      } as ImportRow;
    }).filter((r) => r.amount > 0);
  }, [dateCol, descCol, amountCol, typeCol, skipHeader]);

  useEffect(() => {
    if (rawRows.length > 0) setPreview(parseRows(rawRows));
  }, [rawRows, parseRows]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const formData = new FormData();
    formData.append("file", f);
    // #region agent log
    fetch("http://127.0.0.1:7429/ingest/d2efb056-3b41-4ea6-89b9-44afb2c9d1c0", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "b2bb57" },
      body: JSON.stringify({ sessionId: "b2bb57", location: "import-modal.tsx:handleFileChange", message: "import parse request", data: { fileName: f.name, size: f.size }, timestamp: Date.now(), hypothesisId: "H5" }),
    }).catch(() => {});
    // #endregion
    const res = await fetch("/api/import/parse", { method: "POST", body: formData });
    const data = await res.json();
    // #region agent log
    fetch("http://127.0.0.1:7429/ingest/d2efb056-3b41-4ea6-89b9-44afb2c9d1c0", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "b2bb57" },
      body: JSON.stringify({ sessionId: "b2bb57", location: "import-modal.tsx:parseResponse", message: "import parse response", data: { status: res.status, hasRows: !!data.rows?.length, rowsLength: data.rows?.length ?? 0, error: data.error ?? null }, timestamp: Date.now(), hypothesisId: "H5" }),
    }).catch(() => {});
    // #endregion
    if (data.rows?.length) {
      setRawRows(data.rows as string[][]);
      const header = (data.header ?? data.rows[0] ?? []).map((h: string) => (h ?? "").trim());
      const dateIdx = guessColumnIndex(header, DATE_HEADERS);
      const descIdx = guessColumnIndex(header, DESC_HEADERS);
      const amountIdx = guessColumnIndex(header, AMOUNT_HEADERS);
      const typeIdx = guessColumnIndex(header, TYPE_HEADERS);
      if (dateIdx >= 0) setDateCol(dateIdx);
      if (descIdx >= 0) setDescCol(descIdx);
      if (amountIdx >= 0) setAmountCol(amountIdx);
      setTypeCol(typeIdx >= 0 ? typeIdx : -1);
    } else {
      setRawRows([]);
      setPreview([]);
    }
  }

  async function handleImport() {
    if (preview.length === 0) return;
    setLoading(true);
    const result = await importTransactions(workspaceId, preview);
    setLoading(false);
    if (result.ok) {
      onClose();
      alert(t("successMessage", { imported: result.imported, skipped: result.skipped }));
      const first = preview[0];
      if (first?.date && typeof currentYear === "number" && typeof currentMonth === "number") {
        const [y, m] = first.date.split("-").map(Number);
        const targetMonth = m - 1;
        if (y !== currentYear || targetMonth !== currentMonth) {
          router.push(`/dashboard/transactions?year=${y}&month=${targetMonth}`);
          return;
        }
      }
      router.refresh();
    } else {
      alert(result.error);
    }
  }

  const dataRows = skipHeader ? rawRows.slice(1) : rawRows;
  const maxCol = Math.max(...(dataRows.map((r) => r.length) ?? [0]), 1);

  // Build column options for select dropdowns
  const headerRow = skipHeader && rawRows.length > 0 ? rawRows[0] : null;
  const colOptions = Array.from({ length: maxCol }, (_, i) => ({
    value: i,
    label: headerRow?.[i]?.trim() ? `${i} — ${headerRow[i].trim()}` : `${t("colIndex")} ${i}`,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
      <div className="bg-card border border-border rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <h2 className="text-lg font-bold text-foreground">{t("title")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary"
            aria-label={tCommon("close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium">{t("fileLabel")}</span>
            <input
              type="file"
              accept=".csv,text/csv,application/csv,text/comma-separated-values"
              onChange={handleFileChange}
              className="mt-1 block w-full text-sm"
            />
          </label>
          {rawRows.length > 0 && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={skipHeader}
                  onChange={(e) => setSkipHeader(e.target.checked)}
                />
                {t("firstLineHeader")}
              </label>
              <p className="text-sm text-muted-foreground">
                {t("transactionsDetected", { count: preview.length })}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex flex-col gap-1">
                  <span className="font-medium text-muted-foreground">{t("colDate")}</span>
                  <select
                    value={dateCol}
                    onChange={(e) => setDateCol(parseInt(e.target.value, 10))}
                    className="border border-border rounded px-2 py-1 bg-background text-foreground"
                  >
                    {colOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-medium text-muted-foreground">{t("colDesc")}</span>
                  <select
                    value={descCol}
                    onChange={(e) => setDescCol(parseInt(e.target.value, 10))}
                    className="border border-border rounded px-2 py-1 bg-background text-foreground"
                  >
                    {colOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-medium text-muted-foreground">{t("colAmount")}</span>
                  <select
                    value={amountCol}
                    onChange={(e) => setAmountCol(parseInt(e.target.value, 10))}
                    className="border border-border rounded px-2 py-1 bg-background text-foreground"
                  >
                    {colOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-medium text-muted-foreground">{t("colType")}</span>
                  <select
                    value={typeCol}
                    onChange={(e) => setTypeCol(parseInt(e.target.value, 10))}
                    className="border border-border rounded px-2 py-1 bg-background text-foreground"
                  >
                    <option value={-1}>{t("colTypeNone")}</option>
                    {colOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="max-h-40 overflow-y-auto border border-border rounded-lg p-2 text-xs">
                {preview.length > 0 ? (
                  preview.slice(0, 10).map((r, i) => (
                    <div key={i} className="flex justify-between py-1 gap-2">
                      <span className="shrink-0">{r.date}</span>
                      <span className="truncate min-w-0 flex-1">{r.description}</span>
                      <span className="shrink-0">
                        {r.type === "income" ? "+" : "-"} {r.amount.toFixed(2)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground py-2">
                    {t("noTransactionsDetected")} {t("rawDataPreview")}
                  </p>
                )}
                {preview.length === 0 && dataRows.slice(0, 5).map((row, i) => (
                  <div key={i} className="font-mono text-[10px] py-0.5 truncate" title={row.join(" | ")}>
                    {row.slice(0, 5).join(" | ")}
                  </div>
                ))}
              </div>
            </>
          )}
          <button
            type="button"
            onClick={handleImport}
            disabled={loading || preview.length === 0}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-hero-gradient px-4 py-2.5 font-semibold text-primary-foreground disabled:opacity-70"
          >
            <Upload className="h-4 w-4" />
            {loading ? t("importing") : t("importButton", { count: preview.length })}
          </button>
        </div>
      </div>
    </div>
  );
}
