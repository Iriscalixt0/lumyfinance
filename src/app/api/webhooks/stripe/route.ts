import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { stripe, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe/config";
import {
  syncInviteeMembershipRolesForPlan,
  userHasOwnProSubscription,
} from "@/lib/workspace-membership-access";

const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_URL
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

// ─── Discord Notifications ────────────────────────────────────────────────────

type DiscordField = { name: string; value: string; inline?: boolean };

interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;
  fields?: DiscordField[];
  footer?: { text: string };
  timestamp?: string;
}

async function notifyDiscord(embed: DiscordEmbed): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Lumyf Stripe",
        avatar_url: "https://www.lumyf.com/favicon.ico",
        embeds: [{ ...embed, timestamp: embed.timestamp ?? new Date().toISOString() }],
      }),
    });
  } catch (err) {
    console.error("[Discord Webhook]", err);
  }
}

function fmtAmount(amount: number | null | undefined, currency: string | null | undefined): string {
  if (!amount || !currency) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

async function syncInviteeRolesForOwner(ownerId: string | null | undefined): Promise<void> {
  if (!ownerId || !supabaseAdmin) return;
  const hasOwnSubscription = await userHasOwnProSubscription(supabaseAdmin, ownerId);
  await syncInviteeMembershipRolesForPlan(supabaseAdmin, ownerId, hasOwnSubscription);
}

// ─── Webhook Handler ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!stripe || !supabaseAdmin || !STRIPE_WEBHOOK_SECRET) {
    console.error("[Stripe Webhook] Missing config:", {
      stripe: !!stripe,
      supabaseAdmin: !!supabaseAdmin,
      webhookSecret: !!STRIPE_WEBHOOK_SECRET,
    });
    return NextResponse.json(
      { error: "Webhook não configurado" },
      { status: 500 }
    );
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    console.error("[Stripe Webhook] Signature verification failed:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  console.log("[Stripe Webhook] Event received:", event.type, event.id);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        let workspaceId = session.metadata?.workspace_id;
        const subscriptionId = session.subscription as string | null;

        if (!subscriptionId) {
          console.warn("[Stripe Webhook] checkout.session.completed: no subscriptionId, skipping");
          break;
        }

        // Fallback: buscar workspace pelo stripe_customer_id se metadata não tiver workspace_id
        if (!workspaceId && session.customer) {
          const customerId = typeof session.customer === "string" ? session.customer : null;
          if (customerId) {
            const { data: wsLookup } = await supabaseAdmin
              .from("workspaces")
              .select("id")
              .eq("stripe_customer_id", customerId)
              .single();
            workspaceId = wsLookup?.id;
            console.log("[Stripe Webhook] Fallback customer lookup:", { customerId, workspaceId });
          }
        }

        if (!workspaceId) {
          console.warn("[Stripe Webhook] checkout.session.completed: no workspaceId found, skipping");
          break;
        }

        console.log("[Stripe Webhook] checkout.session.completed:", { workspaceId, subscriptionId });

        const { data: ws } = await supabaseAdmin
          .from("workspaces")
          .select("owner_id, beta_program_id")
          .eq("id", workspaceId)
          .single();

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
          console.error("[Stripe Webhook] Failed to update workspace:", updateError);
        }

        if (ws?.owner_id) {
          await supabaseAdmin
            .from("profiles")
            .update({ user_type: "full", updated_at: new Date().toISOString() })
            .eq("id", ws.owner_id)
            .eq("user_type", "visitor");
          await syncInviteeRolesForOwner(ws.owner_id);
        }

        if (ws?.beta_program_id) {
          await supabaseAdmin
            .from("beta_participants")
            .update({
              status: "upgraded",
              upgraded_at: new Date().toISOString(),
              blocked_at: null,
              data_delete_after: null,
            })
            .eq("workspace_id", workspaceId);
        }

        await notifyDiscord({
          title: "🎉 Nova Assinatura Pro!",
          color: 0x2ecc71,
          fields: [
            { name: "Email", value: session.customer_email ?? session.customer_details?.email ?? "—", inline: true },
            { name: "Valor", value: fmtAmount(session.amount_total, session.currency), inline: true },
            { name: "Workspace", value: workspaceId, inline: false },
            { name: "Subscription", value: subscriptionId, inline: false },
          ],
          footer: { text: `checkout.session.completed · ${event.id}` },
        });
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : (invoice.subscription as Stripe.Subscription | null)?.id ?? null;
        if (!subscriptionId) break;

        const { data: ws } = await supabaseAdmin
          .from("workspaces")
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (ws) {
          await supabaseAdmin
            .from("workspaces")
            .update({ plan_updated_at: new Date().toISOString() })
            .eq("id", ws.id);
        }

        // Skip first invoice notification (already covered by checkout.session.completed)
        const billingReason = (invoice as { billing_reason?: string }).billing_reason;
        if (billingReason !== "subscription_create") {
          await notifyDiscord({
            title: "💰 Pagamento Recebido",
            color: 0x27ae60,
            fields: [
              { name: "Cliente", value: typeof invoice.customer === "string" ? invoice.customer : "—", inline: true },
              { name: "Valor", value: fmtAmount(invoice.amount_paid, invoice.currency), inline: true },
              { name: "Fatura nº", value: invoice.number ?? "—", inline: true },
              { name: "Subscription", value: subscriptionId, inline: false },
            ],
            footer: { text: `invoice.payment_succeeded · ${event.id}` },
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : (invoice.subscription as Stripe.Subscription | null)?.id ?? undefined;

        const failureMsg =
          (invoice as { last_payment_error?: { message?: string } }).last_payment_error?.message
          ?? "Motivo desconhecido";

        await notifyDiscord({
          title: "❌ Falha no Pagamento",
          description: `**Motivo:** ${failureMsg}`,
          color: 0xe74c3c,
          fields: [
            { name: "Cliente", value: typeof invoice.customer === "string" ? invoice.customer : "—", inline: true },
            { name: "Valor Devido", value: fmtAmount(invoice.amount_due, invoice.currency), inline: true },
            { name: "Fatura nº", value: invoice.number ?? "—", inline: true },
            ...(subscriptionId ? [{ name: "Subscription", value: subscriptionId, inline: false }] : []),
          ],
          footer: { text: `invoice.payment_failed · ${event.id}` },
        });
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        let workspaceId = sub.metadata?.workspace_id;
        const status = sub.status;

        // Fallback: buscar workspace pelo subscription ID se metadata não tiver workspace_id
        if (!workspaceId) {
          const { data: wsLookup } = await supabaseAdmin
            .from("workspaces")
            .select("id")
            .eq("stripe_subscription_id", sub.id)
            .single();
          workspaceId = wsLookup?.id;
        }

        if (!workspaceId) {
          console.warn("[Stripe Webhook] subscription.updated: no workspaceId found for", sub.id);
          break;
        }

        console.log("[Stripe Webhook] subscription.updated:", { workspaceId, status, subId: sub.id });

        if (status === "active" || status === "trialing") {
          await supabaseAdmin
            .from("workspaces")
            .update({
              plan: "pro",
              stripe_subscription_id: sub.id,
              plan_updated_at: new Date().toISOString(),
              beta_program_id: null,
            })
            .eq("id", workspaceId);
        } else {
          await supabaseAdmin
            .from("workspaces")
            .update({ plan_updated_at: new Date().toISOString() })
            .eq("id", workspaceId);
        }

        const { data: wsOwner } = await supabaseAdmin
          .from("workspaces")
          .select("owner_id")
          .eq("id", workspaceId)
          .single();
        if ((status === "active" || status === "trialing") && wsOwner?.owner_id) {
          await supabaseAdmin
            .from("profiles")
            .update({ user_type: "full", updated_at: new Date().toISOString() })
            .eq("id", wsOwner.owner_id)
            .eq("user_type", "visitor");
        }
        await syncInviteeRolesForOwner(wsOwner?.owner_id);

        const statusLabel: Record<string, string> = {
          active: "✅ Ativa",
          past_due: "⚠️ Pagamento em atraso",
          canceled: "❌ Cancelada",
          trialing: "🆓 Trial",
          unpaid: "🔴 Não paga",
          paused: "⏸️ Pausada",
        };

        await notifyDiscord({
          title: "🔄 Assinatura Atualizada",
          color: 0xe67e22,
          fields: [
            { name: "Status", value: statusLabel[status] ?? status, inline: true },
            { name: "Workspace", value: workspaceId, inline: true },
            { name: "Subscription", value: sub.id, inline: false },
          ],
          footer: { text: `customer.subscription.updated · ${event.id}` },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        let workspaceId = sub.metadata?.workspace_id;

        // Fallback: buscar workspace pelo subscription ID
        if (!workspaceId) {
          const { data: wsLookup } = await supabaseAdmin
            .from("workspaces")
            .select("id")
            .eq("stripe_subscription_id", sub.id)
            .single();
          workspaceId = wsLookup?.id;
        }

        if (!workspaceId) {
          console.warn("[Stripe Webhook] subscription.deleted: no workspaceId found for", sub.id);
          break;
        }

        console.log("[Stripe Webhook] subscription.deleted:", { workspaceId, subId: sub.id });
        const { data: wsOwner } = await supabaseAdmin
          .from("workspaces")
          .select("owner_id")
          .eq("id", workspaceId)
          .single();

        // NÃO setar plan: "free" — constraint do banco só permite 'pro'.
        // Limpar stripe_subscription_id é suficiente: o app checa !!stripe_subscription_id para acesso.
        const { error: deleteError } = await supabaseAdmin
          .from("workspaces")
          .update({
            stripe_subscription_id: null,
            plan_updated_at: new Date().toISOString(),
          })
          .eq("id", workspaceId);

        if (deleteError) {
          console.error("[Stripe Webhook] Failed to clear subscription:", deleteError);
        }
        await syncInviteeRolesForOwner(wsOwner?.owner_id);

        const canceledAt = sub.canceled_at
          ? new Date(sub.canceled_at * 1000).toLocaleString("pt-BR")
          : "—";

        await notifyDiscord({
          title: "😢 Assinatura Cancelada",
          color: 0x95a5a6,
          fields: [
            { name: "Workspace", value: workspaceId, inline: true },
            { name: "Cancelada em", value: canceledAt, inline: true },
            { name: "Subscription", value: sub.id, inline: false },
          ],
          footer: { text: `customer.subscription.deleted · ${event.id}` },
        });
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("[Stripe Webhook]", event.type, err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

