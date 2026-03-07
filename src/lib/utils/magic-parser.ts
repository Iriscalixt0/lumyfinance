/**
 * Parse a "magic input" string into structured transaction data.
 * Handles: "Uber 25.50", "Netflix 15 USD", "Aluguel 1200", "Café 3€"
 * Detects currency symbols inline and infers category.
 */

import { predictCategory, detectLanguage } from "./voice-parser";
import { getLearnedCategory } from "./magic-learn";
import type { CurrencyCode } from "./exchange";

export interface MagicParsed {
  description: string;
  amount: number | null;
  currency: CurrencyCode | null;
  category: string | null;
  type: "expense" | "income";
  date: string;
  detectedLang: string;
  raw: string;
}

// Currency symbol → code
const SYMBOL_MAP: Record<string, CurrencyCode> = {
  "R$": "BRL",
  "C$": "CAD",
  "A$": "AUD",
  "$": "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
  "₹": "INR",
  "₩": "KRW",
};

// Currency word → code (all supported currencies)
const CURRENCY_WORDS: Record<string, CurrencyCode> = {
  // USD
  usd: "USD", dollars: "USD", dollar: "USD", dólar: "USD", dolares: "USD", bucks: "USD",
  // EUR
  eur: "EUR", euros: "EUR", euro: "EUR",
  // BRL
  brl: "BRL", reais: "BRL", real: "BRL",
  // GBP
  gbp: "GBP", pounds: "GBP", pound: "GBP", libras: "GBP", libra: "GBP",
  // JPY
  jpy: "JPY", yen: "JPY", iene: "JPY", ienes: "JPY",
  // CHF
  chf: "CHF", francos: "CHF", franco: "CHF",
  // CAD
  cad: "CAD",
  // AUD
  aud: "AUD",
  // CNY
  cny: "CNY", yuan: "CNY", yuanes: "CNY",
  // INR
  inr: "INR", rupias: "INR", rupia: "INR", rupees: "INR", rupee: "INR",
  // KRW
  krw: "KRW", won: "KRW",
  // MXN
  mxn: "MXN", pesos: "MXN",
  // ARS
  ars: "ARS",
  // CLP
  clp: "CLP",
  // COP
  cop: "COP",
};

const INCOME_WORDS = [
  "recebi", "ganhei", "salário", "salario", "renda", "freelance",
  "received", "earned", "salary", "income", "got paid",
  "recibí", "recibi", "gané", "gane", "sueldo",
  "reçu", "recu", "gagné", "gagne", "salaire",
  "erhalten", "verdient", "gehalt",
];

export function parseMagicInput(input: string, baseCurrency: CurrencyCode = "BRL"): MagicParsed {
  const raw = input.trim();
  if (!raw) {
    return { description: "", amount: null, currency: null, category: null, type: "expense", date: todayISO(), detectedLang: "pt-BR", raw };
  }

  const detectedLang = detectLanguage(raw);
  let text = raw;
  let detectedCurrency: CurrencyCode | null = null;
  let amount: number | null = null;

  // 1. Detect currency symbol with amount: "R$ 25.50", "$15", "€3", "£100"
  const symbolRegex = /(R\$|€|\$|£|¥)\s*([\d.,]+)/;
  const symbolMatch = text.match(symbolRegex);
  if (symbolMatch) {
    const sym = symbolMatch[1];
    detectedCurrency = SYMBOL_MAP[sym] || null;
    amount = parseNum(symbolMatch[2]);
    text = text.replace(symbolMatch[0], "").trim();
  }

  // 2. Detect amount + currency word: "15 USD", "100 euros", "50 reais"
  if (amount === null) {
    const wordRegex = /([\d.,]+)\s*(usd|eur|brl|gbp|jpy|dollars?|euros?|reais|real|pounds?|bucks?|yen)/i;
    const wordMatch = text.match(wordRegex);
    if (wordMatch) {
      amount = parseNum(wordMatch[1]);
      detectedCurrency = CURRENCY_WORDS[wordMatch[2].toLowerCase()] || null;
      text = text.replace(wordMatch[0], "").trim();
    }
  }

  // 3. Detect plain number at start or end: "Uber 25.50" or "25.50 Uber"
  if (amount === null) {
    // End: "Uber 25.50"
    const endMatch = text.match(/([\d.,]+)\s*$/);
    if (endMatch) {
      amount = parseNum(endMatch[1]);
      text = text.replace(endMatch[0], "").trim();
    }
  }
  if (amount === null) {
    // Start: "25.50 Uber"
    const startMatch = text.match(/^([\d.,]+)\s+/);
    if (startMatch) {
      amount = parseNum(startMatch[1]);
      text = text.replace(startMatch[0], "").trim();
    }
  }

  // 4. Clean description
  let description = text
    .replace(/^[\s\-–—:,]+/, "")
    .replace(/[\s\-–—:,]+$/, "")
    .trim();
  if (description) {
    description = description.charAt(0).toUpperCase() + description.slice(1);
  }

  // 5. Detect type
  const lower = raw.toLowerCase();
  const type = INCOME_WORDS.some(w => lower.includes(w)) ? "income" : "expense";

  // 6. Category inference — learned rules take priority
  const category = getLearnedCategory(description) || predictCategory(description) || predictCategory(raw);

  return {
    description,
    amount,
    currency: detectedCurrency,
    category,
    type,
    date: todayISO(),
    detectedLang,
    raw,
  };
}

function parseNum(s: string): number | null {
  // Handle "1.500,50" (BR) vs "1,500.50" (US) vs "25.50"
  if (/\d+\.\d{3},/.test(s)) {
    const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
    return isNaN(n) || n <= 0 ? null : n;
  }
  if (/\d+,\d{3}\./.test(s)) {
    const n = parseFloat(s.replace(/,/g, ""));
    return isNaN(n) || n <= 0 ? null : n;
  }
  const n = parseFloat(s.replace(",", "."));
  return isNaN(n) || n <= 0 ? null : n;
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}
