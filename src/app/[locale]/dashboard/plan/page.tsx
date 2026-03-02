import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import {
  getIsVisitor,
  getResolvedWorkspaceContext,
  getUserHasOwnProPlan,
} from "@/actions/workspaces";
import { isUserBetaAdmin, isUserInActiveBeta } from "@/actions/beta";
import { PlanCard } from "@/components/plan/plan-card";
import { createClient } from "@/lib/supabase/server";

const WORKSPACE_COOKIE = "workspace_id";

export default async function PlanPage() {
  const t = await getTranslations("nav");
  const locale = await getLocale();
  const cookieStore = await cookies();
  const workspaceIdFromCookie = cookieStore.get(WORKSPACE_COOKIE)?.value ?? null;
  const [{ participation, workspace, workspaces }, isVisitor, isBetaAdmin, userInActiveBeta, userHasOwnProPlan, supabase] = await Promise.all([
    getResolvedWorkspaceContext(workspaceIdFromCookie),
    getIsVisitor(),
    isUserBetaAdmin(),
    isUserInActiveBeta(),
    getUserHasOwnProPlan(),
    createClient(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isCurrentWorkspaceInActiveBeta =
    !!workspace?.beta_program_id &&
    !!participation &&
    !participation.programEnded;
  const isInActiveBeta = userInActiveBeta || isCurrentWorkspaceInActiveBeta;

  if (isInActiveBeta) {
    return redirect({ href: "/dashboard", locale });
  }

  const ownedWorkspaces = (workspaces ?? []).filter((w) => w.owner_id === user?.id);
  const billingWorkspace =
    ownedWorkspaces.find((w) => !!w.stripe_subscription_id) ??
    (workspace?.owner_id === user?.id ? workspace : null) ??
    ownedWorkspaces[0] ??
    null;
  const hasActivePlan = isBetaAdmin || userHasOwnProPlan;
  const ctaVariant: "manage" | "subscribePro" | "checkout" =
    hasActivePlan ? "manage" : isVisitor ? "subscribePro" : "checkout";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">
        {t("plan")}
      </h1>
      <PlanCard
        ctaVariant={ctaVariant}
        workspaceId={billingWorkspace?.id}
        compact
      />
    </div>
  );
}
