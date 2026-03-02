"use server";

import { createClient } from "@supabase/supabase-js";
import { isPrivilegedAdminEmail } from "@/lib/admin-access";
import { cleanupExpiredBlockedBetaData, processBetaConversionCampaigns } from "@/actions/beta-conversion";

function isBetaAdminEmail(email: string | undefined): boolean {
  return isPrivilegedAdminEmail(email);
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase admin config");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function processEndedBetaPrograms(): Promise<{
  processed: number;
  notificationsSent: number;
  blockedParticipants: number;
  campaignsSent: number;
  campaignsFailed: number;
  campaignsSkipped: number;
  cleanedWorkspaces: number;
  errors: string[];
}> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: programs, error: fetchError } = await admin
    .from("beta_programs")
    .select("id")
    .eq("status", "active")
    .lte("ends_at", now);

  if (fetchError || !programs?.length) {
    const campaigns = await processBetaConversionCampaigns();
    const cleanup = await cleanupExpiredBlockedBetaData();
    const campaignsSent = campaigns.d0.sent + campaigns.d2.sent + campaigns.d7.sent + campaigns.d9.sent;
    const campaignsFailed = campaigns.d0.failed + campaigns.d2.failed + campaigns.d7.failed + campaigns.d9.failed;
    const campaignsSkipped = campaigns.d0.skipped + campaigns.d2.skipped + campaigns.d7.skipped + campaigns.d9.skipped;
    return {
      processed: 0,
      notificationsSent: 0,
      blockedParticipants: 0,
      campaignsSent,
      campaignsFailed,
      campaignsSkipped,
      cleanedWorkspaces: cleanup.cleaned,
      errors: fetchError ? [fetchError.message, ...cleanup.errors] : cleanup.errors,
    };
  }

  let notificationsSent = 0;
  const blockedParticipants = 0;
  const errors: string[] = [];

  for (const prog of programs) {
    const { error: updateError } = await admin
      .from("beta_programs")
      .update({ status: "ended", ended_at: now })
      .eq("id", prog.id);

    if (updateError) {
      errors.push(`Program ${prog.id}: ${updateError.message}`);
      continue;
    }

    const { data: participants } = await admin
      .from("beta_participants")
      .select("user_id, workspace_id")
      .eq("beta_program_id", prog.id);

    for (const p of participants ?? []) {
      const { data: { user } } = await admin.auth.admin.getUserById(p.user_id);
      if (user?.email && isBetaAdminEmail(user.email)) continue;
      const { data: ws } = await admin
        .from("workspaces")
        .select("stripe_subscription_id")
        .eq("id", p.workspace_id)
        .maybeSingle();

      const hasSubscription = !!ws?.stripe_subscription_id;
      const { error: decisionError } = await admin
        .from("beta_participants")
        .update({
          status: hasSubscription ? "upgraded" : "feedback_pending",
          blocked_at: null,
          data_delete_after: null,
        })
        .eq("beta_program_id", prog.id)
        .eq("user_id", p.user_id);

      if (decisionError) {
        errors.push(`Decision ${p.user_id}: ${decisionError.message}`);
      }

      const { error: notifError } = await admin.from("notifications").insert({
        user_id: p.user_id,
        workspace_id: null,
        type: "beta_ended",
        title: "O teste beta terminou",
        body: "Envie seu feedback para continuar. Depois, assine para liberar todas as funcionalidades.",
        data: { program_id: prog.id, link: "/dashboard/beta/decision" },
      });
      if (notifError) {
        errors.push(`Notify ${p.user_id}: ${notifError.message}`);
      } else {
        notificationsSent++;
      }
    }
  }

  const campaigns = await processBetaConversionCampaigns();
  const cleanup = await cleanupExpiredBlockedBetaData();
  const campaignsSent = campaigns.d0.sent + campaigns.d2.sent + campaigns.d7.sent + campaigns.d9.sent;
  const campaignsFailed = campaigns.d0.failed + campaigns.d2.failed + campaigns.d7.failed + campaigns.d9.failed;
  const campaignsSkipped = campaigns.d0.skipped + campaigns.d2.skipped + campaigns.d7.skipped + campaigns.d9.skipped;

  return {
    processed: programs.length,
    notificationsSent,
    blockedParticipants,
    campaignsSent,
    campaignsFailed,
    campaignsSkipped,
    cleanedWorkspaces: cleanup.cleaned,
    errors: [...errors, ...cleanup.errors],
  };
}
