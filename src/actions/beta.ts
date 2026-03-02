"use server";

import { createClient, getCachedUser } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { randomBytes } from "crypto";
import { z } from "zod";
import { isPrivilegedAdminEmail } from "@/lib/admin-access";

const DEFAULT_CATEGORIES = [
  { name: "Salário", icon: "wallet", type: "income" as const, color: "#10b981" },
  { name: "Freelance", icon: "briefcase", type: "income" as const, color: "#06b6d4" },
  { name: "Presente", icon: "gift", type: "income" as const, color: "#f59e0b" },
  { name: "Outros Recebimentos", icon: "inbox", type: "income" as const, color: "#8b5cf6" },
  { name: "Supermercado", icon: "shopping-cart", type: "expense" as const, color: "#ef4444" },
  { name: "Moradia", icon: "home", type: "expense" as const, color: "#f97316" },
  { name: "Transporte", icon: "car", type: "expense" as const, color: "#eab308" },
  { name: "Saúde", icon: "heart-pulse", type: "expense" as const, color: "#22c55e" },
  { name: "Lazer", icon: "gamepad-2", type: "expense" as const, color: "#3b82f6" },
  { name: "Compras", icon: "shopping-bag", type: "expense" as const, color: "#a855f7" },
  { name: "Outros Gastos", icon: "box", type: "expense" as const, color: "#64748b" },
];

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isBetaAdmin(email: string | undefined): boolean {
  return isPrivilegedAdminEmail(email);
}

async function isUserIdBetaAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any,
  userId: string
): Promise<boolean> {
  try {
    const { data: { user } } = await adminClient.auth.admin.getUserById(userId);
    return isBetaAdmin(user?.email);
  } catch {
    return false;
  }
}

function generateBetaToken() {
  return randomBytes(24).toString("base64url");
}

