"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { MONTHS } from "@/lib/utils/dates";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3];

type FilterMode = "year" | "month" | "range";

export function InvestmentFilter({
  mode,
  year,
  month,
  fromMonth,
  toMonth,
}: {
  mode: FilterMode;
  year: number;
  month: number;
  fromMonth: number;
  toMonth: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("investments.filter");

  function buildUrl(newMode: FilterMode, newYear: number, newMonth: number, newFrom: number, newTo: number): string {
    const params = new URLSearchParams();
    params.set("year", String(newYear));
    if (newMode === "month") {
      params.set("month", String(newMonth));
    } else if (newMode === "range") {
      params.set("fromMonth", String(newFrom));
      params.set("toMonth", String(newTo));
    }
    return `/dashboard/investments?${params.toString()}`;
  }

  const navigate = (url: string) => {
    startTransition(() => {
      router.push(url);
    });
  };

  const handleModeChange = (newMode: FilterMode) => {
    const m = newMode === "month" ? month : newMode === "range" ? fromMonth : 0;
    const to = newMode === "range" ? toMonth : 11;
    navigate(buildUrl(newMode, year, m, m, to));
  };

  const handleYearChange = (newYear: number) => {
    navigate(buildUrl(mode, newYear, month, fromMonth, toMonth));
  };

  const handleMonthChange = (newMonth: number) => {
    navigate(buildUrl(mode, year, newMonth, fromMonth, toMonth));
  };

  const handleFromMonthChange = (newFrom: number) => {
    const to = newFrom <= toMonth ? toMonth : newFrom;
    navigate(buildUrl(mode, year, month, newFrom, to));
  };

  const handleToMonthChange = (newTo: number) => {
    const from = fromMonth <= newTo ? fromMonth : newTo;
    navigate(buildUrl(mode, year, month, from, newTo));
  };

  const selectClass =
    "px-3 py-2 bg-card border border-border rounded-xl text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-70 disabled:cursor-wait";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isPending && (
        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" aria-hidden />
      )}
      <span className="text-sm font-medium text-muted-foreground">{t("period")}</span>
      <select
        value={mode}
        onChange={(e) => handleModeChange(e.target.value as FilterMode)}
        disabled={isPending}
        className={selectClass}
      >
        <option value="year">{t("byYear")}</option>
        <option value="month">{t("byMonth")}</option>
        <option value="range">{t("betweenMonths")}</option>
      </select>

      <select
        value={year}
        onChange={(e) => handleYearChange(Number(e.target.value))}
        disabled={isPending}
        className={selectClass}
        aria-label={t("yearLabel")}
      >
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>

      {mode === "month" && (
        <select
          value={month}
          onChange={(e) => handleMonthChange(Number(e.target.value))}
          disabled={isPending}
          className={selectClass}
          aria-label={t("monthLabel")}
        >
          {MONTHS.map((name, index) => (
            <option key={name} value={index}>
              {name}
            </option>
          ))}
        </select>
      )}

      {mode === "range" && (
        <>
          <select
            value={fromMonth}
            onChange={(e) => handleFromMonthChange(Number(e.target.value))}
            disabled={isPending}
            className={selectClass}
            aria-label={t("fromLabel")}
          >
            {MONTHS.map((name, index) => (
              <option key={name} value={index}>
                {name}
              </option>
            ))}
          </select>
          <span className="text-muted-foreground text-sm">{t("to")}</span>
          <select
            value={toMonth}
            onChange={(e) => handleToMonthChange(Number(e.target.value))}
            disabled={isPending}
            className={selectClass}
            aria-label={t("toLabel")}
          >
            {MONTHS.map((name, index) => (
              <option key={name} value={index}>
                {name}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}
