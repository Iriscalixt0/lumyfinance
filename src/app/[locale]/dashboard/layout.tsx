import { cookies } from "next/headers";
import {
  getResolvedWorkspaceContext,
  getIsVisitor,
  getUserHasOwnProPlan,
} from "@/actions/workspaces";
import { isUserBetaAdmin, isUserInActiveBeta } from "@/actions/beta";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceProvider } from "@/hooks/use-workspace";
import { DashboardShell } from "@/components/layout/dashboard-shell";

const WORKSPACE_COOKIE = "workspace_id";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const workspaceIdFromCookie = cookieStore.get(WORKSPACE_COOKIE)?.value ?? null;
  const [{ workspaces, workspace, participation }, isBetaAdmin, isVisitor, userInActiveBeta, userHasOwnProPlan] =
    await Promise.all([
      getResolvedWorkspaceContext(workspaceIdFromCookie),
      isUserBetaAdmin(),
      getIsVisitor(),
      isUserInActiveBeta(),
      getUserHasOwnProPlan(),
    ]);

  const needsBetaDecision = !!(participation?.needsDecision && workspace?.id && !isBetaAdmin);
  const isCurrentWorkspaceInActiveBeta =
    !!workspace?.beta_program_id &&
    !!participation &&
    !participation.programEnded;
  const isInActiveBeta = userInActiveBeta || isCurrentWorkspaceInActiveBeta;

  const hasActivePlan =
    isBetaAdmin ||
    isInActiveBeta ||
    userHasOwnProPlan ||
    !!workspace?.stripe_subscription_id;

  const showBetaUpgradeModal = !!(
    workspace?.id &&
    participation?.programEnded &&
    participation?.programStatus === "blocked" &&
    participation.status === "feedback_given" &&
    !isBetaAdmin &&
    !hasActivePlan
  );

  let isViewer = false;
  if (workspace?.id) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.id) {
      const { data: membership } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspace.id)
        .eq("user_id", user.id)
        .not("accepted_at", "is", null)
        .maybeSingle();

      const role = (membership as { role?: string } | null)?.role;
      isViewer = role === "viewer";
    }
  }

  return (
    <WorkspaceProvider workspace={workspace}>
      <DashboardShell
        workspace={workspace}
        workspaces={workspaces}
        isBetaAdmin={isBetaAdmin}
        isVisitor={isVisitor}
        isViewer={isViewer}
        hasActivePlan={hasActivePlan}
        isInActiveBeta={isInActiveBeta}
        needsBetaDecision={needsBetaDecision}
        betaDecisionWorkspaceId={workspace?.id ?? null}
        betaDecisionStatus={participation?.status ?? "feedback_pending"}
        showBetaUpgradeModal={showBetaUpgradeModal}
      >
        {children}
      </DashboardShell>
    </WorkspaceProvider>
  );
}