async function getAppUrl() {
  try {
    const h = await headers();
    const origin = h.get("origin");
    if (origin) return origin.replace(/\/$/, "");
    const proto = h.get("x-forwarded-proto");
    const host = h.get("x-forwarded-host");
    if (proto && host) return `${proto}://${host}`.replace(/\/$/, "");
    const hostHeader = h.get("host");
    if (hostHeader) {
      const scheme = process.env.NODE_ENV === "production" ? "https" : "http";
      return `${scheme}://${hostHeader}`.replace(/\/$/, "");
    }
  } catch {}
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export type AcceptBetaInviteResult =
  | { ok: true; workspaceId: string; onboardingRequired: boolean }
  | { ok: false; error: string };

export async function acceptBetaInvite(token: string): Promise<AcceptBetaInviteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login para participar do teste beta." };

  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "Erro de configuração do servidor." };

  const { data: program, error: progError } = await admin
    .from("beta_programs")
    .select("id, name, status, ends_at, max_participants")
    .eq("token", token.trim())
    .single();

  if (progError || !program) {
    return { ok: false, error: "Link de teste beta inválido ou expirado." };
  }
  if (program.status !== "active") {
    return { ok: false, error: "Este teste beta não está mais ativo." };
  }
  const now = new Date();
  if (new Date(program.ends_at) <= now) {
    return { ok: false, error: "Este teste beta já encerrou." };
  }

  const { count } = await admin
    .from("beta_participants")
    .select("id", { count: "exact", head: true })
    .eq("beta_program_id", program.id);
  if ((count ?? 0) >= program.max_participants) {
    return { ok: false, error: "Este teste beta atingiu o limite de participantes." };
  }

  const { data: existing } = await admin
    .from("beta_participants")
    .select("workspace_id")
    .eq("beta_program_id", program.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await admin
      .from("profiles")
      .update({ user_type: "full", updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .eq("user_type", "visitor");
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("id", user.id)
      .single();
    return {
      ok: true,
      workspaceId: existing.workspace_id,
      onboardingRequired: !profile?.onboarding_completed_at,
    };
  }

  await admin.from("profiles").upsert(
    {
      id: user.id,
      full_name: (user.user_metadata?.full_name as string) ?? "Usuário",
      avatar_url: user.user_metadata?.avatar_url ?? null,
      user_type: "full",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  const slug = `beta-${program.id.toString().slice(0, 8)}-${user.id.replace(/-/g, "").slice(0, 12)}`;
  const { data: ws, error: wsError } = await admin
    .from("workspaces")
    .insert({
      name: "Teste Beta - Minhas Finanças",
      slug,
      plan: "pro",
      owner_id: user.id,
      beta_program_id: program.id,
    })
    .select("id")
    .single();

  if (wsError || !ws?.id) {
    return { ok: false, error: wsError?.message ?? "Erro ao criar workspace de teste." };
  }

  await admin.from("workspace_members").insert({
    workspace_id: ws.id,
    user_id: user.id,
    role: "owner",
    accepted_at: new Date().toISOString(),
  });

  for (const c of DEFAULT_CATEGORIES) {
    await admin.from("categories").insert({
      workspace_id: ws.id,
      name: c.name,
      icon: c.icon,
      type: c.type,
      color: c.color,
      is_system: true,
    });
  }

  await admin.from("beta_participants").insert({
    beta_program_id: program.id,
    user_id: user.id,
    workspace_id: ws.id,
    status: "active",
  });

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", user.id)
    .single();

  revalidatePath("/dashboard");
  revalidatePath("/pt-BR/dashboard");
  revalidatePath("/en/dashboard");

  return {
    ok: true,
    workspaceId: ws.id,
    onboardingRequired: !profile?.onboarding_completed_at,
  };
}

const createBetaProgramSchema = z.object({
  name: z.string().trim().min(2, "Nome curto demais").max(80),
  durationDays: z.number().int().min(1).max(90).default(3),
  maxParticipants: z.number().int().min(1).max(500).default(200),
});

export type CreateBetaProgramResult =
  | { ok: true; programId: string; token: string; inviteUrl: string }
  | { ok: false; error: string };

export async function createBetaProgram(
  input: z.infer<typeof createBetaProgramSchema>
): Promise<CreateBetaProgramResult> {
  const parsed = createBetaProgramSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autorizado." };
  if (!isBetaAdmin(user.email ?? undefined)) {
    return { ok: false, error: "Apenas administradores podem criar programas beta." };
  }

  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "Erro de configuração do servidor." };

  const token = generateBetaToken();
  const startsAt = new Date();
  const endsAt = new Date();
  endsAt.setDate(endsAt.getDate() + parsed.data.durationDays);

  const { data: prog, error } = await admin
    .from("beta_programs")
    .insert({
      name: parsed.data.name,
      token,
      created_by: user.id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      max_participants: parsed.data.maxParticipants,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !prog) {
    return { ok: false, error: error?.message ?? "Erro ao criar programa beta." };
  }

  const baseUrl = await getAppUrl();
  const locale = "pt-BR";
  const inviteUrl = `${baseUrl}/${locale}/beta/${token}`;

  revalidatePath("/admin/beta");
  return {
    ok: true,
    programId: prog.id,
    token,
    inviteUrl,
  };
}

export type BetaParticipant = {
  id: string;
  user_id: string;
  workspace_id: string;
  joined_at: string;
  status: string;
  blocked_at: string | null;
  data_delete_after: string | null;
  feedback_text: string | null;
  feedback_upgraded: boolean | null;
  feedback_at: string | null;
  upgraded_at: string | null;
  profile: { full_name: string; avatar_url: string | null };
};

export type BetaProgramWithParticipants = {
  id: string;
  name: string;
  token: string;
  status: string;
  starts_at: string;
  ends_at: string;
  max_participants: number;
  created_at: string;
  participants: BetaParticipant[];
  participantCount: number;
};

export async function getBetaPrograms(): Promise<BetaProgramWithParticipants[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isBetaAdmin(user.email ?? undefined)) {
    return [];
  }

  const admin = getAdminClient();
  if (!admin) return [];

  const { data: programs, error } = await admin
    .from("beta_programs")
    .select("id, name, token, status, starts_at, ends_at, max_participants, created_at")
    .order("created_at", { ascending: false });

  if (error || !programs) return [];

  const result: BetaProgramWithParticipants[] = [];
  for (const p of programs) {
    const { data: parts } = await admin
      .from("beta_participants")
      .select("id, user_id, workspace_id, joined_at, status, blocked_at, data_delete_after, feedback_text, feedback_upgraded, feedback_at, upgraded_at")
      .eq("beta_program_id", p.id);

    const userIds = [...new Set((parts ?? []).map((r: { user_id: string }) => r.user_id))];
    const { data: profilesData } =
      userIds.length > 0
        ? await admin
            .from("profiles")
            .select("id, full_name, avatar_url")
            .in("id", userIds)
        : { data: [] };
    const profileMap = new Map((profilesData ?? []).map((pr: { id: string; full_name: string; avatar_url: string | null }) => [pr.id, pr]));

    const participants: BetaParticipant[] = (parts ?? []).map((row: Record<string, unknown>) => {
      const pr = profileMap.get(row.user_id as string);
      return {
        id: row.id as string,
        user_id: row.user_id as string,
        workspace_id: row.workspace_id as string,
        joined_at: row.joined_at as string,
        status: row.status as string,
        blocked_at: (row.blocked_at as string | null) ?? null,
        data_delete_after: (row.data_delete_after as string | null) ?? null,
        feedback_text: row.feedback_text as string | null,
        feedback_upgraded: row.feedback_upgraded as boolean | null,
        feedback_at: row.feedback_at as string | null,
        upgraded_at: row.upgraded_at as string | null,
        profile: {
          full_name: pr?.full_name ?? "—",
          avatar_url: pr?.avatar_url ?? null,
        },
      };
    });

    result.push({
      ...p,
      participants,
      participantCount: participants.length,
    });
  }
  return result;
}

export async function endBetaProgram(programId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isBetaAdmin(user.email ?? undefined)) {
    return { ok: false, error: "Não autorizado." };
  }

  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "Erro de configuração." };

  const { error } = await admin
    .from("beta_programs")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", programId);

  if (error) return { ok: false, error: error.message };

  const { data: participants } = await admin
    .from("beta_participants")
    .select("user_id, workspace_id")
    .eq("beta_program_id", programId);

  for (const p of participants ?? []) {
    if (await isUserIdBetaAdmin(admin, p.user_id)) continue;
    const { data: ws } = await admin
      .from("workspaces")
      .select("stripe_subscription_id")
      .eq("id", p.workspace_id)
      .maybeSingle();

    const hasSubscription = !!ws?.stripe_subscription_id;
    await admin
      .from("beta_participants")
      .update({
        status: hasSubscription ? "upgraded" : "feedback_pending",
        blocked_at: null,
        data_delete_after: null,
      })
      .eq("beta_program_id", programId)
      .eq("user_id", p.user_id);

    await admin.from("notifications").insert({
      user_id: p.user_id,
      type: "beta_ended",
      title: "O teste beta terminou",
      body: "Envie seu feedback para continuar. Depois, assine para liberar todas as funcionalidades.",
      data: { program_id: programId, link: "/dashboard/beta/decision" },
    });
  }

  revalidatePath("/admin/beta");
  return { ok: true };
}

