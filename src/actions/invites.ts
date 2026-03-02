"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { randomBytes } from "crypto";
import { PRODUCT_CONFIG } from "@/lib/product-config";
import {
  syncInviteeMembershipRolesForPlan,
  userHasOwnProSubscription,
} from "@/lib/workspace-membership-access";

const LOCALES = ["pt-BR", "pt-PT", "en", "es"] as const;

const createInviteLinkSchema = z.object({
  workspaceId: z.string().uuid(),
  guestName: z
    .string()
    .trim()
    .min(1, "Informe o nome da pessoa.")
    .max(80, "Nome muito longo."),
  role: z.enum(["admin", "editor", "viewer"]).default("editor"),
  email: z.string().email().optional().nullable().or(z.literal("")),
});

export type CreateInviteLinkResult =
  | { ok: true; inviteUrl: string }
  | { ok: false; error: string };

function sanitizeInviteGuestName(name: string) {
  return name.replace(/\s+/g, " ").trim();
}

function buildInviteLinkMarker(guestName: string) {
  const normalized = sanitizeInviteGuestName(guestName).replace(/[:]+/g, "");
  return `link::${normalized}::${randomBytes(6).toString("hex")}`;
}

function generateInviteToken() {
  return randomBytes(18).toString("base64url");
}

function getInviteExpiryIsoString() {
  // Convites sem expiracao pratica (100 anos).
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 100);
  return expiresAt.toISOString();
}

