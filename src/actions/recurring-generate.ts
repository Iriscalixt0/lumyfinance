"use server";

import { createClient } from "@supabase/supabase-js";

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase admin config");
  return createClient(url, key, { auth: { persistSession: false } });
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

export async function generateRecurringTransactions(): Promise<{ generated: number; errors: string[] }> {
  const supabase = createAdminClient();
  const today = toISODate(new Date());

  const { data: recurrings, error: fetchError } = await supabase
    .from("recurring_transactions")
    .select("*")
    .lte("next_run_date", today);

  if (fetchError || !recurrings?.length) {
    return { generated: 0, errors: fetchError ? [fetchError.message] : [] };
  }

  let generated = 0;
  const errors: string[] = [];

  for (const r of recurrings) {
    const nextRun = new Date(r.next_run_date + "T12:00:00");
    const endDate = r.end_date ? new Date(r.end_date + "T12:00:00") : null;
    if (endDate && nextRun > endDate) continue;

    const { error: insertError } = await supabase.from("transactions").insert({
      workspace_id: r.workspace_id,
      category_id: r.category_id,
      type: r.type,
      amount: r.amount,
      description: r.description,
      date: r.next_run_date,
      created_by: r.created_by,
      recurring_id: r.id,
    });

    if (insertError) {
      errors.push(`${r.id}: ${insertError.message}`);
      continue;
    }

    let newNext: Date;
    switch (r.frequency) {
      case "weekly":
        newNext = addDays(nextRun, 7);
        break;
      case "biweekly":
        newNext = addDays(nextRun, 14);
        break;
      case "monthly":
        newNext = addMonths(nextRun, 1);
        break;
      case "yearly":
        newNext = addYears(nextRun, 1);
        break;
      default:
        newNext = addMonths(nextRun, 1);
    }

    if (endDate && newNext > endDate) {
      await supabase.from("recurring_transactions").delete().eq("id", r.id);
    } else {
      await supabase
        .from("recurring_transactions")
        .update({ next_run_date: toISODate(newNext) })
        .eq("id", r.id);
    }
    generated++;
  }

  return { generated, errors };
}
