import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, STRIPE_PRICES_PRO, APP_URL } from "@/lib/stripe/config";
import { getCountryFromRequest } from "@/lib/geo/country";
import { getCheckoutCurrencyByCountry, isCheckoutBRL } from "@/lib/product-config";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe não configurado." },
      { status: 500 }
    );
  }

  let body: {
    country?: string;
    workspaceId?: string;
    successUrl?: string;
    cancelUrl?: string;
    locale?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido." },
      { status: 400 }
    );
  }

  const { workspaceId, successUrl, cancelUrl, locale = "pt-BR" } = body;

  const country =
    typeof body.country === "string" && body.country.trim()
      ? body.country.trim()
      : await getCountryFromRequest(request);
  const currency = getCheckoutCurrencyByCountry(country);
  const SELECTED_PRICE_ID = STRIPE_PRICES_PRO[currency] ?? STRIPE_PRICES_PRO.USD;

  if (!SELECTED_PRICE_ID) {
    return NextResponse.json(
      { error: `Preços em ${currency} não configurados. Configure STRIPE_PRICE_PRO_${currency} no .env` },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Não autenticado." },
      { status: 401 }
    );
  }

  let customerId: string | null = null;

  if (workspaceId) {
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id, owner_id, stripe_customer_id")
      .eq("id", workspaceId)
      .single();

    if (!workspace || workspace.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Workspace não encontrado ou sem permissão." },
        { status: 403 }
      );
    }

    customerId = workspace.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: (user.user_metadata?.full_name as string) ?? undefined,
        metadata: { workspace_id: workspaceId },
      });
      customerId = customer.id;
      await supabase
        .from("workspaces")
        .update({ stripe_customer_id: customerId })
        .eq("id", workspaceId);
    }
  }

  const basePath = `${APP_URL.replace(/\/$/, "")}/${locale}/dashboard/settings`;
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: SELECTED_PRICE_ID, quantity: 1 }],
    success_url:
      successUrl ??
      `${basePath}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl ?? `${basePath}?checkout=cancelled`,
    metadata: workspaceId ? { workspace_id: workspaceId, plan: "pro" } : { plan: "pro" },
    payment_method_collection: "always",
    subscription_data: {
      // Avaliação gratuita de 7 dias para o Plano Pro — ativa o trial no início da assinatura.
      // Regra de negócio definida em 22/02/2026.
      trial_period_days: 7,
      metadata: workspaceId ? { workspace_id: workspaceId, plan: "pro" } : { plan: "pro" },
    },
    locale: (isCheckoutBRL(country) ? "pt-BR" : (locale === "pt-PT" ? "pt" : (locale.startsWith("es") ? "es" : "en"))) as Stripe.Checkout.SessionCreateParams.Locale,
  };

  if (customerId) {
    sessionParams.customer = customerId;
  } else {
    sessionParams.customer_email = user.email ?? undefined;
  }

  try {
    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      return NextResponse.json(
        { error: "Erro ao criar sessão de checkout." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao criar checkout.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
