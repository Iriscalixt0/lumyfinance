/**
 * Utilitários de cleanup para dados de teste.
 * Usado por testes de integração e E2E para remover dados criados.
 */
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { randomUUID } from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;

/**
 * Remove workspace, members e profile de teste.
 */
export async function cleanupTestWorkspace(
  workspaceId: string,
  userId: string
): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await supabase.from("workspace_members").delete().eq("workspace_id", workspaceId);
  await supabase.from("workspaces").delete().eq("id", workspaceId);
  await supabase.from("profiles").delete().eq("id", userId);
}

/**
 * Cancela assinatura Stripe e remove customer.
 */
export async function cleanupStripeSubscription(
  subscriptionId: string,
  customerId: string
): Promise<void> {
  if (!STRIPE_SECRET?.startsWith("sk_test_")) return;

  const stripe = new Stripe(STRIPE_SECRET, { apiVersion: "2026-01-28.clover" });
  try {
    await stripe.subscriptions.cancel(subscriptionId);
  } catch {
    // subscription pode já estar cancelada
  }
  try {
    await stripe.customers.del(customerId);
  } catch {
    // customer pode já ter sido removido
  }
}

/**
 * Gera IDs únicos para testes.
 */
export function testIds(): { workspaceId: string; userId: string } {
  return {
    workspaceId: randomUUID(),
    userId: randomUUID(),
  };
}
