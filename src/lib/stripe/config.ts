import Stripe from "stripe";

const secret = process.env.STRIPE_SECRET_KEY;

export const stripe = secret
  ? new Stripe(secret, { apiVersion: "2026-01-28.clover" })
  : null;

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
export const STRIPE_PRICE_PRO = process.env.STRIPE_PRICE_PRO ?? "";
export const STRIPE_PRICE_BUSINESS = process.env.STRIPE_PRICE_BUSINESS ?? "";
export const STRIPE_PRICE_PRO_USD = process.env.STRIPE_PRICE_PRO_USD ?? "";
export const STRIPE_PRICE_BUSINESS_USD = process.env.STRIPE_PRICE_BUSINESS_USD ?? "";

/**
 * Preços Pro por moeda — BRL (pt-BR), EUR (pt-PT, es), USD (en).
 * Defina no .env: STRIPE_PRICE_PRO (BRL), STRIPE_PRICE_PRO_USD, STRIPE_PRICE_PRO_EUR.
 */
export const STRIPE_PRICES_PRO: Record<string, string> = {
  BRL: process.env.STRIPE_PRICE_PRO ?? "",
  USD: process.env.STRIPE_PRICE_PRO_USD ?? "",
  EUR: process.env.STRIPE_PRICE_PRO_EUR ?? "",
};

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
