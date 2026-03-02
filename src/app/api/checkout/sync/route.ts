import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/config";
import {
  syncInviteeMembershipRolesForPlan,
  userHasOwnProSubscription,
} from "@/lib/workspace-membership-access";

const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_URL
  ? createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

type SyncBody = {
  sessionId?: string;
};

export async function POST(request: NextRequest) {
  if (!stripe || !supabaseAdmin) {
    return NextResponse.json({ error: "Checkout sync nao configurado." }, { status: 500 });
  }

  let body: SyncBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo invalido." }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId obrigatorio." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id ?? null;

    if (!subscriptionId) {
      return NextResponse.json({ synced: false, reason: "no_subscription" });
    }

    const status =
      typeof session.subscription === "object" && session.subscription
        ? session.subscription.status
        : null;
    const subscription =
      status
        ? null
        : await stripe.subscriptions.retrieve(subscriptionId);
    const finalStatus = status ?? subscription?.status ?? null;

    if (finalStatus !== "active" && finalStatus !== "trialing") {
      return NextResponse.json({ synced: false, reason: "subscription_not_ready", status: finalStatus });
    }

    let workspaceId = session.metadata?.workspace_id ?? null;
    if (!workspaceId && session.customer) {
      const customerId = typeof session.customer === "string" ? session.customer : null;
      if (customerId) {
        const { data: wsByCustomer } = await supabaseAdmin
          .from("workspaces")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();
        workspaceId = wsByCustomer?.id ?? null;
      }
    }

    if (!workspaceId) {
      return NextResponse.json({ synced: false, reason: "workspace_not_found" });
    }

    const { data: ownedWs } = await supabaseAdmin
      .from("workspaces")
      .select("id, owner_id")
      .eq("id", workspaceId)
      .eq("owner_id", user.id)
      .single();

    if (!ownedWs) {
      return NextResponse.json({ synced: false, reason: "workspace_not_owned" }, { status: 403 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("workspaces")
      .update({
        plan: "pro",
        stripe_subscription_id: subscriptionId,
        plan_updated_at: new Date().toISOString(),
        beta_program_id: null,
      })
      .eq("id", workspaceId);

    if (updateError) {
      return NextResponse.json({ synced: false, reason: "db_update_failed" }, { status: 500 });
    }

    await supabaseAdmin
      .from("profiles")
      .update({ user_type: "full", updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .eq("user_type", "visitor");
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

    return NextResponse.json({ synced: true, workspaceId, subscriptionId, status: finalStatus });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao sincronizar checkout.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
