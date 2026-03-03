const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const BASE_URL = "https://api.coingecko.com/api/v3";

interface PriceCache {
  prices: Record<string, CryptoPrice>;
  fetchedAt: number;
}

export interface CryptoPrice {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  image: string;
  market_cap: number;
  market_cap_rank: number;
}

let priceCache: PriceCache | null = null;

export const TOP_CRYPTOS = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "binancecoin", symbol: "BNB", name: "BNB" },
  { id: "solana", symbol: "SOL", name: "Solana" },
  { id: "ripple", symbol: "XRP", name: "XRP" },
  { id: "cardano", symbol: "ADA", name: "Cardano" },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin" },
  { id: "polkadot", symbol: "DOT", name: "Polkadot" },
  { id: "avalanche-2", symbol: "AVAX", name: "Avalanche" },
  { id: "chainlink", symbol: "LINK", name: "Chainlink" },
  { id: "matic-network", symbol: "MATIC", name: "Polygon" },
  { id: "litecoin", symbol: "LTC", name: "Litecoin" },
  { id: "uniswap", symbol: "UNI", name: "Uniswap" },
  { id: "stellar", symbol: "XLM", name: "Stellar" },
  { id: "cosmos", symbol: "ATOM", name: "Cosmos" },
] as const;

export type CryptoId = typeof TOP_CRYPTOS[number]["id"];

/**
 * Fetch prices for top cryptos from CoinGecko (free, no API key).
 * Cached for 5 minutes to avoid rate limits.
 */
export async function fetchCryptoPrices(vsCurrency = "brl"): Promise<Record<string, CryptoPrice>> {
  if (priceCache && Date.now() - priceCache.fetchedAt < CACHE_TTL) {
    return priceCache.prices;
  }

  try {
    const ids = TOP_CRYPTOS.map((c) => c.id).join(",");
    const res = await fetch(
      `${BASE_URL}/coins/markets?vs_currency=${vsCurrency}&ids=${ids}&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h`
    );

    if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);

    const data: CryptoPrice[] = await res.json();
    const prices: Record<string, CryptoPrice> = {};
    data.forEach((coin) => {
      prices[coin.id] = coin;
    });

    priceCache = { prices, fetchedAt: Date.now() };
    return prices;
  } catch (err) {
    console.error("Failed to fetch crypto prices:", err);
    return priceCache?.prices ?? {};
  }
}

/**
 * Fetch price for a single crypto by CoinGecko ID.
 */
export async function fetchSingleCryptoPrice(
  coinId: string,
  vsCurrency = "brl"
): Promise<CryptoPrice | null> {
  const prices = await fetchCryptoPrices(vsCurrency);
  return prices[coinId] ?? null;
}

/**
 * Format crypto amount with appropriate decimals.
 */
export function formatCryptoAmount(amount: number, symbol: string): string {
  const decimals = amount < 0.01 ? 8 : amount < 1 ? 6 : amount < 100 ? 4 : 2;
  return `${amount.toFixed(decimals)} ${symbol.toUpperCase()}`;
}

/**
 * Format fiat value from crypto holdings.
 */
export function formatCryptoValue(value: number, currency = "BRL", locale = "pt-BR"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(value);
}
