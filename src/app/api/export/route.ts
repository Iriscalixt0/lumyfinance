import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

const WORKSPACE_COOKIE = "workspace_id";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieStore = await cookies();
  const workspaceId = cookieStore.get(WORKSPACE_COOKIE)?.value;
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "json";

  const [transactions, investments, goals, goalContributions] = await Promise.all([
    supabase.from("transactions").select("*").eq("workspace_id", workspaceId).order("date"),
    supabase.from("investments").select("*").eq("workspace_id", workspaceId).order("date"),
    supabase.from("goals").select("*").eq("workspace_id", workspaceId),
    supabase
      .from("goal_contributions")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("date"),
  ]);

  const data = {
    exported_at: new Date().toISOString(),
    workspace_id: workspaceId,
    transactions: transactions.data ?? [],
    investments: investments.data ?? [],
    goals: goals.data ?? [],
    goal_contributions: goalContributions.data ?? [],
  };

  if (format === "csv") {
    const rows: string[] = [];
    rows.push("Tipo,Data,Descrição,Categoria,Valor (centavos)");
    (data.transactions as { type: string; date: string; description: string; amount: number }[]).forEach((t) => {
      rows.push(`${t.type},${t.date},${escapeCsv(t.description)},,${t.amount}`);
    });
    (data.investments as { date: string; name: string; amount: number }[]).forEach((i) => {
      rows.push(`investimento,${i.date},${escapeCsv(i.name)},,${i.amount}`);
    });
    const csv = "\uFEFF" + rows.join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="backup_financas_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="backup_financas_${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
