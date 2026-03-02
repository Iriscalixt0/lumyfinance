import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { getResolvedWorkspaceContext } from "@/actions/workspaces";
import { getMonthlyTransactions } from "@/actions/transactions";
import { getCategoriesForWorkspace } from "@/actions/categories";
import { getWorkspaceMembersForPaidBy } from "@/actions/invites";
import { createClient } from "@/lib/supabase/server";
import { getStartOfMonth, getEndOfMonth, getDefaultDateForMonth } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

const MONTH_KEYS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"] as const;
import { TransactionsSection } from "@/components/transactions/transactions-section";

const WORKSPACE_COOKIE = "workspace_id";

async function TransactionsDataContent({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
  const t = await getTranslations("dashboard");
  const cookieStore = await cookies();
  const workspaceIdFromCookie = cookieStore.get(WORKSPACE_COOKIE)?.value ?? null;
  const { workspace } = await getResolvedWorkspaceContext(workspaceIdFromCookie);

  if (!workspace) {
    return (
      <div className="py-10 text-muted-foreground">{t("selectWorkspace")}</div>
    );
  }

  const start = getStartOfMonth(year, month);
  const end = getEndOfMonth(year, month);
  const supabase = await createClient();

  const [transactions, categories, workspaceMembers, investRes, goalsRes] = await Promise.all([
    getMonthlyTransactions(workspace.id, year, month),
    getCategoriesForWorkspace(workspace.id),
    getWorkspaceMembersForPaidBy(workspace.id),
    supabase
      .from("investments")
      .select("amount")
      .eq("workspace_id", workspace.id)
      .gte("date", start)
      .lte("date", end),
    supabase
      .from("goal_contributions")
      .select("amount")
      .eq("workspace_id", workspace.id)
      .gte("date", start)
      .lte("date", end),
  ]);
  const inv = (investRes.data ?? []).reduce((a, b) => a + b.amount, 0);
  const goa = (goalsRes.data ?? []).reduce((a, b) => a + b.amount, 0);
  const incomeCategories = categories.filter((c) => c.type === "income");
  const expenseCategories = categories.filter((c) => c.type === "expense");

  return (
    <TransactionsSection
      initialTransactions={transactions}
      incomeCategories={incomeCategories}
      expenseCategories={expenseCategories}
      workspaceMembers={workspaceMembers}
      workspaceId={workspace.id}
      year={year}
      month={month}
      defaultDate={getDefaultDateForMonth(year, month)}
      invAmount={inv}
      goalsAmount={goa}
      labels={{
        income: t("income"),
        expenses: t("expenses"),
        invested: t("invested"),
        goals: t("goals"),
        freeBalance: t("freeBalance"),
      }}
    />
  );
}

function TransactionsSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="h-10 w-32 rounded-lg bg-secondary" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-secondary" />
        ))}
      </div>
      <div className="space-y-4">
        <div className="h-12 w-full rounded-lg bg-secondary" />
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-4 h-96 rounded-xl bg-secondary" />
          <div className="md:col-span-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-secondary" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const t = await getTranslations("dashboard");
  const tMonths = await getTranslations("common.months");
  const params = await searchParams;
  const year = params.year ? parseInt(params.year, 10) : new Date().getFullYear();
  const month = params.month ? parseInt(params.month, 10) : new Date().getMonth();
  const safeMonth = Number.isNaN(month) || month < 0 || month > 11 ? new Date().getMonth() : month;
  const safeYear = Number.isNaN(year) || year < 2020 || year > 2100 ? new Date().getFullYear() : year;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            {tMonths(MONTH_KEYS[safeMonth])} {safeYear}
          </h2>
          <p className="text-muted-foreground font-medium text-sm sm:text-base">{t("monthTransactions")}</p>
        </div>
      </div>
      <Suspense fallback={<TransactionsSkeleton />}>
        <TransactionsDataContent year={safeYear} month={safeMonth} />
      </Suspense>
    </div>
  );
}
