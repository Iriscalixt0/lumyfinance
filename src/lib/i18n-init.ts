import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import ptBR from "../../messages/pt-BR.json";
import ptPT from "../../messages/pt-PT.json";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import fr from "../../messages/fr.json";
import de from "../../messages/de.json";

export const LOCALES = ["pt-BR", "pt-PT", "en", "es", "fr", "de"] as const;
export type Locale = (typeof LOCALES)[number];

const STORAGE_KEY = "lumyf-locale";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "pt-BR": { translation: ptBR },
      "pt-PT": { translation: ptPT },
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
      de: { translation: de },
    },
    supportedLngs: [...LOCALES],
    fallbackLng: "pt-BR",
    interpolation: {
      escapeValue: false,
      // Use {key} syntax like the old system
      prefix: "{",
      suffix: "}",
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: STORAGE_KEY,
      caches: ["localStorage"],
    },
    react: {
      useSuspense: false,
    },
  });

// Set document lang
document.documentElement.lang = i18n.language;
i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
  localStorage.setItem(STORAGE_KEY, lng);
});

export default i18n;
