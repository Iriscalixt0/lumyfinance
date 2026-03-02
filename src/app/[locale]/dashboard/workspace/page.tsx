import { cookies } from "next/headers";
import { getResolvedWorkspaceContext, getUserHasOwnProPlan } from "@/actions/workspaces";
import {
  getWorkspaceInvites,
  getWorkspaceMembersWithProfiles,
} from "@/actions/invites";
import { createClient } from "@/lib/supabase/server";
import {
  WorkspaceManagerClient,
  type WorkspaceListItem,
} from "@/components/workspace/workspace-manager-client";

const WORKSPACE_COOKIE = "workspace_id";

export default async function WorkspacePage() {
  const cookieStore = await cookies();
  const workspaceIdFromCookie = cookieStore.get(WORKSPACE_COOKIE)?.value ?? null;
  await getUserHasOwnProPlan();
  const { workspaces, workspace } = await getResolvedWorkspaceContext(workspaceIdFromCookie);
  const currentWorkspaceId = workspace?.id ?? workspaces[0]?.id ?? null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userFullName = "";
  if (user?.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    userFullName = (profile?.full_name as string) ?? "";
  }

  let workspaceMembershipRows: Array<{
    workspace_id: string;
    role: "owner" | "admin" | "editor" | "viewer";
    invited_by: string | null;
  }> = [];

  if (user?.id && workspaces.length > 0) {
    const workspaceIds = workspaces.map((w) => w.id);
    const { data: membershipRows } = await supabase
      .from("workspace_members")
      .select("workspace_id, role, invited_by")
      .eq("user_id", user.id)
      .not("accepted_at", "is", null)
      .in("workspace_id", workspaceIds);

    workspaceMembershipRows =
      ((membershipRows ?? []) as Array<{
        workspace_id: string;
        role: "owner" | "admin" | "editor" | "viewer";
        invited_by: string | null;
      }>);
  }

  const invitedByIds = Array.from(
    new Set(
      workspaceMembershipRows
        .map((row) => row.invited_by)
        .filter((id): id is string => !!id)
    )
  );
  let invitedByNameById = new Map<string, string>();
  if (invitedByIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", invitedByIds);
    invitedByNameById = new Map(
      (profileRows ?? []).map((row) => [row.id as string, (row.full_name as string) ?? "Usuario"])
    );
  }

  const membershipByWorkspaceId = new Map(
    workspaceMembershipRows.map((row) => [row.workspace_id, row])
  );

  const workspaceListItems: WorkspaceListItem[] = workspaces.map((workspace) => {
    const membership = membershipByWorkspaceId.get(workspace.id);
    const invitedByName =
      membership?.invited_by ? invitedByNameById.get(membership.invited_by) ?? null : null;

    return {
      ...workspace,
      membership_role: membership?.role ?? (workspace.owner_id === user?.id ? "owner" : "viewer"),
      invited_by_name: invitedByName,
    };
  });

  const [workspaceMembers, workspaceInvites, membershipLookup] = await Promise.all([
    getWorkspaceMembersWithProfiles(currentWorkspaceId),
    getWorkspaceInvites(currentWorkspaceId),
    currentWorkspaceId && user?.id
      ? supabase
          .from("workspace_members")
          .select("role")
          .eq("workspace_id", currentWorkspaceId)
          .eq("user_id", user.id)
          .not("accepted_at", "is", null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const currentWorkspace = workspaceListItems.find((workspace) => workspace.id === currentWorkspaceId);
  const membershipRole = (membershipLookup.data as { role?: string } | null)?.role;
  const canManageMembers =
    currentWorkspace?.owner_id === user?.id ||
    membershipRole === "owner" ||
    membershipRole === "admin";

  return (
    <WorkspaceManagerClient
      userId={user?.id ?? null}
      userEmail={user?.email ?? ""}
      userFullName={userFullName}
      workspaces={workspaceListItems}
      currentWorkspaceId={currentWorkspaceId}
      workspaceMembers={workspaceMembers}
      workspaceInvites={workspaceInvites}
      canManageMembers={canManageMembers}
    />
  );
}
