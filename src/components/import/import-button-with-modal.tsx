"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";
import { ImportModal } from "./import-modal";
import type { Category } from "@/types/database";

export function ImportButtonWithModal({
  workspaceId,
  currentYear,
  currentMonth,
  expenseCategories,
  incomeCategories,
}: {
  workspaceId: string;
  currentYear?: number;
  currentMonth?: number;
  expenseCategories: Category[];
  incomeCategories: Category[];
}) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("import");
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
      >
        <Upload className="h-4 w-4" />
        {t("buttonLabel")}
      </button>
      {open && (
        <ImportModal
          workspaceId={workspaceId}
          currentYear={currentYear}
          currentMonth={currentMonth}
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
