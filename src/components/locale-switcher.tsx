import { useI18n, LOCALES, type Locale } from "@/lib/i18n";
import { useTranslations } from "@/lib/i18n";

const FLAGS: Record<Locale, string> = {
  "pt-BR": "🇧🇷",
  "pt-PT": "🇵🇹",
  en: "🇺🇸",
  es: "🇪🇸",
  fr: "🇫🇷",
  de: "🇩🇪",
};

const SHORT_LABELS: Record<Locale, string> = {
  "pt-BR": "Português",
  "pt-PT": "Português (Portugal)",
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
};

export function LocaleSwitcher() {
  const { locale, setLocale } = useI18n();
  const t = useTranslations("common.locales");

  return (
    <div className="relative group shrink-0">
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="appearance-none min-h-[36px] min-w-[36px] sm:min-w-[180px] sm:w-auto pl-0 sm:pl-9 pr-0 sm:pr-7 py-1.5 rounded-xl bg-transparent sm:bg-secondary text-muted-foreground hover:text-foreground text-xs sm:text-sm font-medium cursor-pointer border-0 focus:ring-2 focus:ring-primary focus:outline-none transition-colors overflow-hidden text-transparent sm:text-inherit sm:overflow-visible"
        aria-label={t("label")}
        title={SHORT_LABELS[locale as Locale]}
      >
        {LOCALES.map((loc) => (
          <option key={loc} value={loc}>
            {SHORT_LABELS[loc]}
          </option>
        ))}
      </select>
      <span className="absolute left-1/2 sm:left-3 top-1/2 -translate-x-1/2 sm:translate-x-0 -translate-y-1/2 text-base sm:text-lg pointer-events-none" aria-hidden>
        {FLAGS[locale as Locale] || "🌐"}
      </span>
      <span className="hidden sm:block absolute right-3 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none text-muted-foreground" aria-hidden>
        ▾
      </span>
    </div>
  );
}
