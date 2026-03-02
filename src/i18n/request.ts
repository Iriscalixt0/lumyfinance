import { getRequestConfig } from "next-intl/server";
import type { AbstractIntlMessages } from "next-intl";
import { routing } from "./routing";

type Messages = AbstractIntlMessages;

const messageLoaders: Record<(typeof routing.locales)[number], () => Promise<{ default: Messages }>> = {
  "pt-BR": () => import("../../messages/pt-BR.json"),
  "pt-PT": () => import("../../messages/pt-PT.json"),
  en: () => import("../../messages/en.json"),
  es: () => import("../../messages/es.json"),
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeMessages(base: Messages, overrides: Messages): Messages {
  const merged: Messages = { ...base };

  Object.entries(overrides).forEach(([key, value]) => {
    const baseValue = merged[key];
    if (isPlainObject(baseValue) && isPlainObject(value)) {
      merged[key] = mergeMessages(baseValue, value);
      return;
    }
    merged[key] = value;
  });

  return merged;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && (routing.locales as readonly string[]).includes(requested)
    ? requested
    : routing.defaultLocale;

  const baseMessages = (await messageLoaders[routing.defaultLocale]()).default;
  const loader = messageLoaders[locale as (typeof routing.locales)[number]];
  const localeMessages = loader ? (await loader()).default : (await messageLoaders.en()).default;
  const messages = locale === routing.defaultLocale
    ? baseMessages
    : mergeMessages(baseMessages, localeMessages);

  return {
    locale,
    messages,
  };
});
