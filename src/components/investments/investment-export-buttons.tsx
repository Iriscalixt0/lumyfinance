"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";

export function InvestmentExportButtons({ queryString }: { queryString: string }) {
  const t = useTranslations("investments");
  const exportCsvUrl = `/api/investments/export-csv${queryString ? `?${queryString}` : ""}`;

  return (
    <div className="flex items-center gap-2 print:hidden">
      <Link
        href={exportCsvUrl}
        download
        className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm font-medium bg-card hover:bg-secondary/50 transition-all shadow-sm"
      >
        <Download size={16} /> {t("exportCsv")}
      </Link>
    </div>
  );
}
