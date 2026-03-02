"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { createTransaction, updateTransaction } from "@/actions/transactions";
import { parseBRL } from "@/lib/utils/currency";
import { CategorySelect } from "@/components/category-select";
import { SimpleSelect } from "@/components/simple-select";
import { TagsSelect, TAG_VALUES } from "@/components/tags-select";
import { DatePicker } from "@/components/date-picker";
import { useVisitor } from "@/components/visitor/visitor-context";
import type { Category } from "@/types/database";
import { Users, ChevronDown } from "lucide-react";

type WorkspaceMemberForPaidBy = { id: string; full_name: string };
const PAID_BY_INDIVIDUAL = "individual";
const PAID_BY_ALL = "all";

type TransactionForEdit = {
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
};

export function TransactionForm({
  workspaceId,
  year,
  month,
  incomeCategories,
  expenseCategories,
  workspaceMembers = [],
  defaultDate,
  transaction,
  onEditSuccess,
  onTransactionCreated,
}: {
  workspaceId: string;
  year: number;
  month: number;
  incomeCategories: Category[];
  expenseCategories: Category[];
  workspaceMembers?: WorkspaceMemberForPaidBy[];
  defaultDate: string;
  transaction?: TransactionForEdit;
  onEditSuccess?: () => void;
  onTransactionCreated?: (tx: { id: string; date: string; [key: string]: unknown }) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string>(() =>
    transaction?.category_id ?? ""
  );
  const [type, setType] = useState<string>(() =>
    transaction?.type === "transfer" ? "expense" : (transaction?.type ?? "expense")
  );
  const [splitType, setSplitType] = useState<string>(() => {
    const raw = transaction?.split_type ?? "single";
    return raw === "split_custom" ? "split_equal" : raw;
  });
  const [paidBy, setPaidBy] = useState<string>(
    () => transaction?.paid_by ?? PAID_BY_INDIVIDUAL
  );
  const [divisionSectionOpen, setDivisionSectionOpen] = useState(false);
  const [tags, setTags] = useState<string[]>(() =>
    Array.isArray(transaction?.tags) && transaction.tags.length > 0
      ? [transaction.tags[0]]
      : ["fixo"]
  );
  const [date, setDate] = useState<string>(() =>
    transaction?.date ?? defaultDate
  );
  const t = useTranslations("forms.transaction");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { requirePro } = useVisitor();

  const tagLabels: Record<string, string> = Object.fromEntries(
    TAG_VALUES.map((v) => [v, t(`tagOptions.${v}`)])
  );

  const validateAmount = useCallback(
    (value: string) => {
      const parsed = parseBRL(value);
      if (!value || value.trim() === "") {
        setAmountError(null);
        return false;
      }
      if (isNaN(parsed) || parsed <= 0) {
        setAmountError(t("invalidAmount"));
        return false;
      }
      setAmountError(null);
      return true;
    },
    [t]
  );
  const router = useRouter();
  const isEdit = !!transaction;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!requirePro()) return;
    setAmountError(null);
    setToast(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const amountStr = formData.get("amount") as string;
    if (!validateAmount(amountStr)) {
      return;
    }
    setLoading(true);
    const date = formData.get("date") as string;
    const description = formData.get("description") as string;
    const categoryId = formData.get("category_id") as string;
    const type = formData.get("type") as "income" | "expense" | "transfer";
    const amount = parseBRL(formData.get("amount") as string);
    const notes = (formData.get("notes") as string)?.trim() || undefined;
    const tagsStr = (formData.get("tags") as string)?.trim() || "";
    const tags =
      tagsStr.length > 0
        ? tagsStr
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 1)
        : undefined;
    const paidBy = (formData.get("paid_by") as string)?.trim() || null;
    const splitType = (formData.get("split_type") as "single" | "split_equal" | "split_custom") || "single";
    const payload = {
      workspace_id: workspaceId,
      category_id: categoryId && categoryId.length > 0 ? categoryId : null,
      type: type as "income" | "expense",
      amount,
      description,
      date,
      notes: notes || undefined,
      tags,
      paid_by:
        paidBy && paidBy !== PAID_BY_INDIVIDUAL && paidBy !== PAID_BY_ALL
          ? paidBy
          : null,
      split_type: splitType,
    };

    try {
      if (isEdit) {
        await updateTransaction(transaction!.id, workspaceId, {
          ...payload,
          type: type as "income" | "expense" | "transfer",
        });
        setToast(t("updated"));
        if (onEditSuccess) {
          onEditSuccess();
        } else {
          router.push(`/dashboard/transactions?year=${year}&month=${month}`);
        }
        router.refresh();
      } else {
        const created = await createTransaction(payload);
        setToast(t("saved"));
        setCategoryId("");
        setSplitType("single");
        setPaidBy(PAID_BY_INDIVIDUAL);
        setTags(["fixo"]);
        setDate(defaultDate);
        form.reset();
        if (created && onTransactionCreated) onTransactionCreated(created);
        router.refresh();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("errorSave");
      setToast(message);
      if (message.includes("3 transações")) {
        requirePro();
      }
    } finally {
      setLoading(false);
    }
  }

  const isDefaultDivision = splitType === "single" && paidBy === PAID_BY_INDIVIDUAL;
  const selectedPaidByMember = workspaceMembers.find((m) => m.id === paidBy);
  const isSharedWorkspace = workspaceMembers.length > 1;
  const paidByMemberOptions = isSharedWorkspace
    ? workspaceMembers.map((m) => ({ value: m.id, label: m.full_name }))
    : [];
  const divisionSummaryText = isDefaultDivision
    ? t("divisionSummaryOwn")
    : paidBy === PAID_BY_ALL
      ? t("divisionSummaryPaidBy", {
          name: t("paidByAll"),
        })
      : selectedPaidByMember
        ? t("divisionSummaryPaidBy", {
            name: selectedPaidByMember.full_name,
          })
        : t("divisionSummaryOwn");
  const paidByOptions = [
    { value: PAID_BY_ALL, label: t("paidByAll") },
    { value: PAID_BY_INDIVIDUAL, label: t("paidByIndividual") },
    ...paidByMemberOptions,
  ];
  useEffect(() => {
    if (paidBy === PAID_BY_INDIVIDUAL || paidBy === PAID_BY_ALL) return;
    const stillAvailable =
      isSharedWorkspace && workspaceMembers.some((member) => member.id === paidBy);
    if (!stillAvailable) {
      setPaidBy(PAID_BY_INDIVIDUAL);
    }
  }, [paidBy, isSharedWorkspace, workspaceMembers]);
  useEffect(() => {
    if (isEdit && transaction) {
      setCategoryId(transaction.category_id ?? "");
      setType(transaction.type === "transfer" ? "expense" : transaction.type);
      setSplitType(transaction.split_type ?? "single");
      setPaidBy(transaction.paid_by ?? PAID_BY_INDIVIDUAL);
      setTags(
        Array.isArray(transaction.tags) && transaction.tags.length > 0
          ? [transaction.tags[0]]
          : []
      );
      setDate(transaction.date ?? defaultDate);
    }
  }, [isEdit, transaction, defaultDate]);
  const defaultAmount = isEdit ? (transaction!.amount / 100).toFixed(2) : "";
  const defaultDesc = isEdit ? transaction!.description : "";
  const defaultNotes = isEdit ? (transaction!.notes ?? "") : "";
 
  return (
    <div className="bg-card border border-border rounded-2xl shadow-card p-4 sm:p-8 w-full max-w-full lg:max-w-none">
      <h4 className="font-bold text-foreground mb-4 sm:mb-6 text-sm sm:text-base">
        {isEdit ? t("edit") : t("new")}
      </h4>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-bold text-emerald-800 dark:text-emerald-600 uppercase ml-1 block mb-1">
            {t("date")}
          </label>
          <DatePicker
            id="date"
            name="date"
            value={date}
            onChange={setDate}
            required
            locale={locale}
            placeholder={t("datePlaceholder")}
            clearLabel={t("dateClear")}
            todayLabel={t("dateToday")}
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1 block mb-1">
            {t("description")}
          </label>
          <input
            type="text"
            name="description"
            required
            placeholder={t("placeholderDesc")}
            defaultValue={defaultDesc}
            className="w-full px-4 py-3 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1 block mb-1">
            {t("category")}
          </label>
          <CategorySelect
            expenseCategories={expenseCategories}
            incomeCategories={incomeCategories}
            value={categoryId}
            onChange={setCategoryId}
            name="category_id"
            expensesLabel={t("expenses")}
            incomeLabel={t("income")}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <input
              type="text"
              inputMode="decimal"
              name="amount"
              required
              placeholder={t("placeholderAmount")}
              defaultValue={defaultAmount}
              onBlur={(e) => validateAmount(e.target.value)}
              aria-invalid={!!amountError}
              aria-describedby={amountError ? "amount-error" : undefined}
              className={`w-full px-4 py-3 bg-background border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground placeholder:text-sm ${
                amountError ? "border-rose-500 focus:border-rose-500" : "border-border focus:border-primary"
              }`}
            />
            {amountError && (
              <p id="amount-error" className="mt-1 text-xs font-medium text-rose-600" role="alert">
                {amountError}
              </p>
            )}
          </div>
          <SimpleSelect
            name="type"
            value={type}
            onChange={setType}
            options={[
              { value: "expense", label: t("outflow") },
              { value: "income", label: t("inflow") },
            ]}
          />
        </div>
        <div className="border border-border rounded-xl overflow-hidden bg-background/50">
          {!divisionSectionOpen ? (
            <>
              <input type="hidden" name="split_type" value={splitType} readOnly aria-hidden />
              <input type="hidden" name="paid_by" value={paidBy} readOnly aria-hidden />
              <button
                type="button"
                onClick={() => setDivisionSectionOpen(true)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                aria-label={t("divisionExpandHint")}
                aria-expanded={false}
              >
                <Users className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide leading-none mb-0.5">
                    {t("divisionLabel")}
                  </p>
                  <p className="text-sm text-foreground truncate">
                    {divisionSummaryText}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
              </button>
            </>
          ) : (
            <div className="p-3 space-y-3">
              <button
                type="button"
                onClick={() => setDivisionSectionOpen(false)}
                className="w-full flex items-center justify-between gap-2 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                aria-expanded={true}
              >
                <span>{t("divisionExpandHint")}</span>
                <ChevronDown className="h-4 w-4 rotate-180 shrink-0" />
              </button>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1 block mb-1">
                  {t("splitType")}
                </label>
                <SimpleSelect
                  name="split_type"
                  value={splitType}
                  onChange={setSplitType}
                  options={[
                    { value: "single", label: t("splitSingle") },
                    { value: "split_equal", label: t("splitEqual") },
                  ]}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1 block mb-1">
                  {t("paidBy")}
                </label>
                <SimpleSelect
                  name="paid_by"
                  value={paidBy}
                  onChange={setPaidBy}
                  options={paidByOptions}
                />
              </div>
            </div>
          )}
        </div>
        <div>
          <label className="text-sm font-bold text-emerald-800 dark:text-emerald-600 uppercase ml-1 block mb-1">
            {t("tags")}
          </label>
          <TagsSelect
            name="tags"
            value={tags}
            onChange={setTags}
            placeholder={t("tagsSelectPlaceholder")}
            labels={tagLabels}
            single
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1 block mb-1">
            {t("notes")}
          </label>
          <textarea
            name="notes"
            rows={3}
            maxLength={500}
            placeholder={t("placeholderNotes")}
            defaultValue={defaultNotes}
            className="w-full px-4 py-3 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground resize-none"
          />
        </div>
        {toast && (
          <p
            className={`text-sm font-medium ${
              toast === t("saved") || toast === t("updated") ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {toast}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[44px] bg-hero-gradient text-primary-foreground font-semibold py-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-70"
        >
          {loading
            ? (isEdit ? t("updating") : t("saving"))
            : isEdit
              ? tCommon("update")
              : tCommon("save")}
        </button>
      </form>
    </div>
  );
}
