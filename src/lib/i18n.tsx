import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import ptBR from "../../messages/pt-BR.json";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import ptPT from "../../messages/pt-PT.json";

export const LOCALES = ["pt-BR", "pt-PT", "en", "es"] as const;
export type Locale = (typeof LOCALES)[number];

const MESSAGES: Record<Locale, Record<string, any>> = {
  "pt-BR": ptBR,
  "pt-PT": ptPT,
  en,
  es,
};

const STORAGE_KEY = "lumyf-locale";

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "pt-BR";
  const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (stored && LOCALES.includes(stored)) return stored;
  const browserLang = navigator.language;
  if (browserLang.startsWith("pt-PT")) return "pt-PT";
  if (browserLang.startsWith("pt")) return "pt-BR";
  if (browserLang.startsWith("es")) return "es";
  if (browserLang.startsWith("en")) return "en";
  return "pt-BR";
}

/** Get nested value from object using dot-separated path */
function getNestedValue(obj: any, path: string): string | undefined {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let value = getNestedValue(MESSAGES[locale], key);
      if (value === undefined) {
        // Fallback to pt-BR
        value = getNestedValue(MESSAGES["pt-BR"], key);
      }
      if (value === undefined) return key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          value = value!.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        });
      }
      return value;
    },
    [locale]
  );

  const ctx = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={ctx}>{children}</I18nContext.Provider>;
}

export function useTranslations(prefix?: string) {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslations must be inside I18nProvider");

  const tPrefixed = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      return ctx.t(fullKey, params);
    },
    [ctx.t, prefix]
  );

  return tPrefixed;
}

export function useLocale(): Locale {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useLocale must be inside I18nProvider");
  return ctx.locale;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be inside I18nProvider");
  return ctx;
}
