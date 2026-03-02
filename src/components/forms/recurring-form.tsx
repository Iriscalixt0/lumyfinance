"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createRecurring } from "@/actions/recurring";
import { parseBRL } from "@/lib/utils/currency";
import { CategorySelect } from "@/components/category-select";
import { useVisitor } from "@/components/visitor/visitor-context";
import type { Category } from "@/types/database";

export function RecurringForm({
  workspaceId,
  incomeCategories,
  expenseCategories,
}: {
  workspaceId: string;
  incomeCategories: Category[];
  expenseCategories: Category[];
}) {
  const router = useRouter();
  const t = useTranslations("forms.recurring");
  const { requirePro } = useVisitor();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<"income" | "expense">("expense");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<"weekly" | "biweekly" | "monthly" | "yearly">("monthly");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState("");

  const categories = type === "income" ? incomeCategories : expenseCategories;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!requirePro()) return;
    setError(null);
    const parsedAmount = parseBRL(amount);
    if (!description.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError(t("invalidData"));
      return;
    }
    setLoading(true);
    const result = await createRecurring({
      workspace_id: workspaceId,
      category_id: categoryId || null,
      type,
      amount: parsedAmount,
      description: description.trim(),
      frequency,
      start_date: startDate,
      end_date: endDate || null,
    });
    setLoading(false);
    if (result.ok) {
      setDescription("");
      setAmount("");
      setCategoryId("");
      router.refresh();
    } else {
      setError(result.error ?? t("error"));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-foreground">{t("type")}</span>
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value as "income" | "expense");
            setCategoryId("");
          }}
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5"
        >
          <option value="expense">{t("expense")}</option>
          <option value="income">{t("income")}</option>
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium text-foreground">{t("category")}</span>
        <div className="mt-1">
          <CategorySelect
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
            name="category_id"
            placeholder={t("optional")}
          />
        </div>
      </label>
      <label className="block">
        <span className="text-sm font-medium text-foreground">{t("description")}</span>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("placeholderDesc")}
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5"
          required
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-foreground">{t("amount")}</span>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0,00"
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5"
          required
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-foreground">{t("frequency")}</span>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as typeof frequency)}
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5"
        >
          <option value="weekly">{t("weekly")}</option>
          <option value="biweekly">{t("biweekly")}</option>
          <option value="monthly">{t("monthly")}</option>
          <option value="yearly">{t("yearly")}</option>
        </select>
      </label>
      <div className="grid grid-cols-1 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-foreground">{t("startDate")}</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5"
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-foreground">{t("endDate")} ({t("optional")})</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5"
          />
        </label>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full inline-flex items-center justify-center rounded-xl bg-hero-gradient px-4 py-2.5 font-semibold text-primary-foreground disabled:opacity-70"
      >
        {loading ? t("saving") : t("add")}
      </button>
    </form>
  );
}
