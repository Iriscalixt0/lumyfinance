import { cookies } from "next/headers";
import { getResolvedWorkspaceContext } from "@/actions/workspaces";
import { isUserInActiveBeta } from "@/actions/beta";
import { createClient } from "@/lib/supabase/server";
import { SettingsContent } from "@/app/dashboard/settings/settings-content";

const WORKSPACE_COOKIE = "workspace_id";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const workspaceIdFromCookie = cookieStore.get(WORKSPACE_COOKIE)?.value ?? null;
  const [{ workspaces, workspace, participation }, userInActiveBeta] = await Promise.all([
    getResolvedWorkspaceContext(workspaceIdFromCookie),
    isUserInActiveBeta(),
  ]);

  const currentWorkspaceId = workspace?.id ?? null;
  const isCurrentWorkspaceInActiveBeta =
    !!workspace?.beta_program_id &&
    !!participation &&
    !participation.programEnded;
  const isInActiveBeta = userInActiveBeta || isCurrentWorkspaceInActiveBeta;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const ownedWorkspaces = workspaces.filter((w) => w.owner_id === user?.id);
  const billingWorkspace =
    ownedWorkspaces.find((w) => !!w.stripe_subscription_id) ??
    (workspace?.owner_id === user?.id ? workspace : null) ??
    ownedWorkspaces[0] ??
    null;
  const hasStripeSubscription = !!billingWorkspace?.stripe_subscription_id;

  return (
    <SettingsContent
      userEmail={user?.email}
      workspaces={workspaces}
      currentWorkspaceId={billingWorkspace?.id ?? currentWorkspaceId}
      currentWorkspacePlan={billingWorkspace?.plan ?? workspace?.plan ?? "pro"}
      hasStripeSubscription={hasStripeSubscription}
      isInActiveBeta={isInActiveBeta}
    />
  );
}
