/**
 * Testes de integração para billing e Stripe.
 * Usa Supabase e Stripe reais (Test Mode). Sem mocks.
 */
import { describe, it, expect, beforeAll } from "vitest";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { PRODUCT_CONFIG } from "@/lib/product-config";

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_PRICE_PRO = process.env.STRIPE_PRICE_PRO;
const STRIPE_PRICE_PRO_USD = process.env.STRIPE_PRICE_PRO_USD;

const hasRequiredEnv =
  STRIPE_SECRET?.startsWith("sk_test_") && SUPABASE_URL && SUPABASE_SERVICE_KEY;

describe.skipIf(!hasRequiredEnv)("Billing Integration", () => {
  let stripe: Stripe;
  let supabaseAdmin: ReturnType<typeof createClient>;

  beforeAll(() => {
    stripe = new Stripe(STRIPE_SECRET!, { apiVersion: "2026-01-28.clover" });
    supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  describe("Configuração do produto", () => {
    it("deve ter 7 dias de trial conforme regra de negócio", () => {
      expect(PRODUCT_CONFIG.trialDays).toBe(7);
    });
  });

  describe("Stripe - sessão de checkout", () => {
    it("deve criar sessão de checkout com trial de 7 dias", async () => {
      if (!STRIPE_PRICE_PRO && !STRIPE_PRICE_PRO_USD) {
        return; // skip se preços não configurados
      }
      const priceId = STRIPE_PRICE_PRO || STRIPE_PRICE_PRO_USD!;
      const customer = await stripe.customers.create({
        email: "integration-test@example.com",
        metadata: { test: "billing-integration" },
      });

      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: "http://localhost:3000/success",
        cancel_url: "http://localhost:3000/cancel",
        metadata: { workspace_id: "00000000-0000-0000-0000-000000000000", plan: "pro" },
        subscription_data: {
          trial_period_days: PRODUCT_CONFIG.trialDays,
          metadata: { workspace_id: "00000000-0000-0000-0000-000000000000", plan: "pro" },
        },
      });

      expect(session.url).toBeTruthy();
      expect(session.subscription).toBeNull(); // Ainda não completado
      expect(session.mode).toBe("subscription");

      // Limpeza
      await stripe.customers.del(customer.id);
    });
  });

  describe("Stripe - assinatura com trial", () => {
    it("deve criar assinatura com trial_period_days e não cobrar imediatamente", async () => {
      if (!STRIPE_PRICE_PRO && !STRIPE_PRICE_PRO_USD) return;
      const priceId = STRIPE_PRICE_PRO || STRIPE_PRICE_PRO_USD!;
      const customer = await stripe.customers.create({
        email: "trial-test@example.com",
        metadata: { test: "trial-integration" },
      });

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId }],
        trial_period_days: PRODUCT_CONFIG.trialDays,
        metadata: { workspace_id: "00000000-0000-0000-0000-000000000000", plan: "pro" },
      });

      expect(subscription.status).toBe("trialing");
      expect(subscription.trial_end).toBeTruthy();
      expect(subscription.trial_start).toBeTruthy();
      const trialDays = Math.round(
        (subscription.trial_end! - subscription.trial_start!) / (24 * 60 * 60)
      );
      expect(trialDays).toBe(PRODUCT_CONFIG.trialDays);

      // Limpeza
      await stripe.subscriptions.cancel(subscription.id);
      await stripe.customers.del(customer.id);
    });
  });

  describe("Stripe - cancelamento antes do trial", () => {
    it("deve cancelar assinatura antes do trial sem cobrança", async () => {
      if (!STRIPE_PRICE_PRO && !STRIPE_PRICE_PRO_USD) return;
      const priceId = STRIPE_PRICE_PRO || STRIPE_PRICE_PRO_USD!;
      const customer = await stripe.customers.create({
        email: "cancel-trial@example.com",
        metadata: { test: "cancel-before-trial" },
      });

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId }],
        trial_period_days: PRODUCT_CONFIG.trialDays,
        metadata: { workspace_id: "00000000-0000-0000-0000-000000000000", plan: "pro" },
      });

      expect(subscription.status).toBe("trialing");

      // Cancela imediatamente (antes do fim do trial)
      const canceled = await stripe.subscriptions.cancel(subscription.id);
      expect(canceled.status).toBe("canceled");

      // Verifica que não houve cobrança efetiva (invoice pago com valor > 0)
      const invoices = await stripe.invoices.list({
        customer: customer.id,
        status: "paid",
      });
      const paidWithAmount = invoices.data.filter((inv) => (inv.amount_paid ?? 0) > 0);
      expect(paidWithAmount.length).toBe(0);

      await stripe.customers.del(customer.id);
    });
  });
});