export async function finalizeBetaProgram(
  programId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isBetaAdmin(user.email ?? undefined)) {
    return { ok: false, error: "Não autorizado." };
  }

  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "Erro de configuração." };

  const { data: participants } = await admin
    .from("beta_participants")
    .select("user_id, workspace_id, status, feedback_upgraded")
    .eq("beta_program_id", programId);

  const blockedAt = new Date();
  const dataDeleteAfter = new Date(blockedAt.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();

  // Marca como blocked quem não assinou (exceto admin beta — tem acesso vitalício)
  for (const p of participants ?? []) {
    if (await isUserIdBetaAdmin(admin, p.user_id)) continue;
    const { data: ws } = await admin
      .from("workspaces")
      .select("stripe_subscription_id")
      .eq("id", p.workspace_id)
      .maybeSingle();

    const hasSubscription = !!ws?.stripe_subscription_id;
    if (!p.feedback_upgraded && !hasSubscription) {
      await admin
        .from("beta_participants")
        .update({
          status: "blocked",
          blocked_at: blockedAt.toISOString(),
          data_delete_after: dataDeleteAfter,
        })
        .eq("beta_program_id", programId)
        .eq("user_id", p.user_id);
    }
  }

  await admin
    .from("beta_programs")
    .update({ status: "blocked", ended_at: new Date().toISOString() })
    .eq("id", programId);

  revalidatePath("/admin/beta");
  return { ok: true };
}

export async function deleteBetaProgram(
  programId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isBetaAdmin(user.email ?? undefined)) {
    return { ok: false, error: "Não autorizado." };
  }

  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "Erro de configuração." };

  const { data: program, error: fetchError } = await admin
    .from("beta_programs")
    .select("id, status")
    .eq("id", programId)
    .single();

  if (fetchError || !program) {
    return { ok: false, error: "Programa não encontrado." };
  }

  if (program.status !== "blocked") {
    return { ok: false, error: "Só é possível excluir programas finalizados." };
  }

  const { error } = await admin.from("beta_programs").delete().eq("id", programId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/beta");
  return { ok: true };
}

