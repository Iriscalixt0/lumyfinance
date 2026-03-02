"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isPrivilegedAdminEmail } from "@/lib/admin-access";

export type BetaCampaignStage = "d0" | "d2" | "d7" | "d9";
export type BetaCampaignChannel = "in_app" | "email" | "whatsapp";

export type BetaCampaignEvent = {
  id: string;
  beta_program_id: string;
  user_id: string;
  channel: BetaCampaignChannel;
  stage: BetaCampaignStage;
  status: "queued" | "sent" | "failed" | "skipped";
  provider_message_id: string | null;
  error: string | null;
  created_at: string;
};

export type BetaContactPreferences = {
  user_id: string;
  whatsapp_e164: string | null;
  marketing_email_opt_in: boolean;
  marketing_whatsapp_opt_in: boolean;
  captured_at: string;
  updated_at: string;
};

type CampaignRow = {
  user_id: string;
  beta_program_id: string;
  blocked_at: string;
  data_delete_after: string | null;
};

const STAGE_DELAY_DAYS: Record<BetaCampaignStage, number> = {
  d0: 0,
  d2: 2,
  d7: 7,
  d9: 9,
};

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const contactPrefsSchema = z.object({
  whatsappE164: z
    .string()
    .trim()
    .regex(/^\+[1-9][0-9]{7,14}$/, "WhatsApp inválido. Use formato internacional, ex.: +5511999999999")
    .optional()
    .or(z.literal("")),
  marketingEmailOptIn: z.boolean(),
  marketingWhatsappOptIn: z.boolean(),
});

async function isCurrentUserBetaAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return isPrivilegedAdminEmail(user?.email);
}

async function sendResendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; providerMessageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return { ok: false, error: "Resend não configurado (RESEND_API_KEY / RESEND_FROM_EMAIL)." };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = typeof body?.message === "string" ? body.message : `HTTP ${res.status}`;
      return { ok: false, error };
    }
    return { ok: true, providerMessageId: typeof body?.id === "string" ? body.id : undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao enviar e-mail." };
  }
}

async function sendWhatsappMessage(phoneE164: string, text: string): Promise<{ ok: boolean; providerMessageId?: string; error?: string }> {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    return { ok: false, error: "WhatsApp Cloud API não configurada (WHATSAPP_API_TOKEN / WHATSAPP_PHONE_NUMBER_ID)." };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phoneE164.replace("+", ""),
        type: "text",
        text: { body: text },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error =
        (body?.error?.message as string | undefined) ??
        (typeof body?.message === "string" ? body.message : `HTTP ${res.status}`);
      return { ok: false, error };
    }
    const id = Array.isArray(body?.messages) ? body.messages[0]?.id : undefined;
    return { ok: true, providerMessageId: typeof id === "string" ? id : undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao enviar WhatsApp." };
  }
}

function buildStageMessage(stage: BetaCampaignStage) {
  if (stage === "d0") {
    return {
      title: "Seu acesso beta foi bloqueado",
      body: "Assine agora para reativar seu workspace e manter todos os seus dados.",
    };
  }
  if (stage === "d2") {
    return {
      title: "Reative seu acesso em poucos cliques",
      body: "Seu workspace beta continua salvo. Assine para recuperar acesso completo.",
    };
  }
  if (stage === "d7") {
    return {
      title: "Faltam poucos dias para expirar seus dados",
      body: "Seu período de recuperação está acabando. Assine para manter seu workspace ativo.",
    };
  }
  return {
    title: "Último aviso: dados do beta próximos da exclusão",
    body: "Este é o último lembrete. Assine hoje para manter seu workspace e seus dados.",
  };
}

