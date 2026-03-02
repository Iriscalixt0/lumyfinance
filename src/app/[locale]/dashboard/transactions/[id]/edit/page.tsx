import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import {
  getWorkspaceById,
  getWorkspacesForUser,
  ensureDefaultWorkspace,
} from "@/actions/workspaces";
import { getTransactionById } from "@/actions/transactions";
import { getCategoriesForWorkspace } from "@/actions/categories";
import { TransactionForm } from "@/components/forms/transaction-form";
import { getTodayISO } from "@/lib/utils/dates";

const WORKSPACE_COOKIE = "workspace_id";

export default async function EditTransactionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const year = query.year ? parseInt(query.year, 10) : new Date().getFullYear();
  const month = query.month ? parseInt(query.month, 10) : new Date().getMonth();

  const cookieStore = await cookies();
  let workspaces = await getWorkspacesForUser();
  if (workspaces.length === 0) {
    await ensureDefaultWorkspace();
    workspaces = await getWorkspacesForUser();
  }
  const workspaceId = cookieStore.get(WORKSPACE_COOKIE)?.value ?? null;
  const firstWorkspaceId = workspaces[0]?.id ?? null;
  const preferredWorkspaceId = workspaceId ?? firstWorkspaceId;
  const workspaceFromPreferred = await getWorkspaceById(preferredWorkspaceId);
  const workspace =
    workspaceFromPreferred ??
    (firstWorkspaceId && firstWorkspaceId !== preferredWorkspaceId
      ? await getWorkspaceById(firstWorkspaceId)
      : null);

  const locale = await getLocale();
  if (!workspace) {
    return redirect({ href: "/dashboard", locale });
  }

  const transaction = await getTransactionById(id, workspace.id);
  if (!transaction) {
    return redirect({ href: `/dashboard/transactions?year=${year}&month=${month}`, locale });
  }

  const categories = await getCategoriesForWorkspace(workspace.id);
  const incomeCategories = categories.filter((c) => c.type === "income");
  const expenseCategories = categories.filter((c) => c.type === "expense");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Editar transação</h2>
        <Link
          href={`/dashboard/transactions?year=${year}&month=${month}`}
          className="text-sm font-bold text-primary hover:underline"
        >
          ← Voltar ao histórico
        </Link>
      </div>
      <TransactionForm
        workspaceId={workspace.id}
        year={year}
        month={month}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        defaultDate={getTodayISO()}
        transaction={{
          id: transaction.id,
          category_id: transaction.category_id,
          type: transaction.type,
          amount: transaction.amount,
          description: transaction.description,
          date: transaction.date,
        }}
      />
    </div>
  );
}
