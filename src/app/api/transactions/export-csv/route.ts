import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getWorkspaceById, getWorkspacesForUser } from "@/actions/workspaces";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDateLocale } from "@/lib/utils/dates";
import { routing } from "@/i18n/routing";

const WORKSPACE_COOKIE = "workspace_id";

function escapeCsv(s: string): string {
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const TYPE_LABELS: Record<string, Record<string, string>> = {
  "pt-BR": { income: "Receita", expense: "Despesa", transfer: "Transferência" },
  en: { income: "Income", expense: "Expense", transfer: "Transfer" },
  es: { income: "Ingreso", expense: "Gasto", transfer: "Transferencia" },
  de: { income: "Einnahme", expense: "Ausgabe", transfer: "Übertrag" },
};

const HEADERS: Record<string, string> = {
  "pt-BR": "Data;Descrição;Categoria;Tipo;Valor",
  en: "Date;Description;Category;Type;Amount",
  es: "Fecha;Descripción;Categoría;Tipo;Monto",
  de: "Datum;Beschreibung;Kategorie;Typ;Betrag",
};

export async function GET(request: Request) {
  try {
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
      return NextResponse.json({ error: "Workspace not found" }, { status: 400 });
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

    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");
    const now = new Date();
    const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
    const month = monthParam !== null ? parseInt(monthParam, 10) : now.getMonth();

    const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("*, category:categories(name)")
      .eq("workspace_id", workspace.id)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const langKey = locale.split("-")[0] as string;
    const typeLabels = TYPE_LABELS[locale] ?? TYPE_LABELS[langKey] ?? TYPE_LABELS["en"];
    const header = HEADERS[locale] ?? HEADERS[langKey] ?? HEADERS["en"];

    const rows = (transactions ?? []).map((tx) => {
      const dateFormatted = formatDateLocale(tx.date, locale);
      const typeLabel = typeLabels?.[tx.type as string] ?? tx.type;
      const categoryName = (tx.category as { name?: string } | null)?.name ?? "";
      const valueFormatted = formatCurrency(tx.amount, locale);
      return [
        escapeCsv(dateFormatted),
        escapeCsv(tx.description ?? ""),
        escapeCsv(categoryName),
        escapeCsv(typeLabel),
        escapeCsv(valueFormatted),
      ].join(";");
    });

    const csv = "\uFEFF" + header + "\n" + rows.join("\n");
    const filename = `transactions_${year}_${String(month + 1).padStart(2, "0")}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
