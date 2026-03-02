"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Globe, ChevronDown } from "lucide-react";
import { routing, uiLocales } from "@/i18n/routing";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("common.locales");

  function handleChange(newLocale: string) {
    router.replace(pathname, { locale: newLocale as (typeof routing.locales)[number] });
  }

  return (
    <div className="relative group shrink-0">
      <select
        value={locale}
        onChange={(e) => handleChange(e.target.value)}
        className="appearance-none min-h-[44px] min-w-[44px] sm:min-w-[130px] sm:w-auto pl-0 sm:pl-10 pr-0 sm:pr-8 py-2 rounded-xl bg-secondary text-muted-foreground hover:text-foreground text-xs sm:text-sm font-bold cursor-pointer border-0 focus:ring-2 focus:ring-primary focus:outline-none transition-colors overflow-hidden text-transparent sm:text-inherit sm:overflow-visible"
        aria-label={t("label")}
        title={t(locale)}
      >
        {uiLocales.map((loc) => (
          <option key={loc} value={loc}>
            {t(loc)}
          </option>
        ))}
      </select>
      <Globe
        className="absolute left-1/2 sm:left-3 top-1/2 -translate-x-1/2 sm:translate-x-0 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground pointer-events-none"
        aria-hidden
      />
      <ChevronDown
        className="hidden sm:block absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}
