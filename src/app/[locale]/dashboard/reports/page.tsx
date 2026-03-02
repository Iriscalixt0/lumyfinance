import { getTranslations, getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { getResolvedWorkspaceContext } from "@/actions/workspaces";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils/currency";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { CategoryPieChart } from "@/components/charts/category-pie-chart";
import { InvestmentEvolutionChart } from "@/components/charts/investment-evolution-chart";
import { ProjectionsCard } from "@/components/projections/projections-card";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";
import { ReportsYearSelector } from "@/components/reports/reports-year-selector";

const MONTH_KEYS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"] as const;

const WORKSPACE_COOKIE = "workspace_id";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const t = await getTranslations("reports");
  const tDashboard = await getTranslations("dashboard");
  const tMonths = await getTranslations("common.months");
  const locale = await getLocale();
  const cookieStore = await cookies();
  const workspaceIdFromCookie = cookieStore.get(WORKSPACE_COOKIE)?.value ?? null;
  const { workspace } = await getResolvedWorkspaceContext(workspaceIdFromCookie);

  if (!workspace) {
    return (
      <div className="py-10 text-muted-foreground">{tDashboard("selectWorkspace")}</div>
    );
  }

  const params = await searchParams;
  const selectedYear = params.year === "2026" ? 2026 : 2026;

  const supabase = await createClient();

  const yearStart = `${selectedYear}-01-01`;
  const yearEnd = `${selectedYear}-12-31`;

  const [summaryRes, goalsRes, expensesByCatRes] = await Promise.all([
    supabase.rpc("get_dashboard_year_summary", {
      p_workspace_id: workspace.id,
      p_year: selectedYear,
    }),
    supabase.from("goals").select("id, title, target_amount").eq("workspace_id", workspace.id),
    supabase
      .from("transactions")
      .select("category_id, amount, categories(name)")
      .eq("workspace_id", workspace.id)
      .eq("type", "expense")
      .gte("date", yearStart)
      .lte("date", yearEnd),
  ]);

  const categoryExpenseMap = new Map<string, { name: string; value: number }>();
  for (const tx of expensesByCatRes.data ?? []) {
    const cat = tx.categories as { name?: string } | null;
    const name = cat?.name ?? "Sem categoria";
    const key = (tx.category_id as string) ?? "uncategorized";
    const current = categoryExpenseMap.get(key) ?? { name, value: 0 };
    current.value += Number(tx.amount);
    categoryExpenseMap.set(key, current);
  }
  const pieData = Array.from(categoryExpenseMap.values()).filter((d) => d.value > 0);

  const mIncs = new Array(12).fill(0);
  const mExps = new Array(12).fill(0);
  const mInvs = new Array(12).fill(0);
  let tInc = 0,
    tExp = 0,
    tInv = 0,
    tGoa = 0;

  if (!summaryRes.error && Array.isArray(summaryRes.data)) {
    for (const row of summaryRes.data as { month_index: number; income_cents: number; expense_cents: number; investment_cents: number; goal_cents: number }[]) {
      const i = Number(row.month_index) - 1;
      if (i >= 0 && i < 12) {
        mIncs[i] = Number(row.income_cents ?? 0);
        mExps[i] = Number(row.expense_cents ?? 0);
        mInvs[i] = Number(row.investment_cents ?? 0);
        tInc += mIncs[i];
        tExp += mExps[i];
        tInv += mInvs[i];
        tGoa += Number(row.goal_cents ?? 0);
      }
    }
  }

  const goals = goalsRes.data ?? [];
  const goalIds = goals.map((g) => g.id);
  const { data: allContrib } =
    goalIds.length > 0
      ? await supabase
          .from("goal_contributions")
          .select("goal_id, amount")
          .in("goal_id", goalIds)
      : { data: [] };

  const contribByGoal = new Map<string, number>();
  for (const c of allContrib ?? []) {
    contribByGoal.set(c.goal_id, (contribByGoal.get(c.goal_id) ?? 0) + c.amount);
  }

  const goalProgress = goals.map((g) => ({
    id: g.id,
    title: g.title,
    target: g.target_amount,
    accumulated: contribByGoal.get(g.id) ?? 0,
  }));

  const monthLabels = MONTH_KEYS.map((k) => tMonths(k).substring(0, 3));

  const monthsWithData = mIncs.filter((v, i) => v > 0 || mExps[i] > 0).length;
  const showEmptyMonthsHint = monthsWithData > 0 && monthsWithData < 12;

  return (
    <div className="space-y-8">
      <RealtimeRefresher
        workspaceId={workspace.id}
        options={{ transactions: true, goals: true, investments: true }}
      />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">{t("annualReport")}</h2>
          <p className="text-muted-foreground font-medium text-sm sm:text-base">
            {t("year", { year: selectedYear })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("dataSource", { workspace: workspace.name })}
          </p>
        </div>
        <ReportsYearSelector year={selectedYear} selectYearLabel={t("selectYear")} />
      </div>
      {showEmptyMonthsHint && (
        <p className="text-xs text-muted-foreground bg-secondary/50 rounded-xl px-4 py-2">
          {t("emptyMonthsHint")}
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <div className="bg-card border border-border rounded-xl sm:rounded-2xl shadow-card p-4 sm:p-6 border-l-4 sm:border-l-8 border-emerald-500">
          <p className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-widest line-clamp-1">
            {t("annualIncome")}
          </p>
          <p className="text-lg sm:text-2xl font-extrabold text-emerald-600 mt-1 truncate">{formatCurrency(tInc, locale)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl sm:rounded-2xl shadow-card p-4 sm:p-6 border-l-4 sm:border-l-8 border-rose-500">
          <p className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-widest line-clamp-1">
            {t("annualExpenses")}
          </p>
          <p className="text-lg sm:text-2xl font-extrabold text-rose-600 mt-1 truncate">{formatCurrency(tExp, locale)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl sm:rounded-2xl shadow-card p-4 sm:p-6 border-l-4 sm:border-l-8 border-blue-500">
          <p className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-widest line-clamp-1">
            {t("invested")}
          </p>
          <p className="text-lg sm:text-2xl font-extrabold text-blue-600 mt-1 truncate">{formatCurrency(tInv, locale)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl sm:rounded-2xl shadow-card p-4 sm:p-6 border-l-4 sm:border-l-8 border-primary">
          <p className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-widest line-clamp-1">
            {t("goalsSaved")}
          </p>
          <p className="text-lg sm:text-2xl font-extrabold text-primary mt-1 truncate">{formatCurrency(tGoa, locale)}</p>
        </div>
      </div>

      {/* Metas: mobile only, acima de Evolução de investimentos */}
      <div className="block lg:hidden">
        <div className="bg-card border border-border rounded-xl sm:rounded-2xl shadow-card p-4 sm:p-8">
          <h4 className="text-base sm:text-xl font-bold text-foreground mb-4 sm:mb-6">{t("goals")}</h4>
          <div className="space-y-6">
            {goalProgress.map((g) => {
              const p = Math.min((g.accumulated / g.target) * 100, 100);
              return (
                <div key={g.id}>
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <h5 className="text-sm font-bold text-foreground">{g.title}</h5>
                      <p className="text-[10px] text-muted-foreground">
                        {formatCurrency(g.accumulated, locale)} / {formatCurrency(g.target, locale)}
                      </p>
                    </div>
                    <span className="text-xs font-black text-primary">{p.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${p}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {goalProgress.length === 0 && (
            <p className="text-muted-foreground italic">{t("noGoals")}</p>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-card p-4 sm:p-8">
        <h4 className="text-lg sm:text-xl font-bold text-foreground mb-6 sm:mb-8">{t("investmentEvolution")}</h4>
        <div className="h-[250px] lg:h-[320px] w-full min-w-0">
          <InvestmentEvolutionChart
            labels={monthLabels}
            investmentData={mInvs}
            locale={locale}
            investmentLabel={tDashboard("invested")}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl shadow-card p-4 sm:p-8">
          <h4 className="text-lg sm:text-xl font-bold text-foreground mb-6 sm:mb-8">{t("cashFlowMonthly")}</h4>
          <div className="h-[250px] lg:h-[400px] w-full min-w-0">
            <CashFlowChart
              labels={monthLabels}
              incomeData={mIncs}
              expenseData={mExps}
              locale={locale}
              incomeLabel={tDashboard("income")}
              expenseLabel={tDashboard("expenses")}
            />
          </div>
        </div>
        <div className="hidden lg:block bg-card border border-border rounded-2xl shadow-card p-4 sm:p-8">
          <h4 className="text-lg sm:text-xl font-bold text-foreground mb-6 sm:mb-8">{t("goals")}</h4>
          <div className="space-y-6">
            {goalProgress.map((g) => {
              const p = Math.min((g.accumulated / g.target) * 100, 100);
              return (
                <div key={g.id}>
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <h5 className="text-sm font-bold text-foreground">{g.title}</h5>
                      <p className="text-[10px] text-muted-foreground">
                        {formatCurrency(g.accumulated, locale)} / {formatCurrency(g.target, locale)}
                      </p>
                    </div>
                    <span className="text-xs font-black text-primary">{p.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${p}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {goalProgress.length === 0 && (
            <p className="text-muted-foreground italic">{t("noGoals")}</p>
          )}
        </div>
      </div>
      {pieData.length > 0 && (
        <div className="bg-card border border-border rounded-xl sm:rounded-2xl shadow-card p-4 sm:p-8">
          <h4 className="text-base sm:text-xl font-bold text-foreground mb-4 sm:mb-6">
            Gastos por categoria
          </h4>
          <div className="min-h-[260px] sm:min-h-[300px] w-full">
            <CategoryPieChart data={pieData} locale={locale} />
          </div>
        </div>
      )}
      <ProjectionsCard workspaceId={workspace.id} locale={locale} />
    </div>
  );
}
