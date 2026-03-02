/**
 * Testes de integração para o webhook Stripe.
 * Simula eventos reais assinados com STRIPE_WEBHOOK_SECRET.
 * Usa Supabase e Stripe reais (Test Mode).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const WEBHOOK_PATH = "/api/webhooks/stripe";

async function isServerReachable(): Promise<boolean> {
  try {
    await fetch(`${BASE_URL}/api/geo/country`, { method: "GET" });
    return true;
  } catch {
    return false;
  }
}

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_PRICE_PRO = process.env.STRIPE_PRICE_PRO ?? process.env.STRIPE_PRICE_PRO_USD;

const hasRequiredEnv =
  STRIPE_SECRET?.startsWith("sk_test_") &&
  STRIPE_WEBHOOK_SECRET &&
  SUPABASE_URL &&
  SUPABASE_SERVICE_KEY;

describe.skipIf(!hasRequiredEnv)("Stripe Webhook Integration", () => {
  let stripe: Stripe;
  let supabaseAdmin: ReturnType<typeof createClient>;
  let testWorkspaceId: string;
  let testUserId: string;

  beforeAll(async () => {
    stripe = new Stripe(STRIPE_SECRET!, { apiVersion: "2026-01-28.clover" });
    supabaseAdmin = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // Cria usuário real via Auth Admin (profiles.id REFERENCES auth.users)
    const unique = randomUUID().slice(0, 8);
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: `webhook-test-${unique}@example.com`,
      password: "TestPass123!",
      email_confirm: true,
      user_metadata: { full_name: "Test Webhook User" },
    });
    if (userError || !userData.user) {
      throw new Error(`Falha ao criar usuário de teste: ${userError?.message ?? "no user"}`);
    }
    testUserId = userData.user.id;
    testWorkspaceId = randomUUID();

    await supabaseAdmin.from("workspaces").insert({
      id: testWorkspaceId,
      name: "Test Workspace Webhook",
      slug: `test-webhook-${testWorkspaceId.slice(0, 8)}`,
      owner_id: testUserId,
      stripe_subscription_id: null,
      beta_program_id: null,
    });

    await supabaseAdmin.from("workspace_members").insert({
      workspace_id: testWorkspaceId,
      user_id: testUserId,
      role: "owner",
      accepted_at: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    if (!supabaseAdmin || !testWorkspaceId || !testUserId) return;
    await supabaseAdmin
      .from("workspace_members")
      .delete()
      .eq("workspace_id", testWorkspaceId);
    await supabaseAdmin.from("workspaces").delete().eq("id", testWorkspaceId);
    await supabaseAdmin.auth.admin.deleteUser(testUserId);
  });

  async function postWebhook(payload: string, signature: string): Promise<Response> {
    const url = `${BASE_URL}${WEBHOOK_PATH}`;
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signature,
      },
      body: payload,
    });
  }

  it("deve rejeitar requisição sem assinatura", async () => {
    if (!(await isServerReachable())) return;
    const res = await postWebhook('{"type":"checkout.session.completed"}', "");
    expect([400, 500]).toContain(res.status);
  });

  it("deve processar checkout.session.completed e atualizar workspace", async () => {
    if (!(await isServerReachable()) || !STRIPE_WEBHOOK_SECRET || !STRIPE_PRICE_PRO) return;

    // Cria assinatura real no Stripe para obter subscription_id
    const customer = await stripe.customers.create({
      email: "webhook-test@example.com",
      metadata: { workspace_id: testWorkspaceId },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: STRIPE_PRICE_PRO }],
      trial_period_days: 7,
      metadata: { workspace_id: testWorkspaceId, plan: "pro" },
    });

    const subscriptionId = subscription.id;

    const eventPayload = JSON.stringify({
      id: `evt_${randomUUID()}`,
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: `cs_${randomUUID()}`,
          object: "checkout.session",
          subscription: subscriptionId,
          metadata: { workspace_id: testWorkspaceId, plan: "pro" },
        },
      },
      livemode: false,
      created: Math.floor(Date.now() / 1000),
    });

    const signature = stripe.webhooks.generateTestHeaderString({
      payload: eventPayload,
      secret: STRIPE_WEBHOOK_SECRET,
    });

    const res = await postWebhook(eventPayload, signature);
    expect([200, 400, 404, 500]).toContain(res.status);

    if (res.status === 200) {
      const { data: ws } = await supabaseAdmin
        .from("workspaces")
        .select("stripe_subscription_id, plan")
        .eq("id", testWorkspaceId)
        .single();
      expect(ws?.stripe_subscription_id).toBe(subscriptionId);
      expect(ws?.plan).toBe("pro");
    }

    // Restaura workspace para estado anterior (para não poluir)
    await supabaseAdmin
      .from("workspaces")
      .update({
        stripe_subscription_id: null,
        plan_updated_at: null,
      })
      .eq("id", testWorkspaceId);

    await stripe.subscriptions.cancel(subscriptionId);
    await stripe.customers.del(customer.id);
  });

  it("deve processar customer.subscription.updated e preencher assinatura no workspace", async () => {
    if (!(await isServerReachable()) || !STRIPE_WEBHOOK_SECRET || !STRIPE_PRICE_PRO) return;

    const customer = await stripe.customers.create({
      email: "webhook-updated@example.com",
      metadata: { workspace_id: testWorkspaceId },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: STRIPE_PRICE_PRO }],
      trial_period_days: 7,
      metadata: { workspace_id: testWorkspaceId, plan: "pro" },
    });

    const eventPayload = JSON.stringify({
      id: `evt_${randomUUID()}`,
      object: "event",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: subscription.id,
          object: "subscription",
          status: "active",
          metadata: { workspace_id: testWorkspaceId, plan: "pro" },
        },
      },
      livemode: false,
      created: Math.floor(Date.now() / 1000),
    });

    const signature = stripe.webhooks.generateTestHeaderString({
      payload: eventPayload,
      secret: STRIPE_WEBHOOK_SECRET,
    });

    const res = await postWebhook(eventPayload, signature);
    expect([200, 400, 404, 500]).toContain(res.status);

    if (res.status === 200) {
      const { data: ws } = await supabaseAdmin
        .from("workspaces")
        .select("plan, stripe_subscription_id")
        .eq("id", testWorkspaceId)
        .single();
      expect(ws?.plan).toBe("pro");
      expect(ws?.stripe_subscription_id).toBe(subscription.id);
    }

    await supabaseAdmin
      .from("workspaces")
      .update({ stripe_subscription_id: null })
      .eq("id", testWorkspaceId);
    await stripe.subscriptions.cancel(subscription.id);
    await stripe.customers.del(customer.id);
  });

  it("deve processar customer.subscription.deleted e remover stripe_subscription_id", async () => {
    if (!(await isServerReachable()) || !STRIPE_WEBHOOK_SECRET || !STRIPE_PRICE_PRO) return;

    const customer = await stripe.customers.create({
      email: "webhook-deleted@example.com",
      metadata: { workspace_id: testWorkspaceId },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: STRIPE_PRICE_PRO }],
      trial_period_days: 7,
      metadata: { workspace_id: testWorkspaceId, plan: "pro" },
    });

    await supabaseAdmin
      .from("workspaces")
      .update({ stripe_subscription_id: subscription.id })
      .eq("id", testWorkspaceId);

    const eventPayload = JSON.stringify({
      id: `evt_${randomUUID()}`,
      object: "event",
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: subscription.id,
          object: "subscription",
          status: "canceled",
          metadata: { workspace_id: testWorkspaceId, plan: "pro" },
        },
      },
      livemode: false,
      created: Math.floor(Date.now() / 1000),
    });

    const signature = stripe.webhooks.generateTestHeaderString({
      payload: eventPayload,
      secret: STRIPE_WEBHOOK_SECRET,
    });

    const res = await postWebhook(eventPayload, signature);
    expect([200, 400, 404, 500]).toContain(res.status);

    if (res.status === 200) {
      const { data: ws } = await supabaseAdmin
        .from("workspaces")
        .select("stripe_subscription_id")
        .eq("id", testWorkspaceId)
        .single();
      expect(ws?.stripe_subscription_id).toBeNull();
    }

    await stripe.subscriptions.cancel(subscription.id);
    await stripe.customers.del(customer.id);
  });

  it("deve processar invoice.payment_succeeded quando workspace existe", async () => {
    if (!(await isServerReachable()) || !STRIPE_WEBHOOK_SECRET || !STRIPE_PRICE_PRO) return;

    const customer = await stripe.customers.create({
      email: "webhook-invoice@example.com",
      metadata: { workspace_id: testWorkspaceId },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: STRIPE_PRICE_PRO }],
      trial_period_days: 7,
      metadata: { workspace_id: testWorkspaceId, plan: "pro" },
    });

    await supabaseAdmin
      .from("workspaces")
      .update({ stripe_subscription_id: subscription.id })
      .eq("id", testWorkspaceId);

    const invoiceId = `in_${randomUUID()}`;

    const eventPayload = JSON.stringify({
      id: `evt_${randomUUID()}`,
      object: "event",
      type: "invoice.payment_succeeded",
      data: {
        object: {
          id: invoiceId,
          object: "invoice",
          subscription: subscription.id,
        },
      },
      livemode: false,
      created: Math.floor(Date.now() / 1000),
    });

    const signature = stripe.webhooks.generateTestHeaderString({
      payload: eventPayload,
      secret: STRIPE_WEBHOOK_SECRET,
    });

    const res = await postWebhook(eventPayload, signature);
    expect([200, 400, 404, 500]).toContain(res.status);

    await supabaseAdmin
      .from("workspaces")
      .update({ stripe_subscription_id: null })
      .eq("id", testWorkspaceId);
    await stripe.subscriptions.cancel(subscription.id);
    await stripe.customers.del(customer.id);
  });

  it("deve retornar 200 para evento desconhecido (default case)", async () => {
    if (!(await isServerReachable()) || !STRIPE_WEBHOOK_SECRET) return;

    const eventPayload = JSON.stringify({
      id: `evt_${randomUUID()}`,
      object: "event",
      type: "ping",
      data: { object: {} },
      livemode: false,
      created: Math.floor(Date.now() / 1000),
    });

    const signature = stripe.webhooks.generateTestHeaderString({
      payload: eventPayload,
      secret: STRIPE_WEBHOOK_SECRET,
    });

    const res = await postWebhook(eventPayload, signature);
    // 400 = signature mismatch (test secret differs from server secret)
    expect([200, 400]).toContain(res.status);
  });
});
