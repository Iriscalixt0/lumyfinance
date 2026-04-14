import { useI18n, LOCALES, type Locale } from "@/lib/i18n";
import { useTranslations } from "@/lib/i18n";
import { Globe } from "lucide-react";

const SHORT_CODES: Record<Locale, string> = {
  "pt-BR": "BR",
  "pt-PT": "PT",
  en: "EN",
  es: "ES",
  fr: "FR",
  de: "DE",
};

const FULL_LABELS: Record<Locale, string> = {
  "pt-BR": "Português",
  "pt-PT": "Português (PT)",
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
};

export function LocaleSwitcher() {
  const { locale, setLocale } = useI18n();
  const t = useTranslations("common.locales");

  return (
    <div className="relative shrink-0">
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="appearance-none h-9 pl-8 pr-3 rounded-full bg-white/10 text-white/80 hover:text-white text-xs font-medium cursor-pointer border border-white/10 focus:ring-2 focus:ring-primary focus:outline-none transition-colors"
        aria-label={t("label")}
        title={FULL_LABELS[locale as Locale]}
      >
        {LOCALES.map((loc) => (
          <option key={loc} value={loc} className="bg-[hsl(160,40%,10%)] text-white">
            {SHORT_CODES[loc]}
          </option>
        ))}
      </select>
      <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-white/60" />
    </div>
  );
}