async function getAppUrl() {
  try {
    const h = await headers();
    const origin = h.get("origin");
    if (origin) return origin.replace(/\/$/, "");

    const proto = h.get("x-forwarded-proto");
    const forwardedHost = h.get("x-forwarded-host");
    if (proto && forwardedHost) return `${proto}://${forwardedHost}`.replace(/\/$/, "");

    const host = h.get("host");
    if (host) {
      const scheme = process.env.NODE_ENV === "production" ? "https" : "http";
      return `${scheme}://${host}`.replace(/\/$/, "");
    }
  } catch {
    // Fora de contexto de request (ex.: testes), usa fallback de env.
  }

  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

async function getLocaleFromRequest(): Promise<(typeof LOCALES)[number]> {
  try {
    const h = await headers();
    const ref = h.get("referer") ?? "";
    const pathname = new URL(ref).pathname;
    const maybeLocale = pathname.split("/").filter(Boolean)[0];
    if (LOCALES.includes(maybeLocale as (typeof LOCALES)[number])) {
      return maybeLocale as (typeof LOCALES)[number];
    }
  } catch {
    // ignore and use fallback
  }
  return "pt-BR";
}

export async function createWorkspaceInviteLink(
  workspaceId: string,
  guestName: string,
  role: "admin" | "editor" | "viewer" = "editor",
  email?: string | null
): Promise<CreateInviteLinkResult> {
  const parsed = createInviteLinkSchema.safeParse({
    workspaceId,
    guestName,
    role,
    email: email ?? null,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Dados invalidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nao autorizado" };

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin =
    serviceKey && process.env.NEXT_PUBLIC_SUPABASE_URL
      ? createSupabaseClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          serviceKey,
          { auth: { persistSession: false } }
        )
      : null;

  if (admin) {
    const hasOwnSubscription = await userHasOwnProSubscription(admin, user.id, user.email);
    if (hasOwnSubscription) {
      await admin
        .from("profiles")
        .update({ user_type: "full", updated_at: new Date().toISOString() })
        .eq("id", user.id)
        .eq("user_type", "visitor");
      try {
        await syncInviteeMembershipRolesForPlan(admin, user.id, true);
      } catch (syncError) {
        console.warn("createWorkspaceInviteLink role sync warning:", syncError);
      }
    }
  }

  const { data: memberRow } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .not("accepted_at", "is", null)
    .single();
  const roleStr = (memberRow as { role?: string } | null)?.role;
  if (!roleStr || !["owner", "admin"].includes(roleStr)) {
    return { ok: false, error: "Apenas donos e admins podem convidar membros." };
  }

  const { count: membersCount } = await supabase
    .from("workspace_members")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .not("accepted_at", "is", null);
  const { count: invitesCount } = await supabase
    .from("workspace_invites")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  const total = (membersCount ?? 0) + (invitesCount ?? 0);
  if (total >= PRODUCT_CONFIG.maxMembersPerWorkspace) {
    return { ok: false, error: `O plano Pro permite até ${PRODUCT_CONFIG.maxMembersPerWorkspace} membros por workspace.` };
  }

  const token = generateInviteToken();

  const inviteEmail =
    parsed.data.email && parsed.data.email.trim().length > 0
      ? parsed.data.email.trim().toLowerCase()
      : buildInviteLinkMarker(parsed.data.guestName);
  const { error: insertError } = await supabase.from("workspace_invites").insert({
    workspace_id: workspaceId,
    email: inviteEmail,
    role: parsed.data.role,
    token,
    invited_by: user.id,
    expires_at: getInviteExpiryIsoString(),
  });

  if (insertError) return { ok: false, error: insertError.message };

  const appUrl = await getAppUrl();
  const locale = await getLocaleFromRequest();
  const inviteUrl = `${appUrl}/${locale}/i/${token}`;

  revalidatePath("/dashboard/settings");
  revalidatePath("/pt/dashboard/settings");
  revalidatePath("/en/dashboard/settings");

  return { ok: true, inviteUrl };
}

export type AcceptInviteResult =
  | { ok: true; workspaceId: string; onboardingRequired: boolean }
  | { ok: false; error: string };

export async function acceptWorkspaceInvite(token: string): Promise<AcceptInviteResult> {
  const supabase = await createClient();
  const normalizedToken = token.trim();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Faca login para aceitar o convite." };

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return { ok: false, error: "Erro de configuracao." };

  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false } }
  );

  // Tenta buscar o convite usando a RPC primeiro
  const { data: inviteRows, error: rpcError } = await supabase.rpc(
    "get_workspace_invite_by_token",
    { invite_token: normalizedToken }
  );

  if (process.env.NODE_ENV !== "production") {
    console.log("Token recebido:", normalizedToken.substring(0, 20) + "...");
    console.log("RPC result:", inviteRows ? "encontrado" : "não encontrado");
    if (rpcError) console.log("RPC error:", rpcError.message);
  }

  let invite: Record<string, unknown> | null =
    Array.isArray(inviteRows) ? ((inviteRows[0] as Record<string, unknown> | undefined) ?? null) : null;

  // Se a RPC não retornou resultado, tenta buscar diretamente com admin client
  if (!invite) {
    // Busca usando o admin client (bypass RLS)
    const { data: rawInvite, error: rawInviteError } = await admin
      .from("workspace_invites")
      .select("id, workspace_id, email, role, invited_by, token")
      .eq("token", normalizedToken)
      .maybeSingle();

    if (rawInviteError) {
      if (process.env.NODE_ENV !== "production") {
        console.error("acceptWorkspaceInvite db error:", rawInviteError);
        if (rpcError) {
          console.warn("acceptWorkspaceInvite rpc error:", rpcError.message);
        }
      }
      return { ok: false, error: "Erro ao buscar convite. Tente novamente." };
    }

    if (!rawInvite) {
      // Tenta buscar todos os convites para debug (apenas em desenvolvimento)
      if (process.env.NODE_ENV !== "production") {
        const { data: allInvites } = await admin
          .from("workspace_invites")
          .select("token")
          .limit(5);
        console.warn("Token não encontrado:", normalizedToken.substring(0, 20) + "...");
        console.warn("Tokens no banco (primeiros 5):", allInvites?.map(i => i.token?.substring(0, 20) + "..."));
        if (rpcError) {
          console.warn("acceptWorkspaceInvite rpc error:", rpcError.message);
        }
      }
      return { ok: false, error: "Convite invalido ou expirado." };
    }

    invite = rawInvite as unknown as Record<string, unknown>;
  }

  const inviteEmail = (invite as { email?: string }).email?.toLowerCase();
  const inviteWorkspaceId = (invite as { workspace_id?: string }).workspace_id;
  const inviteRole = (invite as { role?: string }).role ?? "editor";
  const inviteId = (invite as { id?: string }).id;
  const isLinkInvite = inviteEmail?.startsWith("link::") ?? false;

  if (inviteEmail && !inviteEmail.startsWith("link::") && inviteEmail !== user.email.toLowerCase()) {
    return {
      ok: false,
      error: `Este convite foi enviado para ${inviteEmail}. Faca login com essa conta para aceitar.`,
    };
  }

  if (!inviteWorkspaceId) {
    return { ok: false, error: "Convite invalido." };
  }

  const { data: existingMembership, error: membershipLookupError } = await admin
    .from("workspace_members")
    .select("id, accepted_at")
    .eq("workspace_id", inviteWorkspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipLookupError) {
    return { ok: false, error: "Erro ao validar acesso ao workspace." };
  }

  if (!existingMembership?.accepted_at) {
    const { count: membersCount } = await admin
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", inviteWorkspaceId)
      .not("accepted_at", "is", null);
    if ((membersCount ?? 0) >= PRODUCT_CONFIG.maxMembersPerWorkspace) {
      return { ok: false, error: `Este workspace atingiu o limite de ${PRODUCT_CONFIG.maxMembersPerWorkspace} membros do plano Pro.` };
    }
  }

  // Se o convidado não tem assinatura própria (não é dono de workspace com stripe), força viewer
  const hasOwnSubscription = await userHasOwnProSubscription(admin, user.id, user.email);
  const effectiveRole = hasOwnSubscription ? inviteRole : "viewer";
  const syncUserAccessState = async () => {
    await admin
      .from("profiles")
      .update({
        user_type: hasOwnSubscription ? "full" : "visitor",
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    try {
      await syncInviteeMembershipRolesForPlan(admin, user.id, hasOwnSubscription);
    } catch (syncError) {
      console.warn("acceptWorkspaceInvite role sync warning:", syncError);
    }
  };

  if (existingMembership?.id) {
    if (!existingMembership.accepted_at) {
      const { error: activateMembershipError } = await admin
        .from("workspace_members")
        .update({
          role: effectiveRole,
          granted_role: inviteRole,
          invited_by: (invite as { invited_by?: string }).invited_by ?? null,
          accepted_at: new Date().toISOString(),
        })
        .eq("id", existingMembership.id);

      if (activateMembershipError) {
        return { ok: false, error: activateMembershipError.message };
      }
    }

    if (!isLinkInvite && inviteId) {
      await admin.from("workspace_invites").delete().eq("id", inviteId);
    }

    // Sync user type and effective role on re-accept.
    await syncUserAccessState();

    revalidatePath("/dashboard");
    revalidatePath("/pt/dashboard");
    revalidatePath("/en/dashboard");

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("id", user.id)
      .single();
    return {
      ok: true,
      workspaceId: inviteWorkspaceId,
      onboardingRequired: !profile?.onboarding_completed_at,
    };
  }

  const { error: insertError } = await admin.from("workspace_members").insert({
    workspace_id: inviteWorkspaceId,
    user_id: user.id,
    role: effectiveRole,
    granted_role: inviteRole,
    invited_by: (invite as { invited_by?: string }).invited_by ?? null,
    accepted_at: new Date().toISOString(),
  });
  if (insertError) {
    if (insertError.code === "23505") {
      // Pode acontecer com corrida de requests ou membership pendente já existente.
      const { data: duplicatedMembership } = await admin
        .from("workspace_members")
        .select("id, accepted_at")
        .eq("workspace_id", inviteWorkspaceId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (duplicatedMembership?.id && !duplicatedMembership.accepted_at) {
        await admin
          .from("workspace_members")
          .update({
            role: effectiveRole,
            granted_role: inviteRole,
            invited_by: (invite as { invited_by?: string }).invited_by ?? null,
            accepted_at: new Date().toISOString(),
          })
          .eq("id", duplicatedMembership.id);
      }

      if (!isLinkInvite && inviteId) {
        await admin.from("workspace_invites").delete().eq("id", inviteId);
      }
      await syncUserAccessState();
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed_at")
        .eq("id", user.id)
        .single();
      return {
        ok: true,
        workspaceId: inviteWorkspaceId,
        onboardingRequired: !profile?.onboarding_completed_at,
      };
    }
    return { ok: false, error: insertError.message };
  }

  if (!isLinkInvite && inviteId) {
    await admin.from("workspace_invites").delete().eq("id", inviteId);
  }

  // Sync user type and effective role after accepting invite.
  await syncUserAccessState();

  revalidatePath("/dashboard");
  revalidatePath("/pt/dashboard");
  revalidatePath("/en/dashboard");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", user.id)
    .single();

  return {
    ok: true,
    workspaceId: inviteWorkspaceId,
    onboardingRequired: !profile?.onboarding_completed_at,
  };
}

export async function getWorkspaceInvites(workspaceId: string | null) {
  if (!workspaceId) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("workspace_invites")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function validateInviteeHasPlan(
  email: string
): Promise<{ ok: true; hasPlan: boolean; exists: boolean } | { ok: false; error: string }> {
  const normalized = email?.trim()?.toLowerCase();
  if (!normalized) return { ok: false, error: "Email obrigatorio" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nao autorizado" };

  const { data: rows, error } = await supabase.rpc("check_invitee_plan_by_email", {
    user_email: normalized,
  });

  if (error) return { ok: false, error: error.message };

  const row = Array.isArray(rows) && rows[0] ? (rows[0] as { user_exists?: boolean; has_plan?: boolean }) : null;
  const exists = row?.user_exists ?? false;
  const hasPlan = row?.has_plan ?? false;
  return { ok: true, hasPlan, exists };
}

export async function cancelWorkspaceInvite(inviteId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nao autorizado" };

  const { data: invite } = await supabase
    .from("workspace_invites")
    .select("workspace_id")
    .eq("id", inviteId)
    .single();
  if (!invite) return { ok: false, error: "Convite nao encontrado" };

  const { data: memberRow } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", invite.workspace_id)
    .eq("user_id", user.id)
    .not("accepted_at", "is", null)
    .single();
  const roleStr = (memberRow as { role?: string } | null)?.role;
  if (!roleStr || !["owner", "admin"].includes(roleStr)) {
    return { ok: false, error: "Sem permissao para cancelar convites." };
  }

  const { error } = await supabase.from("workspace_invites").delete().eq("id", inviteId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/settings");
  revalidatePath("/pt/dashboard/settings");
  revalidatePath("/en/dashboard/settings");
  return { ok: true };
}

export type WorkspaceMemberForPaidBy = {
  id: string;
  full_name: string;
};

function normalizeWorkspaceMembersForPaidBy(
  rows: Array<{ id?: string | null; user_id?: string | null; full_name?: string | null }>
): WorkspaceMemberForPaidBy[] {
  const byUserId = new Map<string, string>();

  for (const row of rows) {
    const id = (row.user_id ?? row.id ?? "").trim();
    if (!id) continue;
    const fullName = (row.full_name ?? "").trim();
    byUserId.set(id, fullName.length > 0 ? fullName : "Usuario");
  }

  return Array.from(byUserId.entries())
    .map(([id, full_name]) => ({ id, full_name }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR", { sensitivity: "base" }));
}

export async function getWorkspaceMembersForPaidBy(
  workspaceId: string | null
): Promise<WorkspaceMemberForPaidBy[]> {
  if (!workspaceId) return [];

  const supabase = await createClient();
  const { data: rpcRows, error: rpcError } = await supabase.rpc("get_workspace_members_with_profiles", {
    ws_id: workspaceId,
  });

  if (!rpcError) {
    const rows = (Array.isArray(rpcRows) ? rpcRows : rpcRows ? [rpcRows] : []) as Array<{
      user_id?: string | null;
      full_name?: string | null;
    }>;
    return normalizeWorkspaceMembersForPaidBy(rows);
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin =
    serviceKey && process.env.NEXT_PUBLIC_SUPABASE_URL
      ? createSupabaseClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          serviceKey,
          { auth: { persistSession: false } }
        )
      : null;

  if (admin) {
    const { data: adminMemberRows } = await admin
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .not("accepted_at", "is", null);

    const userIds = (adminMemberRows ?? [])
      .map((m) => m.user_id as string)
      .filter((id): id is string => Boolean(id));

    if (userIds.length === 0) return [];

    const { data: adminProfileRows } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const nameByUserId = new Map(
      (adminProfileRows ?? []).map((p) => [p.id as string, (p.full_name as string) ?? "Usuario"])
    );

    return normalizeWorkspaceMembersForPaidBy(
      userIds.map((id) => ({ id, full_name: nameByUserId.get(id) ?? "Usuario" }))
    );
  }

  const { data: memberRows } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .not("accepted_at", "is", null);

  const userIds = (memberRows ?? [])
    .map((m) => m.user_id as string)
    .filter((id): id is string => Boolean(id));

  if (userIds.length === 0) return [];

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  const nameByUserId = new Map(
    (profileRows ?? []).map((p) => [p.id as string, (p.full_name as string) ?? "Usuario"])
  );

  return normalizeWorkspaceMembersForPaidBy(
    userIds.map((id) => ({ id, full_name: nameByUserId.get(id) ?? "Usuario" }))
  );
}

export type WorkspaceMemberWithProfile = {
  id: string;
  user_id: string;
  role: string;
  full_name: string;
  email?: string;
};

export async function getWorkspaceMembersWithProfiles(
  workspaceId: string | null
): Promise<WorkspaceMemberWithProfile[]> {
  if (!workspaceId) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: rows, error: rpcError } = await supabase.rpc("get_workspace_members_with_profiles", {
    ws_id: workspaceId,
  });
  let members = (Array.isArray(rows) ? rows : rows ? [rows] : []) as {
    id: string;
    user_id: string;
    role: string;
    full_name: string;
  }[];

  if (rpcError || members.length === 0) {
    const { data: memberRows } = await supabase
      .from("workspace_members")
      .select("id, user_id, role")
      .eq("workspace_id", workspaceId)
      .not("accepted_at", "is", null);

    const memberList = (memberRows ?? []) as { id: string; user_id: string; role: string }[];
    const userIds = memberList.map((m) => m.user_id);

    let nameByUserId = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      nameByUserId = new Map(
        (profileRows ?? []).map((p) => [p.id as string, (p.full_name as string) ?? "Usuario"])
      );
    }

    members = memberList.map((m) => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      full_name: nameByUserId.get(m.user_id) ?? "Usuario",
    }));
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const result: WorkspaceMemberWithProfile[] = [];
  for (const m of members) {
    let email: string | undefined;
    if (serviceKey) {
      const admin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey,
        { auth: { persistSession: false } }
      );
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      email = data.user?.email;
    }
    result.push({ ...m, email });
  }
  return result;
}

export async function removeWorkspaceMember(
  workspaceId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nao autorizado" };
  if (user.id === userId) return { ok: false, error: "Voce nao pode remover a si mesmo." };

  const { data: memberRow } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .not("accepted_at", "is", null)
    .single();
  const roleStr = (memberRow as { role?: string } | null)?.role;
  if (!roleStr || !["owner", "admin"].includes(roleStr)) {
    return { ok: false, error: "Sem permissao para remover membros." };
  }

  const { data: target } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .single();
  if (!target) return { ok: false, error: "Membro nao encontrado." };
  if (target.role === "owner") {
    return { ok: false, error: "Nao e possivel remover o dono do workspace." };
  }

  const { data: deletedRows, error: deleteError } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .select("id");
  const deletedByUserClient = (deletedRows?.length ?? 0) > 0;

  if (!deletedByUserClient) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return {
        ok: false,
        error: deleteError?.message ?? "Nao foi possivel remover o membro.",
      };
    }

    const admin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: adminDeletedRows, error: adminDeleteError } = await admin
      .from("workspace_members")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .select("id");

    if ((adminDeletedRows?.length ?? 0) === 0) {
      return {
        ok: false,
        error: adminDeleteError?.message ?? "Membro nao encontrado.",
      };
    }
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/pt/dashboard/settings");
  revalidatePath("/en/dashboard/settings");
  return { ok: true };
}

