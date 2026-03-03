import { useMemo } from "react";
import { useLocale, type Locale } from "@/lib/i18n";

const CURRENCY_MAP: Record<Locale, string> = {
  "pt-BR": "BRL",
  "pt-PT": "EUR",
  en: "USD",
  es: "EUR",
};

const DATE_LOCALE_MAP: Record<Locale, string> = {
  "pt-BR": "pt-BR",
  "pt-PT": "pt-PT",
  en: "en-US",
  es: "es-ES",
};

/**
 * Hook that returns locale-aware formatting functions for currency and dates.
 * Adapts automatically based on the user's selected language.
 */
export function useIntlFormat() {
  const locale = useLocale();
  const dateLocale = DATE_LOCALE_MAP[locale] ?? "en-US";
  const currency = CURRENCY_MAP[locale] ?? "USD";

  return useMemo(() => {
    const currencyFmt = new Intl.NumberFormat(dateLocale, {
      style: "currency",
      currency,
    });

    const shortDateFmt = new Intl.DateTimeFormat(dateLocale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const longDateFmt = new Intl.DateTimeFormat(dateLocale, {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const shortDateTimeFmt = new Intl.DateTimeFormat(dateLocale, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    const monthYearFmt = new Intl.DateTimeFormat(dateLocale, {
      month: "long",
      year: "numeric",
    });

    return {
      /** Current locale */
      locale,
      /** Currency code for current locale (BRL, EUR, USD) */
      currency,

      /** Format cents into locale currency string. E.g. R$ 1.500,00 or $15.00 */
      money: (cents: number): string => currencyFmt.format(cents / 100),

      /** Format a Date or ISO string as short date. E.g. 03/03/2026 or 03/03/2026 */
      date: (value: string | Date): string => {
        const d = typeof value === "string" ? new Date(value) : value;
        return shortDateFmt.format(d);
      },

      /** Format a Date or ISO string as long date. E.g. 03 de março de 2026 */
      dateLong: (value: string | Date): string => {
        const d = typeof value === "string" ? new Date(value) : value;
        return longDateFmt.format(d);
      },

      /** Format as short date+time. E.g. 03 mar, 14:30 */
      dateTime: (value: string | Date): string => {
        const d = typeof value === "string" ? new Date(value) : value;
        return shortDateTimeFmt.format(d);
      },

      /** Format month + year. E.g. março de 2026 */
      monthYear: (value: string | Date): string => {
        const d = typeof value === "string" ? new Date(value) : value;
        return monthYearFmt.format(d);
      },

      /** Format a number with locale grouping. E.g. 1.500,00 or 1,500.00 */
      number: (value: number, decimals = 2): string => {
        return new Intl.NumberFormat(dateLocale, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(value);
      },

      /** Format percentage. E.g. 85,50% or 85.50% */
      percent: (value: number, decimals = 1): string => {
        return new Intl.NumberFormat(dateLocale, {
          style: "percent",
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(value / 100);
      },
    };
  }, [locale, dateLocale, currency]);
}

/**
 * Standalone function (non-hook) for use outside React components.
 * Defaults to pt-BR / BRL.
 */
export function formatByLocale(
  cents: number,
  locale: Locale = "pt-BR"
): string {
  const currency = CURRENCY_MAP[locale] ?? "BRL";
  const dateLocale = DATE_LOCALE_MAP[locale] ?? "pt-BR";
  return new Intl.NumberFormat(dateLocale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function formatDateByLocale(
  value: string | Date,
  locale: Locale = "pt-BR"
): string {
  const dateLocale = DATE_LOCALE_MAP[locale] ?? "pt-BR";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(dateLocale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}
