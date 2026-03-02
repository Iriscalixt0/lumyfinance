import { Globe, ChevronDown } from "lucide-react";
import { useI18n, LOCALES, type Locale } from "@/lib/i18n";
import { useTranslations } from "@/lib/i18n";

export function LocaleSwitcher() {
  const { locale, setLocale } = useI18n();
  const t = useTranslations("common.locales");

  return (
    <div className="relative group shrink-0">
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="appearance-none min-h-[44px] min-w-[44px] sm:min-w-[130px] sm:w-auto pl-0 sm:pl-10 pr-0 sm:pr-8 py-2 rounded-xl bg-secondary text-muted-foreground hover:text-foreground text-xs sm:text-sm font-bold cursor-pointer border-0 focus:ring-2 focus:ring-primary focus:outline-none transition-colors overflow-hidden text-transparent sm:text-inherit sm:overflow-visible"
        aria-label={t("label")}
        title={t(locale)}
      >
        {LOCALES.map((loc) => (
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
