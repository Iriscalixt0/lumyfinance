/**
 * Configuração central do produto — única fonte de verdade para copy e limites.
 * Não existe uso gratuito: é obrigatório assinar o Pro para usar o app.
 * Trial: 7 dias grátis para assinantes, depois o Stripe cobra automaticamente.
 *
 * Pro: Até 2 workspaces, até 3 membros.
 */
/** Contatos de suporte — e-mail, telefone e redes sociais */
export const SUPPORT_CONFIG = {
  email: "graphyx.ai@gmail.com",
  phone: "+55 21 979065289",
  whatsapp: "https://wa.me/5521979065289",
  instagram: "https://instagram.com/graphyx.ai",
  linkedin: "https://linkedin.com/company/graphyx",
} as const;

export const PRODUCT_CONFIG = {
  trialDays: 7,
  maxWorkspaces: 2,
  maxMembersPerWorkspace: 3,
  /** Preço Pro em BRL (R$/mês) */
  priceProMonthly: 9.9,
  /** Preço Pro em USD (US$/mês) */
  priceProMonthlyUSD: 10,
  hasPaymentIntegration: true,
} as const;

/** Locales que usam BRL (Brasil). Demais usam USD. */
export const BRL_LOCALES = ["pt-BR"] as const;

export function isBRLocale(locale: string): boolean {
  return BRL_LOCALES.includes(locale as (typeof BRL_LOCALES)[number]);
}

/** Moedas suportadas: BRL (Brasil), EUR (Europa), USD (demais). */
export type PlanCurrency = "BRL" | "USD" | "EUR";

/**
 * Mapeamento país (ISO 3166-1 alpha-2) → moeda e valor para exibição.
 * BRL para Brasil, EUR para países europeus, USD para demais.
 */
const COUNTRY_PRICE: Record<string, { currency: PlanCurrency; value: number; locale: string }> = {
  BR: { currency: "BRL", value: PRODUCT_CONFIG.priceProMonthly, locale: "pt-BR" },
  US: { currency: "USD", value: PRODUCT_CONFIG.priceProMonthlyUSD, locale: "en" },
  PT: { currency: "EUR", value: 9, locale: "pt-PT" },
  ES: { currency: "EUR", value: 9, locale: "es" },
  FR: { currency: "EUR", value: 9, locale: "en" },
  DE: { currency: "EUR", value: 9, locale: "en" },
  IT: { currency: "EUR", value: 9, locale: "en" },
  AT: { currency: "EUR", value: 9, locale: "en" },
  BE: { currency: "EUR", value: 9, locale: "en" },
  NL: { currency: "EUR", value: 9, locale: "en" },
};

/**
 * Retorna a moeda para checkout conforme país (geolocalização).
 * Usado para selecionar o preço correto no Stripe.
 */
export function getCheckoutCurrencyByCountry(country: string | null): PlanCurrency {
  const code = country?.toUpperCase() ?? null;
  const config = code ? COUNTRY_PRICE[code] : null;
  return config?.currency ?? "USD";
}

/** Retorna true se a moeda do checkout for BRL. */
export function isCheckoutBRL(country: string | null): boolean {
  return getCheckoutCurrencyByCountry(country) === "BRL";
}

/** Retorna o preço mensal do Pro conforme locale. */
export function getPlanPrice(locale: string): { value: number; currency: "BRL" | "USD"; symbol: string } {
  const useBRL = isBRLocale(locale);
  return useBRL
    ? { value: PRODUCT_CONFIG.priceProMonthly, currency: "BRL", symbol: "R$" }
    : { value: PRODUCT_CONFIG.priceProMonthlyUSD, currency: "USD", symbol: "US$" };
}

/**
 * Mapeamento locale → moeda e valor para exibição e checkout.
 * Apenas pt-BR, pt-PT e en (idiomas suportados).
 */
const LOCALE_PRICE: Record<string, { currency: PlanCurrency; value: number; displayLocale: string }> = {
  "pt-BR": { currency: "BRL", value: PRODUCT_CONFIG.priceProMonthly, displayLocale: "pt-BR" },
  "pt-PT": { currency: "EUR", value: 9, displayLocale: "pt-PT" },
  en: { currency: "USD", value: PRODUCT_CONFIG.priceProMonthlyUSD, displayLocale: "en" },
  es: { currency: "EUR", value: 9, displayLocale: "es" },
};

/**
 * Retorna o preço mensal do Pro conforme locale selecionado manualmente.
 * Usado para exibição e seleção do Stripe Price ID no checkout.
 */
export function getPlanPriceByLocale(locale: string): {
  value: number;
  currency: PlanCurrency;
  symbol: string;
  formatted: string;
} {
  const config = LOCALE_PRICE[locale] ?? LOCALE_PRICE["en"];
  const { currency, value, displayLocale } = config;
  const formatted = new Intl.NumberFormat(displayLocale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  const symbol =
    new Intl.NumberFormat(displayLocale, { style: "currency", currency })
      .formatToParts(value)
      .find((p) => p.type === "currency")?.value ?? currency;
  return { value, currency, symbol, formatted };
}

/**
 * Retorna a moeda para checkout conforme locale selecionado manualmente.
 * Usado para selecionar o Stripe Price ID correto.
 */
export function getCheckoutCurrencyByLocale(locale: string): PlanCurrency {
  return (LOCALE_PRICE[locale] ?? LOCALE_PRICE["en"]).currency;
}

/**
 * Retorna o preço mensal do Pro conforme país detectado (geolocalização).
 * Moeda e valor são ajustados por país. Para checkout, Stripe usa BRL (BR) ou USD (demais).
 */
export function getPlanPriceByCountry(country: string | null): {
  value: number;
  currency: PlanCurrency;
  symbol: string;
  formatted: string;
} {
  const code = country?.toUpperCase() ?? null;
  const config = code ? COUNTRY_PRICE[code] : null;
  const fallback = {
    currency: "USD" as PlanCurrency,
    value: PRODUCT_CONFIG.priceProMonthlyUSD,
    locale: "en",
  };
  const { currency, value, locale } = config ?? fallback;
  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  const symbol = new Intl.NumberFormat(locale, { style: "currency", currency })
    .formatToParts(value)
    .find((p) => p.type === "currency")?.value ?? (currency === "BRL" ? "R$" : "US$");
  return { value, currency, symbol, formatted };
}