async function getEligibleRows(
  admin: ReturnType<typeof createAdminClient>,
  stage: BetaCampaignStage,
  programId?: string
): Promise<CampaignRow[]> {
  if (!admin) return [];
  const delay = STAGE_DELAY_DAYS[stage];
  const cutoff = new Date(Date.now() - delay * 24 * 60 * 60 * 1000).toISOString();

  let query = admin
    .from("beta_participants")
    .select("user_id, beta_program_id, blocked_at, data_delete_after")
    .eq("status", "blocked")
    .not("blocked_at", "is", null)
    .lte("blocked_at", cutoff);

  if (programId) {
    query = query.eq("beta_program_id", programId);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as CampaignRow[];
}

async function isParticipantStillBlocked(
  admin: ReturnType<typeof createAdminClient>,
  row: CampaignRow
): Promise<boolean> {
  if (!admin) return false;
  const { data: ws } = await admin
    .from("workspaces")
    .select("stripe_subscription_id")
    .eq("beta_program_id", row.beta_program_id)
    .eq("owner_id", row.user_id)
    .limit(1)
    .maybeSingle();
  return !ws?.stripe_subscription_id;
}

async function upsertEventStatus(
  admin: ReturnType<typeof createAdminClient>,
  payload: {
    userId: string;
    programId: string;
    stage: BetaCampaignStage;
    channel: BetaCampaignChannel;
    status: "queued" | "sent" | "failed" | "skipped";
    providerMessageId?: string;
    error?: string;
  }
) {
  if (!admin) return;
  await admin
    .from("beta_conversion_campaign_events")
    .upsert(
      {
        user_id: payload.userId,
        beta_program_id: payload.programId,
        stage: payload.stage,
        channel: payload.channel,
        status: payload.status,
        provider_message_id: payload.providerMessageId ?? null,
        error: payload.error ?? null,
      },
      {
        onConflict: "user_id,stage,channel",
      }
    );
}

async function getExistingEvent(
  admin: ReturnType<typeof createAdminClient>,
  payload: {
    userId: string;
    stage: BetaCampaignStage;
    channel: BetaCampaignChannel;
  }
): Promise<BetaCampaignEvent | null> {
  if (!admin) return null;
  const { data } = await admin
    .from("beta_conversion_campaign_events")
    .select("id, beta_program_id, user_id, channel, stage, status, provider_message_id, error, created_at")
    .eq("user_id", payload.userId)
    .eq("stage", payload.stage)
    .eq("channel", payload.channel)
    .maybeSingle();
  return (data as BetaCampaignEvent | null) ?? null;
}

async function processOneChannel(
  admin: ReturnType<typeof createAdminClient>,
  row: CampaignRow,
  stage: BetaCampaignStage,
  channel: BetaCampaignChannel
): Promise<{ sent: number; skipped: number; failed: number }> {
  if (!admin) return { sent: 0, skipped: 0, failed: 0 };
  const existing = await getExistingEvent(admin, {
    userId: row.user_id,
    stage,
    channel,
  });

  if (existing && (existing.status === "sent" || existing.status === "skipped" || existing.status === "queued")) {
    return { sent: 0, skipped: 0, failed: 0 };
  }

  const message = buildStageMessage(stage);
  const appLink = "/dashboard/beta/blocked";
  await upsertEventStatus(admin, {
    userId: row.user_id,
    programId: row.beta_program_id,
    stage,
    channel,
    status: "queued",
  });

  if (channel === "in_app") {
    const { error } = await admin.from("notifications").insert({
      user_id: row.user_id,
      workspace_id: null,
      type: "beta_conversion_offer",
      title: message.title,
      body: `${message.body} Seus dados ficam disponíveis por 10 dias após o bloqueio.`,
      data: { stage, link: appLink, beta_program_id: row.beta_program_id },
    });

    if (error) {
      await upsertEventStatus(admin, {
        userId: row.user_id,
        programId: row.beta_program_id,
        stage,
        channel,
        status: "failed",
        error: error.message,
      });
      return { sent: 0, skipped: 0, failed: 1 };
    }

    await upsertEventStatus(admin, {
      userId: row.user_id,
      programId: row.beta_program_id,
      stage,
      channel,
      status: "sent",
    });
    return { sent: 1, skipped: 0, failed: 0 };
  }

  const { data: prefs } = await admin
    .from("beta_contact_preferences")
    .select("whatsapp_e164, marketing_email_opt_in, marketing_whatsapp_opt_in")
    .eq("user_id", row.user_id)
    .maybeSingle();

  const { data: authUser } = await admin.auth.admin.getUserById(row.user_id);
  const userEmail = authUser.user?.email ?? null;

  if (channel === "email") {
    if (!prefs?.marketing_email_opt_in || !userEmail) {
      await upsertEventStatus(admin, {
        userId: row.user_id,
        programId: row.beta_program_id,
        stage,
        channel,
        status: "skipped",
        error: "Email sem opt-in ou indisponível.",
      });
      return { sent: 0, skipped: 1, failed: 0 };
    }

    const subject = message.title;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
        <h2>${message.title}</h2>
        <p>${message.body}</p>
        <p>Assine para reativar seu acesso: <a href="${(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}${appLink}">Reativar agora</a></p>
      </div>
    `;
    const sent = await sendResendEmail(userEmail, subject, html);
    if (!sent.ok) {
      await upsertEventStatus(admin, {
        userId: row.user_id,
        programId: row.beta_program_id,
        stage,
        channel,
        status: "failed",
        error: sent.error,
      });
      return { sent: 0, skipped: 0, failed: 1 };
    }
    await upsertEventStatus(admin, {
      userId: row.user_id,
      programId: row.beta_program_id,
      stage,
      channel,
      status: "sent",
      providerMessageId: sent.providerMessageId,
    });
    return { sent: 1, skipped: 0, failed: 0 };
  }

  if (!prefs?.marketing_whatsapp_opt_in || !prefs.whatsapp_e164) {
    await upsertEventStatus(admin, {
      userId: row.user_id,
      programId: row.beta_program_id,
      stage,
      channel,
      status: "skipped",
      error: "WhatsApp sem opt-in ou número inválido.",
    });
    return { sent: 0, skipped: 1, failed: 0 };
  }

  const text = `${message.title}\n\n${message.body}\n\nReative seu acesso: ${(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}${appLink}`;
  const sent = await sendWhatsappMessage(prefs.whatsapp_e164, text);
  if (!sent.ok) {
    await upsertEventStatus(admin, {
      userId: row.user_id,
      programId: row.beta_program_id,
      stage,
      channel,
      status: "failed",
      error: sent.error,
    });
    return { sent: 0, skipped: 0, failed: 1 };
  }
  await upsertEventStatus(admin, {
    userId: row.user_id,
    programId: row.beta_program_id,
    stage,
    channel,
    status: "sent",
    providerMessageId: sent.providerMessageId,
  });
  return { sent: 1, skipped: 0, failed: 0 };
}

export async function getBetaContactPreferences(): Promise<BetaContactPreferences | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("beta_contact_preferences")
    .select("user_id, whatsapp_e164, marketing_email_opt_in, marketing_whatsapp_opt_in, captured_at, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  return (data as BetaContactPreferences | null) ?? null;
}

export async function saveBetaContactPreferences(input: z.infer<typeof contactPrefsSchema>) {
  const parsed = contactPrefsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Não autorizado." };

  const payload = {
    user_id: user.id,
    whatsapp_e164: parsed.data.whatsappE164 || null,
    marketing_email_opt_in: parsed.data.marketingEmailOptIn,
    marketing_whatsapp_opt_in: parsed.data.marketingWhatsappOptIn,
    captured_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("beta_contact_preferences")
    .upsert(payload, { onConflict: "user_id" });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

async function processStage(programId: string | undefined, stage: BetaCampaignStage) {
  const admin = createAdminClient();
  if (!admin) return { processed: 0, sent: 0, skipped: 0, failed: 0 };

  const rows = await getEligibleRows(admin, stage, programId);
  let processed = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const { data: { user } } = await admin.auth.admin.getUserById(row.user_id);
    if (isPrivilegedAdminEmail(user?.email)) continue;
    const stillBlocked = await isParticipantStillBlocked(admin, row);
    if (!stillBlocked) continue;

    processed += 1;
    for (const channel of ["in_app", "email", "whatsapp"] as const) {
      const result = await processOneChannel(admin, row, stage, channel);
      sent += result.sent;
      skipped += result.skipped;
      failed += result.failed;
    }
  }

  return { processed, sent, skipped, failed };
}

export async function processBetaConversionCampaigns() {
  const byStage = {
    d0: await processStage(undefined, "d0"),
    d2: await processStage(undefined, "d2"),
    d7: await processStage(undefined, "d7"),
    d9: await processStage(undefined, "d9"),
  };
  return byStage;
}

export async function triggerBetaConversionCampaign(programId: string, stage: BetaCampaignStage) {
  const isAdmin = await isCurrentUserBetaAdmin();
  if (!isAdmin) return { ok: false as const, error: "Não autorizado." };
  const result = await processStage(programId, stage);
  return { ok: true as const, result };
}

export async function cleanupExpiredBlockedBetaData() {
  const admin = createAdminClient();
  if (!admin) return { cleaned: 0, errors: ["Supabase admin não configurado."] };

  const nowIso = new Date().toISOString();
  const { data: rows, error } = await admin
    .from("beta_participants")
    .select("id, user_id, workspace_id, data_delete_after")
    .eq("status", "blocked")
    .not("data_delete_after", "is", null)
    .lte("data_delete_after", nowIso);

  if (error || !rows?.length) {
    return { cleaned: 0, errors: error ? [error.message] : [] };
  }

  let cleaned = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const { data: { user } } = await admin.auth.admin.getUserById(row.user_id);
    if (isPrivilegedAdminEmail(user?.email)) continue;

    const { data: ws } = await admin
      .from("workspaces")
      .select("id, stripe_subscription_id")
      .eq("id", row.workspace_id)
      .maybeSingle();
    if (!ws || ws.stripe_subscription_id) continue;

    const { error: deleteError } = await admin
      .from("workspaces")
      .delete()
      .eq("id", row.workspace_id);

    if (deleteError) {
      errors.push(`workspace ${row.workspace_id}: ${deleteError.message}`);
      continue;
    }
    cleaned += 1;
  }

  return { cleaned, errors };
}
