"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Plus } from "lucide-react";
import { useVisitor } from "@/components/visitor/visitor-context";
import { createReceivable, updateReceivable } from "@/actions/receivables";
import { parseBRL } from "@/lib/utils/currency";
import { DatePicker } from "@/components/date-picker";
import { SimpleSelect } from "@/components/simple-select";
import type { ReceivableRow } from "@/actions/receivables";

export function ReceivableForm({
  workspaceId,
  receivable,
  onEditSuccess,
}: {
  workspaceId: string;
  receivable?: ReceivableRow;
  onEditSuccess?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string>(() => receivable?.due_date ?? "");
  const [status, setStatus] = useState<string>(() => receivable?.status ?? "pending");
  const router = useRouter();
  const t = useTranslations("forms.receivable");
  const tTransaction = useTranslations("forms.transaction");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const isEdit = !!receivable;

  useEffect(() => {
    if (isEdit && receivable) {
      setDueDate(receivable.due_date ?? "");
      setStatus(receivable.status ?? "pending");
    }
  }, [isEdit, receivable]);

  const { requirePro } = useVisitor();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!requirePro()) return;
    setLoading(true);
    setToast(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const amount = parseBRL(formData.get("amount") as string);
    const payload = {
      workspace_id: workspaceId,
      debtor_name: (formData.get("debtor_name") as string).trim(),
      amount,
      due_date: (formData.get("due_date") as string) || null,
      status: (formData.get("status") as "pending" | "paid" | "overdue") || "pending",
      phone: (formData.get("phone") as string)?.trim() || null,
      notes: (formData.get("notes") as string)?.trim() || null,
    };
    try {
      if (isEdit) {
        await updateReceivable(receivable.id, workspaceId, payload);
        setToast(t("updated"));
        onEditSuccess?.();
        router.refresh();
      } else {
        await createReceivable(payload);
        setToast(t("added"));
        setDueDate("");
        form.reset();
        router.refresh();
      }
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  const statusOptions = [
    { value: "pending", label: t("pending") },
    { value: "overdue", label: t("overdue") },
    { value: "paid", label: t("paid") },
  ];

  return (
    <div className="bg-card border border-border rounded-2xl shadow-card p-4 sm:p-6 w-full max-w-full lg:max-w-none">
      <h4 className="font-bold text-foreground mb-4 sm:mb-6 text-sm sm:text-base flex items-center gap-2">
        {!isEdit && <Plus size={20} className="text-primary" />}
        {isEdit ? t("edit") : t("new")}
      </h4>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="debtor_name" className="text-sm font-bold text-emerald-800 dark:text-emerald-600 uppercase ml-1 block mb-1">
            {t("debtor")}
          </label>
          <input
            id="debtor_name"
            name="debtor_name"
            type="text"
            required
            defaultValue={receivable?.debtor_name}
            placeholder={t("placeholderName")}
            className="w-full px-4 py-3 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <label htmlFor="amount" className="text-sm font-bold text-emerald-800 dark:text-emerald-600 uppercase ml-1 block mb-1">
            {t("amount")}
          </label>
          <input
            id="amount"
            name="amount"
            type="text"
            inputMode="decimal"
            required
            defaultValue={receivable ? (receivable.amount / 100).toFixed(2) : ""}
            placeholder="0,00"
            className="w-full px-4 py-3 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <label className="text-sm font-bold text-emerald-800 dark:text-emerald-600 uppercase ml-1 block mb-1">
            {t("dueDate")}
          </label>
          <DatePicker
            id="due_date"
            name="due_date"
            value={dueDate}
            onChange={setDueDate}
            locale={locale}
            placeholder={tTransaction("datePlaceholder")}
            clearLabel={tTransaction("dateClear")}
            todayLabel={tTransaction("dateToday")}
          />
        </div>
        {isEdit && (
          <div>
            <label className="text-sm font-bold text-emerald-800 dark:text-emerald-600 uppercase ml-1 block mb-1">
              {t("status")}
            </label>
            <SimpleSelect
              name="status"
              value={status}
              onChange={setStatus}
              options={statusOptions}
            />
          </div>
        )}
        <div>
          <label htmlFor="phone" className="text-sm font-bold text-emerald-800 dark:text-emerald-600 uppercase ml-1 block mb-1">
            {t("phone")}
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={receivable?.phone ?? ""}
            placeholder="11999999999"
            className="w-full px-4 py-3 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <label htmlFor="notes" className="text-sm font-bold text-emerald-800 dark:text-emerald-600 uppercase ml-1 block mb-1">
            {t("notes")}
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            defaultValue={receivable?.notes ?? ""}
            placeholder={t("placeholderNotes")}
            className="w-full px-4 py-3 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground resize-none"
          />
        </div>
        {toast && (
          <p className={`text-sm font-medium ${toast.startsWith("Erro") ? "text-rose-600" : "text-emerald-600"}`}>
            {toast}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? tTransaction("saving") : isEdit ? tCommon("update") : t("addCobranca")}
        </button>
      </form>
    </div>
  );
}
