"use client";

import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Loader2 } from "lucide-react";

const YEARS = [2026];

export function ReportsYearSelector({
  year,
  selectYearLabel = "Ano",
}: {
  year: number;
  selectYearLabel?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleYearChange = (newYear: number) => {
    startTransition(() => {
      router.push(`/dashboard/reports?year=${newYear}`);
    });
  };

  const selectClass =
    "px-3 py-2 bg-card border border-border rounded-xl text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-70 disabled:cursor-wait";

  return (
    <div className="flex items-center gap-2">
      {isPending && (
        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" aria-hidden />
      )}
      <label htmlFor="reports-year" className="text-sm font-medium text-muted-foreground sr-only sm:not-sr-only">
        {selectYearLabel}
      </label>
      <select
        id="reports-year"
        value={year}
        onChange={(e) => handleYearChange(Number(e.target.value))}
        disabled={isPending}
        className={selectClass}
        aria-label={selectYearLabel}
      >
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
