import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["pt-BR", "pt-PT", "en", "es"],
  defaultLocale: "pt-BR",
  localePrefix: "always",
});

// Idiomas disponíveis no seletor: português, inglês e espanhol.
export const uiLocales = ["pt-BR", "pt-PT", "en", "es"] as const;
