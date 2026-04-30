import { supabase } from "@/lib/supabase";

interface RecurringRow {
  id: string;
  workspace_id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  category_id: string | null;
  frequency: "weekly" | "biweekly" | "monthly" | "yearly";
  start_date: string;
  end_date: string | null;
  next_run_date: string;
  created_by: string;
  active?: boolean | null;
}

function addInterval(date: Date, freq: RecurringRow["frequency"]): Date {
  const d = new Date(date);
  switch (freq) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "biweekly":
      d.setDate(d.getDate() + 14);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
}

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

/**
 * Materialize occurrences of recurring transactions as real `transactions` rows.
 * Idempotent: checks existing transactions by (recurring_id, date) before inserting.
 *
 * Pass `until` to materialize beyond today (e.g. end of a future month the user is viewing).
 * Returns the number of new transactions created.
 */
export async function materializeRecurring(workspaceId: string, userId: string, until?: Date): Promise<number> {
  const today = until ? new Date(until) : new Date();
  today.setHours(23, 59, 59, 999);

  const { data: recurrings, error } = await supabase
    .from("recurring_transactions")
    .select("*")
    .eq("workspace_id", workspaceId);

  if (error || !recurrings || recurrings.length === 0) return 0;

  // Pre-fetch existing materialized dates for these recurrings to dedupe
  const recurringIds = recurrings.map((r) => r.id);
  const { data: existing } = await supabase
    .from("transactions")
    .select("recurring_id, date")
    .eq("workspace_id", workspaceId)
    .in("recurring_id", recurringIds);

  const existingKeys = new Set(
    (existing ?? []).map((e) => `${e.recurring_id}::${e.date}`)
  );

  let created = 0;

  for (const r of recurrings as RecurringRow[]) {
    if (r.active === false) continue;
    const start = new Date(r.start_date);
    const end = r.end_date ? new Date(r.end_date) : null;

    let cursor = new Date(start);
    let lastMaterialized: Date | null = null;

    // Iterate occurrences from start until today (or end_date)
    // Safety cap to avoid runaway loops (e.g., 5 years of weekly = ~260)
    let safety = 600;
    while (cursor.getTime() <= today.getTime() && safety-- > 0) {
      if (end && cursor.getTime() > end.getTime()) break;

      const dateStr = toISODate(cursor);
      const key = `${r.id}::${dateStr}`;
      if (!existingKeys.has(key)) {
        const { error: insErr } = await supabase.from("transactions").insert({
          workspace_id: r.workspace_id,
          created_by: userId,
          description: r.description,
          amount: r.amount,
          type: r.type,
          date: dateStr,
          category_id: r.category_id,
          recurring_id: r.id,
          currency: "BRL",
        });
        if (!insErr) {
          created++;
          existingKeys.add(key);
        } else {
          // If duplicate due to concurrent run, ignore; otherwise log
          console.warn("[materializeRecurring] insert failed", insErr.message);
        }
      }
      lastMaterialized = new Date(cursor);
      cursor = addInterval(cursor, r.frequency);
    }

    // Update next_run_date to the next future occurrence
    if (lastMaterialized) {
      const next = addInterval(lastMaterialized, r.frequency);
      const nextStr = toISODate(next);
      if (nextStr !== r.next_run_date) {
        await supabase
          .from("recurring_transactions")
          .update({ next_run_date: nextStr })
          .eq("id", r.id);
      }
    }
  }

  return created;
}