const submitFeedbackSchema = z.object({
  feedbackText: z.string().trim().min(10, "Mínimo 10 caracteres"),
  npsScore: z.number().int().min(0).max(10).optional(),
  upgraded: z.boolean(),
  workspaceId: z.string().uuid(),
});

export async function submitBetaFeedback(
  input: z.infer<typeof submitFeedbackSchema>
): Promise<{ ok: boolean; error?: string }> {
  const parsed = submitFeedbackSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autorizado." };

  // Embed NPS score no início do feedback_text para não precisar de migração no banco
  const npsPrefix =
    parsed.data.npsScore !== undefined
      ? `[NPS: ${parsed.data.npsScore}/10]\n\n`
      : "";
  const fullFeedbackText = npsPrefix + parsed.data.feedbackText;

  const { error } = await supabase
    .from("beta_participants")
    .update({
      feedback_text: fullFeedbackText,
      feedback_upgraded: parsed.data.upgraded,
      feedback_at: new Date().toISOString(),
      status: parsed.data.upgraded ? "upgraded" : "feedback_given",
    })
    .eq("user_id", user.id)
    .eq("workspace_id", parsed.data.workspaceId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/pt-BR/dashboard");
  revalidatePath("/en/dashboard");
  revalidatePath("/dashboard/beta/decision");
  return { ok: true };
}

/**
 * Returns beta participation context for a workspace.
 * Optimization opportunity: This function makes 4 sequential DB round-trips
 * (getUser, beta_participants, workspaces, beta_programs). Consider creating
 * a Supabase RPC `get_beta_participation_context(workspace_id)` that returns
 * the required data in a single round-trip.
 */
export async function getBetaParticipationForWorkspace(
  workspaceId: string | null
): Promise<{ needsDecision: boolean; status: string; programEnded: boolean; programStatus: string; blockedAt: string | null; dataDeleteAfter: string | null } | null> {
  if (!workspaceId) return null;
  const user = await getCachedUser();
  if (!user) return null;
  const supabase = await createClient();

  const { data } = await supabase
    .from("beta_participants")
    .select("status, blocked_at, data_delete_after")
    .eq("user_id", user.id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!data) return null;

  const { data: ws } = await supabase
    .from("workspaces")
    .select("beta_program_id")
    .eq("id", workspaceId)
    .single();

  if (!ws?.beta_program_id) return null;

  const { data: prog } = await supabase
    .from("beta_programs")
    .select("status, ends_at")
    .eq("id", ws.beta_program_id)
    .single();

  if (!prog) return null;

  const programEnded = prog.status !== "active" || new Date(prog.ends_at) <= new Date();
  const needsDecision = programEnded && ["active", "feedback_pending"].includes(data.status);

  return {
    needsDecision,
    status: data.status,
    programEnded,
    programStatus: prog.status as string,
    blockedAt: (data.blocked_at as string | null) ?? null,
    dataDeleteAfter: (data.data_delete_after as string | null) ?? null,
  };
}

/**
 * Returns true if the user is participating in at least one active beta program
 * (program status is "active", not ended, and participant is not blocked).
 * Used e.g. to grant Pro-like limits (e.g. 2 workspaces) during beta.
 */
export async function isUserInActiveBeta(): Promise<boolean> {
  const user = await getCachedUser();
  if (!user) return false;
  const supabase = await createClient();
  const now = new Date();

  const { data: participants } = await supabase
    .from("beta_participants")
    .select("status, beta_program_id")
    .eq("user_id", user.id)
    .neq("status", "blocked");

  if (!participants?.length) return false;

  const programIds = [...new Set(participants.map((p) => p.beta_program_id))];
  const { data: programs } = await supabase
    .from("beta_programs")
    .select("id, status, ends_at")
    .in("id", programIds)
    .eq("status", "active");

  if (!programs?.length) return false;

  const activeProgramIds = new Set(
    programs.filter((p) => new Date(p.ends_at) > now).map((p) => p.id)
  );
  return participants.some((p) => activeProgramIds.has(p.beta_program_id));
}

export async function isUserBetaAdmin(): Promise<boolean> {
  const user = await getCachedUser();
  return isBetaAdmin(user?.email ?? undefined);
}
