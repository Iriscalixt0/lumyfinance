import { isPrivilegedAdminEmail } from "@/lib/admin-access";
import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkspaceMembershipRole = "owner" | "admin" | "editor" | "viewer";

function normalizeMembershipRole(role: string | null | undefined): WorkspaceMembershipRole {
  if (role === "owner" || role === "admin" || role === "editor" || role === "viewer") {
    return role;
  }
  return "viewer";
}

async function userHasActiveBetaAccess(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<boolean> {
  try {
    const now = new Date();

    const { data: participants, error: participantsError } = await supabaseAdmin
      .from("beta_participants")
      .select("beta_program_id, status")
      .eq("user_id", userId)
      .neq("status", "blocked");

    if (participantsError || !participants?.length) return false;

    const programIds = [...new Set(participants.map((p) => p.beta_program_id).filter(Boolean))];
    if (!programIds.length) return false;

    const { data: programs, error: programsError } = await supabaseAdmin
      .from("beta_programs")
      .select("id, status, ends_at")
      .in("id", programIds)
      .eq("status", "active");

    if (programsError || !programs?.length) return false;

    return programs.some((p) => new Date(p.ends_at) > now);
  } catch {
    return false;
  }
}

export async function userHasOwnProSubscription(
  supabaseAdmin: SupabaseClient,
  userId: string,
  userEmail?: string | null
): Promise<boolean> {
  if (isPrivilegedAdminEmail(userEmail)) return true;

  const { data, error } = await supabaseAdmin
    .from("workspaces")
    .select("id")
    .eq("owner_id", userId)
    .not("stripe_subscription_id", "is", null)
    .limit(1);

  if (!error && (data ?? []).length > 0) return true;

  return userHasActiveBetaAccess(supabaseAdmin, userId);
}

export async function syncInviteeMembershipRolesForPlan(
  supabaseAdmin: SupabaseClient,
  userId: string,
  hasOwnProSubscription: boolean
): Promise<void> {
  const { data: memberships, error } = await supabaseAdmin
    .from("workspace_members")
    .select("id, role, granted_role")
    .eq("user_id", userId)
    .not("accepted_at", "is", null);

  if (error || !memberships?.length) return;

  for (const membership of memberships) {
    const currentRole = normalizeMembershipRole(membership.role);
    if (currentRole === "owner") continue;

    const grantedRole = normalizeMembershipRole(membership.granted_role ?? membership.role);
    const targetRole: WorkspaceMembershipRole = hasOwnProSubscription ? grantedRole : "viewer";
    const shouldPersistGrantedRole = membership.granted_role !== grantedRole;

    if (currentRole === targetRole && !shouldPersistGrantedRole) continue;

    await supabaseAdmin
      .from("workspace_members")
      .update({
        role: targetRole,
        granted_role: grantedRole,
      })
      .eq("id", membership.id);
  }
}
