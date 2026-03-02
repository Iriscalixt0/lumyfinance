"use server";

import { createClient } from "@/lib/supabase/server";
import { createWorkspaceForVisitorUpgrade, ensureDefaultWorkspace } from "@/actions/workspaces";
import { stripe, STRIPE_PRICES_PRO, APP_URL } from "@/lib/stripe/config";
import { getCheckoutCurrencyByLocale } from "@/lib/product-config";
import {
  syncInviteeMembershipRolesForPlan,
  userHasOwnProSubscription,
} from "@/lib/workspace-membership-access";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const CreateCheckoutSchema = z.object({
  workspaceId: z.string().uuid(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  locale: z.string().optional(),
});

export type CreateCheckoutResult =
  | { ok: true; checkoutUrl: string; workspaceId?: string }
  | { ok: false; error: string };

const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_URL
  ? createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

export async function createCheckoutSession(
  input: z.infer<typeof CreateCheckoutSchema>
): Promise<CreateCheckoutResult> {
  if (!stripe) {
    return { ok: false, error: "Stripe não configurado. Entre em contato com o suporte." };
  }

  const parsed = CreateCheckoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos." };
  }

  const { workspaceId, successUrl, cancelUrl, locale = "pt-BR" } = parsed.data;

  const currency = getCheckoutCurrencyByLocale(locale);
  const SELECTED_PRICE_ID = STRIPE_PRICES_PRO[currency] ?? STRIPE_PRICES_PRO.USD;

  if (!SELECTED_PRICE_ID) {
    return {
      ok: false,
      error: `Preços em ${currency} não configurados. Configure STRIPE_PRICE_PRO_${currency} no .env`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Não autenticado." };
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, owner_id, stripe_customer_id, stripe_subscription_id")
    .eq("id", workspaceId)
    .single();

  if (!workspace || workspace.owner_id !== user.id) {
    return { ok: false, error: "Workspace não encontrado ou sem permissão." };
  }

  function isNoSuchCustomerError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return /no such customer/i.test(msg) || /resource_missing/i.test(msg);
  }

  try {
    let customerId = workspace.stripe_customer_id;

    // Evita criar assinatura duplicada: se o cliente já tem assinatura ativa/trial para este workspace, não criar outra.
    if (customerId) {
      try {
        const existingSubs = await stripe.subscriptions.list({
          customer: customerId,
          status: "all",
          limit: 20,
        });
        const activeOrTrialing = existingSubs.data.filter(
          (s) => s.status === "active" || s.status === "trialing"
        );
        const forThisWorkspace = activeOrTrialing.filter(
          (s) => s.metadata?.workspace_id === workspaceId
        );
        if (forThisWorkspace.length > 0) {
        const matchedSubscription = [...forThisWorkspace].sort((a, b) => b.created - a.created)[0];
        const dbClient = supabaseAdmin ?? supabase;

        const { error: workspaceSyncError } = await dbClient
          .from("workspaces")
          .update({
            plan: "pro",
            stripe_subscription_id: matchedSubscription.id,
            plan_updated_at: new Date().toISOString(),
            beta_program_id: null,
          })
          .eq("id", workspaceId);

        if (workspaceSyncError) {
          return {
            ok: false,
            error: "Encontramos uma assinatura ativa na Stripe, mas nao foi possivel sincronizar o workspace agora. Tente novamente em alguns segundos.",
          };
        }

        const { error: profileSyncError } = await dbClient
          .from("profiles")
          .update({ user_type: "full", updated_at: new Date().toISOString() })
          .eq("id", user.id)
          .eq("user_type", "visitor");

        if (profileSyncError) {
          console.warn("[Billing] Failed to sync profile user_type after active Stripe lookup:", profileSyncError.message);
        }

        if (supabaseAdmin) {
          const hasOwnSubscription = await userHasOwnProSubscription(
            supabaseAdmin,
            user.id,
            user.email
          );
          await syncInviteeMembershipRolesForPlan(
            supabaseAdmin,
            user.id,
            hasOwnSubscription
          );
        }

        const basePath = `${APP_URL.replace(/\/$/, "")}/${locale}/dashboard/settings`;
        revalidatePath("/dashboard");
        revalidatePath("/dashboard/plan");
        revalidatePath("/dashboard/settings");

        return {
          ok: true,
          checkoutUrl: successUrl ?? `${basePath}?checkout=success`,
        };
      }
      } catch (listErr) {
        if (isNoSuchCustomerError(listErr)) {
          const dbClient = supabaseAdmin ?? supabase;
          await dbClient.from("workspaces").update({ stripe_customer_id: null }).eq("id", workspaceId);
          customerId = null;
        } else {
          throw listErr;
        }
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: user.user_metadata?.full_name ?? undefined,
        metadata: { workspace_id: workspaceId },
      });
      customerId = customer.id;
      await supabase
        .from("workspaces")
        .update({ stripe_customer_id: customerId })
        .eq("id", workspaceId);
    }

    // Stripe aceita "pt-BR", "pt", "es", "en" — mas NÃO "pt-PT"
    const STRIPE_LOCALE_MAP: Record<string, string> = {
      "pt-BR": "pt-BR",
      "pt-PT": "pt",
      es: "es",
      en: "en",
    };
    const stripeLocale = (STRIPE_LOCALE_MAP[locale] ?? "auto") as Stripe.Checkout.SessionCreateParams.Locale;
    const basePath = `${APP_URL.replace(/\/$/, "")}/${locale}/dashboard/settings`;
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: SELECTED_PRICE_ID, quantity: 1 }],
      success_url:
        successUrl ??
        `${basePath}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl ?? `${basePath}?checkout=cancelled`,
      metadata: { workspace_id: workspaceId, plan: "pro" },
      payment_method_collection: "always",
      subscription_data: {
        // Avaliação gratuita de 7 dias para o Plano Pro — ativa o trial no início da assinatura.
        // Regra de negócio definida em 22/02/2026.
        trial_period_days: 7,
        metadata: { workspace_id: workspaceId, plan: "pro" },
      },
      locale: stripeLocale,
    };

    const stripeClient = stripe;
    const session = await stripeClient.checkout.sessions.create(sessionParams).catch(async (sessionErr) => {
      if (isNoSuchCustomerError(sessionErr) && customerId && stripeClient) {
        const dbClient = supabaseAdmin ?? supabase;
        await dbClient.from("workspaces").update({ stripe_customer_id: null }).eq("id", workspaceId);
        const newCustomer = await stripeClient.customers.create({
          email: user.email ?? undefined,
          name: user.user_metadata?.full_name ?? undefined,
          metadata: { workspace_id: workspaceId },
        });
        await dbClient.from("workspaces").update({ stripe_customer_id: newCustomer.id }).eq("id", workspaceId);
        return stripeClient.checkout.sessions.create({
          ...sessionParams,
          customer: newCustomer.id,
        });
      }
      throw sessionErr;
    });

    if (!session?.url) {
      return { ok: false, error: "Erro ao criar sessão de checkout." };
    }

    revalidatePath("/dashboard/settings");
    return { ok: true, checkoutUrl: session.url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao criar checkout.";
    return { ok: false, error: msg };
  }
}

/** Checkout para usuário sem workspace (ex.: convite beta inválido, recém-cadastrado). */
export async function createCheckoutForNewUserWithoutWorkspace(
  locale = "pt-BR"
): Promise<CreateCheckoutResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };

  const { data: members } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .not("accepted_at", "is", null)
    .limit(1);

  let workspaceId: string | null = members?.[0]?.workspace_id ?? null;

  if (!workspaceId) {
    const created = await ensureDefaultWorkspace(locale);
    if (!created) return { ok: false, error: "Erro ao criar workspace." };
    const { data: afterMembers } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .not("accepted_at", "is", null)
      .limit(1);
    workspaceId = afterMembers?.[0]?.workspace_id ?? null;
  }

  if (!workspaceId) return { ok: false, error: "Workspace não encontrado." };

  const base = APP_URL.replace(/\/$/, "");
  return createCheckoutSession({
    workspaceId,
    successUrl: `${base}/${locale}/onboarding?checkout=success`,
    cancelUrl: `${base}/${locale}/dashboard?checkout=cancelled`,
    locale,
  });
}

export async function createCheckoutForVisitorUpgrade(
  locale = "pt-BR"
): Promise<CreateCheckoutResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };

  const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", user.id).single();
  if ((profile as { user_type?: string } | null)?.user_type !== "visitor") {
    return { ok: false, error: "Apenas visitantes podem usar este fluxo." };
  }

  const wsResult = await createWorkspaceForVisitorUpgrade(locale);
  if (!wsResult.ok) return wsResult;

  const base = APP_URL.replace(/\/$/, "");
  const result = await createCheckoutSession({
    workspaceId: wsResult.workspaceId,
    successUrl: `${base}/${locale}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${base}/${locale}/dashboard?checkout=cancelled`,
    locale,
  });
  if (result.ok) return { ...result, workspaceId: wsResult.workspaceId };
  return result;
}

export async function createBillingPortalSession(
  workspaceId: string,
  returnUrl?: string,
  locale?: string
): Promise<CreateCheckoutResult> {
  if (!stripe) {
    return { ok: false, error: "Stripe não configurado." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Não autenticado." };
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, owner_id, stripe_customer_id")
    .eq("id", workspaceId)
    .single();

  if (!workspace || workspace.owner_id !== user.id) {
    return { ok: false, error: "Workspace não encontrado ou sem permissão." };
  }

  if (!workspace.stripe_customer_id) {
    return { ok: false, error: "Nenhuma assinatura ativa para este workspace." };
  }

  const fallbackUrl =
    returnUrl ??
    `${APP_URL.replace(/\/$/, "")}/${locale ?? "pt-BR"}/dashboard/settings`;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: workspace.stripe_customer_id,
      return_url: fallbackUrl,
    });

    if (!session.url) {
      return { ok: false, error: "Erro ao abrir portal de billing." };
    }

    return { ok: true, checkoutUrl: session.url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao abrir portal.";
    return { ok: false, error: msg };
  }
}

export async function saveBillingPortalFeedback(
  workspaceId: string,
  reason?: string | null,
  comment?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Não autenticado." };
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, owner_id")
    .eq("id", workspaceId)
    .single();

  if (!workspace || workspace.owner_id !== user.id) {
    return { ok: false, error: "Workspace não encontrado ou sem permissão." };
  }

  const reasonTrimmed = reason?.trim() || null;
  const commentTrimmed = comment?.trim() || null;
  if (!reasonTrimmed && !commentTrimmed) {
    return { ok: true };
  }

  const { error } = await supabase.from("billing_portal_feedbacks").insert({
    workspace_id: workspaceId,
    user_id: user.id,
    reason: reasonTrimmed,
    comment: commentTrimmed,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
