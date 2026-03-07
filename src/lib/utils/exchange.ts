const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface RateCache {
  base: string;
  rates: Record<string, number>;
  fetchedAt: number;
}

const cache = new Map<string, RateCache>();

export const SUPPORTED_CURRENCIES = [
  // Moedas dos idiomas suportados pelo Lumyf
  { code: "BRL", symbol: "R$", name: "Real Brasileiro", flag: "🇧🇷" },
  { code: "USD", symbol: "$", name: "Dólar Americano", flag: "🇺🇸" },
  { code: "EUR", symbol: "€", name: "Euro", flag: "🇪🇺" },
  { code: "GBP", symbol: "£", name: "Libra Esterlina", flag: "🇬🇧" },
  { code: "MXN", symbol: "$", name: "Peso Mexicano", flag: "🇲🇽" },
  { code: "CHF", symbol: "CHF", name: "Franco Suíço", flag: "🇨🇭" },
  // Moedas mais usadas no mundo
  { code: "JPY", symbol: "¥", name: "Iene Japonês", flag: "🇯🇵" },
  { code: "CAD", symbol: "C$", name: "Dólar Canadense", flag: "🇨🇦" },
  { code: "AUD", symbol: "A$", name: "Dólar Australiano", flag: "🇦🇺" },
  { code: "CNY", symbol: "¥", name: "Yuan Chinês", flag: "🇨🇳" },
  { code: "INR", symbol: "₹", name: "Rupia Indiana", flag: "🇮🇳" },
  { code: "KRW", symbol: "₩", name: "Won Sul-Coreano", flag: "🇰🇷" },
  // América Latina
  { code: "ARS", symbol: "$", name: "Peso Argentino", flag: "🇦🇷" },
  { code: "CLP", symbol: "$", name: "Peso Chileno", flag: "🇨🇱" },
  { code: "COP", symbol: "$", name: "Peso Colombiano", flag: "🇨🇴" },
] as const;

export type CurrencyCode = typeof SUPPORTED_CURRENCIES[number]["code"];

export const DEFAULT_CURRENCY: CurrencyCode = "BRL";

/**
 * Fetch exchange rates from frankfurter.app (free, no API key).
 * Caches results for 1 hour.
 */
async function fetchRates(base: CurrencyCode): Promise<Record<string, number>> {
  const cached = cache.get(base);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.rates;
  }

  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${base}`);
    if (!res.ok) throw new Error(`Frankfurter API error: ${res.status}`);
    const data = await res.json();
    const rates: Record<string, number> = { [base]: 1, ...data.rates };
    cache.set(base, { base, rates, fetchedAt: Date.now() });
    return rates;
  } catch (err) {
    console.error("Failed to fetch exchange rates:", err);
    // Return identity rate as fallback
    return { [base]: 1 };
  }
}

/**
 * Convert an amount from one currency to another.
 * Amount is in the original currency's minor unit (cents).
 * Returns the converted amount in the target currency's minor unit (cents).
 */
export async function convertCurrency(
  amountCents: number,
  from: CurrencyCode,
  to: CurrencyCode
): Promise<{ convertedCents: number; rate: number }> {
  if (from === to) return { convertedCents: amountCents, rate: 1 };

  const rates = await fetchRates(from);
  const rate = rates[to];

  if (!rate) {
    console.warn(`No rate found for ${from} → ${to}`);
    return { convertedCents: amountCents, rate: 1 };
  }

  return {
    convertedCents: Math.round(amountCents * rate),
    rate,
  };
}

/**
 * Format amount in cents for a specific currency.
 */
export function formatAmount(cents: number, currency: CurrencyCode, locale = "pt-BR"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/**
 * Get the currency info object.
 */
export function getCurrencyInfo(code: CurrencyCode) {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code) ?? SUPPORTED_CURRENCIES[0];
}
