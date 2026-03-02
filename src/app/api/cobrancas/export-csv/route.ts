import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getWorkspaceById, getWorkspacesForUser } from "@/actions/workspaces";
import { getReceivables } from "@/actions/receivables";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDateLocale } from "@/lib/utils/dates";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

const WORKSPACE_COOKIE = "workspace_id";

function escapeCsv(s: string): string {
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const STATUS_LABELS: Record<string, Record<string, string>> = {
  "pt-BR": { pending: "Pendente", overdue: "Atrasado", paid: "Pago" },
  en: { pending: "Pending", overdue: "Overdue", paid: "Paid" },
  es: { pending: "Pendiente", overdue: "Vencido", paid: "Pagado" },
  fr: { pending: "En attente", overdue: "En retard", paid: "Payé" },
  de: { pending: "Ausstehend", overdue: "Überfällig", paid: "Bezahlt" },
  it: { pending: "In attesa", overdue: "Scaduto", paid: "Pagato" },
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieStore = await cookies();
  const workspaceId = cookieStore.get(WORKSPACE_COOKIE)?.value ?? null;
  const workspaces = await getWorkspacesForUser();
  const firstWorkspaceId = workspaces[0]?.id ?? null;
  const preferredWorkspaceId = workspaceId ?? firstWorkspaceId;
  const workspaceFromPreferred = await getWorkspaceById(preferredWorkspaceId);
  const workspace =
    workspaceFromPreferred ??
    (firstWorkspaceId && firstWorkspaceId !== preferredWorkspaceId
      ? await getWorkspaceById(firstWorkspaceId)
      : null);

  if (!workspace) {
    return NextResponse.json({ error: "Workspace não encontrado" }, { status: 400 });
  }

  const { data: member } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .single();
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const localeParam = searchParams.get("locale");
  const locale =
    localeParam && routing.locales.includes(localeParam as (typeof routing.locales)[number])
      ? (localeParam as (typeof routing.locales)[number])
      : "pt-BR";
  const status = searchParams.get("status") as "pending" | "paid" | "overdue" | undefined;
  const fromDate = searchParams.get("fromDate") ?? undefined;
  const toDate = searchParams.get("toDate") ?? undefined;
  const name = searchParams.get("name") ?? undefined;

  const receivables = await getReceivables(workspace.id, {
    status,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    debtorName: name,
  });

  const labels = STATUS_LABELS[locale] ?? STATUS_LABELS["pt-BR"];
  const header = "Quem deve;Valor;Vencimento;Status;Telefone;Observações";
  const rows = receivables.map((r) => {
    const valueFormatted = formatCurrency(r.amount, locale);
    const dueFormatted = formatDateLocale(r.due_date, locale);
    const statusLabel = labels[r.status] ?? r.status;
    return [
      escapeCsv(r.debtor_name),
      escapeCsv(valueFormatted),
      escapeCsv(dueFormatted),
      escapeCsv(statusLabel),
      escapeCsv(r.phone ?? ""),
      escapeCsv(r.notes ?? ""),
    ].join(";");
  });
  const csv = "\uFEFF" + header + "\n" + rows.join("\n");

  const filename = `cobrancas_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
