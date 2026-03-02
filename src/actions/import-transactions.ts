"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ImportRow = {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  categoryId?: string | null;
};

export async function importTransactions(
  workspaceId: string,
  rows: ImportRow[]
): Promise<{ ok: true; imported: number; skipped: number } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nao autorizado" };

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const dateMatch = row.date.match(/^\d{4}-\d{2}-\d{2}$/);
    if (!dateMatch || !row.description?.trim() || !row.amount || row.amount === 0) {
      skipped++;
      continue;
    }
    const amountCents = Math.round(Math.abs(row.amount) * 100);
    const type = row.type === "income" ? "income" : "expense";
    const { error } = await supabase.from("transactions").insert({
      workspace_id: workspaceId,
      category_id: row.categoryId || null,
      type,
      amount: amountCents,
      description: row.description.trim().slice(0, 200),
      date: row.date,
      created_by: user.id,
    });
    if (error) {
      skipped++;
      continue;
    }
    imported++;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/reports");
  return { ok: true, imported, skipped };
}
