import { getTranslations, getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { getResolvedWorkspaceContext } from "@/actions/workspaces";
import { getGoals } from "@/actions/goals";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils/currency";
import { Target } from "lucide-react";
import { CreateGoalButtonWithModal } from "@/components/goals/create-goal-button-with-modal";
import { GoalContributionForm } from "@/components/forms/goal-contribution-form";
import { GoalsListWithModal } from "@/components/goals/goals-list-with-modal";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";

const WORKSPACE_COOKIE = "workspace_id";

export default async function GoalsPage() {
  const t = await getTranslations("goals");
  const tDashboard = await getTranslations("dashboard");
  const locale = await getLocale();
  const cookieStore = await cookies();
  const workspaceIdFromCookie = cookieStore.get(WORKSPACE_COOKIE)?.value ?? null;
  const { workspace } = await getResolvedWorkspaceContext(workspaceIdFromCookie);

  if (!workspace) {
    return (
      <div className="py-10 text-muted-foreground">{tDashboard("selectWorkspace")}</div>
    );
  }

  const [goals, supabase] = await Promise.all([
    getGoals(workspace.id),
    createClient(),
  ]);
  const goalIds = goals.map((g) => g.id);
  const { data: allContrib } =
    goalIds.length > 0
      ? await supabase.from("goal_contributions").select("goal_id, amount").in("goal_id", goalIds)
      : { data: [] };
  const contributionsByGoal: Record<string, number> = {};
  for (const c of allContrib ?? []) {
    contributionsByGoal[c.goal_id] = (contributionsByGoal[c.goal_id] ?? 0) + c.amount;
  }

  const totalTarget = goals.reduce((acc, g) => acc + g.target_amount, 0);
  const totalCurrent = goals.reduce((acc, g) => acc + (contributionsByGoal[g.id] ?? 0), 0);
  const overallProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

  return (
    <div className="space-y-8">
      <RealtimeRefresher
        workspaceId={workspace.id}
        options={{ goals: true }}
      />
      <header className="mb-6 sm:mb-8">
        <h1 className="text-lg sm:text-3xl font-bold text-foreground tracking-tight">
          {t("pageTitle")}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          {t("pageSubtitle")}
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-card border border-border rounded-xl md:rounded-2xl shadow-card p-4 sm:p-6 min-w-0">
          <p className="text-muted-foreground text-xs sm:text-sm font-medium mb-0.5 sm:mb-1">{t("totalAccumulated")}</p>
          <h3 className="text-lg sm:text-2xl font-bold text-primary tabular-nums">
            {formatCurrency(totalCurrent, locale)}
          </h3>
          <div className="mt-2 sm:mt-4 h-1.5 sm:h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${Math.min(overallProgress, 100)}%` }}
            />
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl md:rounded-2xl shadow-card p-4 sm:p-6 min-w-0">
          <p className="text-muted-foreground text-xs sm:text-sm font-medium mb-0.5 sm:mb-1">{t("totalTarget")}</p>
          <h3 className="text-lg sm:text-2xl font-bold text-foreground tabular-nums">
            {formatCurrency(totalTarget, locale)}
          </h3>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 sm:mt-2">{t("targetSum")}</p>
        </div>
        <div className="bg-primary rounded-xl md:rounded-2xl shadow-card p-4 sm:p-6 text-primary-foreground min-w-0 col-span-2 md:col-span-1">
          <p className="text-primary-foreground/80 text-xs sm:text-sm font-medium mb-0.5 sm:mb-1">{t("averageProgress")}</p>
          <h3 className="text-lg sm:text-2xl font-bold">
            {overallProgress.toFixed(1)}% {t("achieved")}
          </h3>
          <p className="text-[10px] sm:text-xs text-primary-foreground/80 mt-1 sm:mt-2">{t("keepFocused")}</p>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        <section className="md:col-span-4 space-y-6">
          <CreateGoalButtonWithModal workspaceId={workspace.id} />
          <GoalContributionForm
            workspaceId={workspace.id}
            goals={goals}
            contributionsByGoal={contributionsByGoal}
            locale={locale}
          />
        </section>
        <section className="md:col-span-8">
          <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h2 className="text-lg font-bold text-foreground">{t("myGoals")}</h2>
              <span className="text-xs font-bold text-muted-foreground">
                {goals.length} {goals.length === 1 ? t("active") : t("actives")}
              </span>
            </div>
            <div className="divide-y divide-border">
              {goals.length === 0 ? (
                <div className="p-16 text-center">
                  <Target size={40} className="mx-auto text-muted-foreground/40 mb-4" />
                  <p className="text-muted-foreground font-medium">{t("noGoals")}</p>
                </div>
              ) : (
                <GoalsListWithModal
                  goals={goals}
                  contributionsByGoal={contributionsByGoal}
                  workspaceId={workspace.id}
                />
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
