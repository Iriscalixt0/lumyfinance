import { getTranslations, getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { getResolvedWorkspaceContext } from "@/actions/workspaces";
import { getReceivables } from "@/actions/receivables";
import { formatCurrency } from "@/lib/utils/currency";
import { ReceivableForm } from "@/components/forms/receivable-form";
import { CobrancasFilter } from "@/components/cobrancas/cobrancas-filter";
import { CobrancasListWithModal } from "@/components/cobrancas/cobrancas-list-with-modal";
import { CobrancasExportButtons } from "@/components/cobrancas/cobrancas-export-buttons";
import { Receipt, Users, Calendar } from "lucide-react";

const WORKSPACE_COOKIE = "workspace_id";

export default async function CobrancasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; fromDate?: string; toDate?: string; name?: string }>;
}) {
  const t = await getTranslations("cobrancas");
  const tDashboard = await getTranslations("dashboard");
  const locale = await getLocale();
  const params = await searchParams;
  const cookieStore = await cookies();
  const workspaceIdFromCookie = cookieStore.get(WORKSPACE_COOKIE)?.value ?? null;
  const { workspace } = await getResolvedWorkspaceContext(workspaceIdFromCookie);

  if (!workspace) {
    return (
      <div className="py-10 text-muted-foreground">{tDashboard("selectWorkspace")}</div>
    );
  }

  const filter = {
    status: params.status as "pending" | "paid" | "overdue" | undefined,
    fromDate: params.fromDate,
    toDate: params.toDate,
    debtorName: params.name,
  };
  const receivables = await getReceivables(workspace.id, filter);

  const receivablesPendentes = receivables.filter((r) => r.status !== "paid");
  const totalPendente = receivablesPendentes.reduce((acc, r) => acc + r.amount, 0);
  const totalPago = receivables
    .filter((r) => r.status === "paid")
    .reduce((acc, r) => acc + r.amount, 0);

  const exportQuery = new URLSearchParams();
  exportQuery.set("locale", locale);
  if (params.status) exportQuery.set("status", params.status);
  if (params.fromDate) exportQuery.set("fromDate", params.fromDate);
  if (params.toDate) exportQuery.set("toDate", params.toDate);
  if (params.name) exportQuery.set("name", params.name);
  const queryString = exportQuery.toString();

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-2xl font-bold text-foreground">{t("pageTitle")}</h2>
          <p className="text-muted-foreground text-sm sm:text-base mt-0.5">
            {t("pageSubtitle")}
          </p>
        </div>
        <div className="hidden lg:block">
          <CobrancasExportButtons receivables={receivables} queryString={queryString} locale={locale} />
        </div>
      </header>

      <div className="hidden lg:block bg-card border border-border rounded-xl sm:rounded-2xl shadow-card px-3 sm:px-4 py-3 print:hidden">
        <CobrancasFilter />
      </div>

      <section className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
        <div className="bg-card border border-border rounded-xl md:rounded-2xl shadow-card p-4 sm:p-6 min-w-0">
          <div className="flex justify-between items-start mb-2 sm:mb-4">
            <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg sm:rounded-xl text-primary">
              <Receipt className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium">{t("totalToReceive")}</p>
          <h3 className="text-lg sm:text-2xl font-bold text-foreground mt-1 tabular-nums">{formatCurrency(totalPendente, locale)}</h3>
        </div>
        <div className="bg-card border border-border rounded-xl md:rounded-2xl shadow-card p-4 sm:p-6 min-w-0">
          <div className="flex justify-between items-start mb-2 sm:mb-4">
            <div className="p-1.5 sm:p-2 bg-amber-500/10 rounded-lg sm:rounded-xl text-amber-600">
              <Users className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium">{t("debtorsFilter")}</p>
          <h3 className="text-lg sm:text-2xl font-bold text-foreground mt-1">
            {receivablesPendentes.length} {receivablesPendentes.length === 1 ? t("item") : t("items")}
          </h3>
        </div>
        <div className="bg-card border border-border rounded-xl md:rounded-2xl shadow-card p-4 sm:p-6 min-w-0 col-span-2 md:col-span-1">
          <div className="flex justify-between items-start mb-2 sm:mb-4">
            <div className="p-1.5 sm:p-2 bg-green-500/10 rounded-lg sm:rounded-xl text-green-600">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium">{t("alreadyReceived")}</p>
          <h3 className="text-lg sm:text-2xl font-bold text-foreground mt-1 tabular-nums">{formatCurrency(totalPago, locale)}</h3>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="sticky top-10 space-y-4">
            <ReceivableForm workspaceId={workspace.id} />
            <div className="lg:hidden bg-card border border-border rounded-xl sm:rounded-2xl shadow-card px-3 sm:px-4 py-3 print:hidden">
              <CobrancasFilter />
            </div>
            <div className="lg:hidden print:hidden">
              <CobrancasExportButtons receivables={receivables} queryString={queryString} locale={locale} />
            </div>
          </div>
        </div>
        <div className="lg:col-span-2">
          <CobrancasListWithModal receivables={receivables} workspaceId={workspace.id} />
        </div>
      </div>
    </div>
  );
}
