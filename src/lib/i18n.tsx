/**
 * i18n wrapper — delegates to i18next while keeping the same API
 * so all existing components work without import changes.
 */
import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import i18n from "./i18n-init";

// Re-export types and constants
export { LOCALES, type Locale } from "./i18n-init";

interface I18nContextType {
  locale: string;
  setLocale: (locale: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * I18nProvider — now a thin passthrough since i18next manages state globally.
 * Kept for backward compatibility with main.tsx tree.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/**
 * useTranslations — drop-in replacement using i18next.
 * Accepts optional prefix like "dashboard" to scope keys.
 */
export function useTranslations(prefix?: string) {
  const { t } = useTranslation();

  return useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      return t(fullKey, params as any) as string;
    },
    [t, prefix]
  );
}

/**
 * useLocale — returns current i18next language.
 */
export function useLocale() {
  const { i18n: instance } = useTranslation();
  return instance.language as import("./i18n-init").Locale;
}

/**
 * useI18n — returns locale, setLocale, and t function.
 */
export function useI18n(): I18nContextType {
  const { t, i18n: instance } = useTranslation();

  const setLocale = useCallback((lng: string) => {
    instance.changeLanguage(lng);
  }, [instance]);

  const translate = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      return t(key, params as any) as string;
    },
    [t]
  );

  return {
    locale: instance.language,
    setLocale,
    t: translate,
  };
}
