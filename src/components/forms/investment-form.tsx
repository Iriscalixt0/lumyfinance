"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Plus } from "lucide-react";
import { createInvestment, updateInvestment } from "@/actions/investments";
import { parseBRL } from "@/lib/utils/currency";
import { getTodayISO } from "@/lib/utils/dates";
import { DatePicker } from "@/components/date-picker";
import { SimpleSelect } from "@/components/simple-select";
import { useVisitor } from "@/components/visitor/visitor-context";

type InvestmentForEdit = {
  id: string;
  name: string;
  amount: number;
  date: string;
  type: string;
};

export function InvestmentForm({
  workspaceId,
  investment,
  onEditSuccess,
}: {
  workspaceId: string;
  investment?: InvestmentForEdit;
  onEditSuccess?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [date, setDate] = useState<string>(() => investment?.date ?? getTodayISO());
  const [type, setType] = useState<string>(() => investment?.type ?? "outro");
  const router = useRouter();
  const t = useTranslations("forms.investment");
  const tTransaction = useTranslations("forms.transaction");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { requirePro } = useVisitor();
  const today = getTodayISO();
  const isEdit = !!investment;

  useEffect(() => {
    if (isEdit && investment) {
      setDate(investment.date);
      setType(investment.type ?? "outro");
    }
  }, [isEdit, investment]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!requirePro()) return;
    setLoading(true);
    setToast(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const payload = {
      workspace_id: workspaceId,
      name: formData.get("name") as string,
      amount: parseBRL(formData.get("amount") as string),
      date: formData.get("date") as string,
      type: (formData.get("type") as string) || undefined,
    };
    try {
      if (isEdit) {
        await updateInvestment(investment.id, workspaceId, payload);
        setToast(t("updated"));
        if (onEditSuccess) {
          onEditSuccess();
        } else {
          router.refresh();
        }
        router.refresh();
      } else {
        await createInvestment(payload);
        setToast(t("registered"));
        setDate(today);
        setType("outro");
        form.reset();
        router.refresh();
      }
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  const defaultName = isEdit ? investment.name : "";
  const defaultAmount = isEdit ? (investment.amount / 100).toFixed(2) : "";

  const typeOptions = [
    { value: "outro", label: t("types.outro") },
    { value: "cdb", label: t("types.cdb") },
    { value: "lci", label: t("types.lci") },
    { value: "lca", label: t("types.lca") },
    { value: "tesouro", label: t("types.tesouro") },
    { value: "acao", label: t("types.acao") },
    { value: "fii", label: t("types.fii") },
    { value: "crypto", label: t("types.crypto") },
  ];

  return (
    <div className="bg-card border border-border rounded-2xl shadow-card p-4 sm:p-6 w-full max-w-full lg:max-w-none">
      <h4 className="font-bold text-foreground mb-4 sm:mb-6 text-sm sm:text-base flex items-center gap-2">
        {!isEdit && <Plus size={20} className="text-primary" />}
        {isEdit ? t("edit") : t("new")}
      </h4>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-bold text-emerald-800 dark:text-emerald-600 uppercase ml-1 block mb-1">
            {t("date")}
          </label>
          <DatePicker
            id="inv-date"
            name="date"
            value={date}
            onChange={setDate}
            required
            locale={locale}
            placeholder={tTransaction("datePlaceholder")}
            clearLabel={tTransaction("dateClear")}
            todayLabel={tTransaction("dateToday")}
          />
        </div>
        <div>
          <label className="text-sm font-bold text-emerald-800 dark:text-emerald-600 uppercase ml-1 block mb-1">
            {t("assetName")}
          </label>
          <input
            type="text"
            name="name"
            required
            placeholder={t("placeholderName")}
            defaultValue={defaultName}
            className="w-full px-4 py-3 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <label className="text-sm font-bold text-emerald-800 dark:text-emerald-600 uppercase ml-1 block mb-1">
            {t("category")}
          </label>
          <SimpleSelect
            name="type"
            value={type}
            onChange={setType}
            options={typeOptions}
          />
        </div>
        <div>
          <label className="text-sm font-bold text-emerald-800 dark:text-emerald-600 uppercase ml-1 block mb-1">
            {t("value")}
          </label>
          <input
            type="text"
            inputMode="decimal"
            name="amount"
            required
            placeholder={t("placeholderAmount")}
            defaultValue={defaultAmount}
            className="w-full px-4 py-3 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground placeholder:text-sm font-medium"
          />
        </div>
        {toast && (
          <p className={`text-sm font-medium ${toast.includes("!") || toast === t("updated") ? "text-emerald-600" : "text-rose-600"}`}>
            {toast}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold shadow-lg shadow-primary/20 transition-all disabled:opacity-70 active:scale-[0.98]"
        >
          {loading ? (isEdit ? tTransaction("updating") : tTransaction("saving")) : isEdit ? tCommon("update") : t("confirm")}
        </button>
      </form>
    </div>
  );
}
