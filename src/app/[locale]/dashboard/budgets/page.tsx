import { getTranslations, getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { getResolvedWorkspaceContext } from "@/actions/workspaces";
import { getBudgetsWithUsage } from "@/actions/budgets";
import { getCategoriesForWorkspace } from "@/actions/categories";
import { BudgetForm } from "@/components/forms/budget-form";
import { BudgetsListWithModal } from "@/components/budgets/budgets-list-with-modal";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";

const WORKSPACE_COOKIE = "workspace_id";
const MONTH_KEYS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"] as const;

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const t = await getTranslations("budgets");
  const tDashboard = await getTranslations("dashboard");
  const tMonths = await getTranslations("common.months");
  const locale = await getLocale();
  const params = await searchParams;
  const now = new Date();
  const year = params.year ? parseInt(params.year, 10) : now.getFullYear();
  const month = params.month !== undefined ? parseInt(params.month, 10) : now.getMonth();
  const safeYear = Number.isNaN(year) ? now.getFullYear() : year;
  const safeMonth = Number.isNaN(month) ? now.getMonth() : Math.min(11, Math.max(0, month));

  const cookieStore = await cookies();
  const workspaceIdFromCookie = cookieStore.get(WORKSPACE_COOKIE)?.value ?? null;
  const { workspace } = await getResolvedWorkspaceContext(workspaceIdFromCookie);

  if (!workspace) {
    return (
      <div className="py-10 text-muted-foreground">{tDashboard("selectWorkspace")}</div>
    );
  }

  const [budgetsWithUsage, categories] = await Promise.all([
    getBudgetsWithUsage(workspace.id, safeYear, safeMonth + 1),
    getCategoriesForWorkspace(workspace.id),
  ]);
  const expenseCategories = categories.filter((c) => c.type === "expense");

  const monthLabel = tMonths(MONTH_KEYS[safeMonth]);

  return (
    <div className="space-y-8">
      <RealtimeRefresher
        workspaceId={workspace.id}
        options={{ transactions: true }}
      />
      <header className="mb-6 sm:mb-8">
        <h1 className="text-lg sm:text-3xl font-bold text-foreground tracking-tight">
          {t("pageTitle")}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          {t("pageSubtitle")}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        <section className="lg:col-span-4 space-y-6">
          <div className="bg-card border border-border rounded-xl sm:rounded-2xl shadow-card p-4 sm:p-6">
            <h2 className="text-lg font-bold text-foreground mb-4">{t("addBudget")}</h2>
            <BudgetForm
              workspaceId={workspace.id}
              expenseCategories={expenseCategories}
              year={safeYear}
              month={safeMonth + 1}
              existingBudgetCategoryIds={budgetsWithUsage.map((b) => b.category_id)}
            />
          </div>
        </section>
        <section className="lg:col-span-8">
          <div className="bg-card border border-border rounded-xl sm:rounded-2xl shadow-card">
            <div className="divide-y divide-border">
              <BudgetsListWithModal
                budgets={budgetsWithUsage}
                workspaceId={workspace.id}
                locale={locale}
                monthLabel={monthLabel}
                year={safeYear}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
