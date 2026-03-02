"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createRecurringSchema = z.object({
  workspace_id: z.string().uuid(),
  category_id: z.string().uuid().nullable(),
  type: z.enum(["income", "expense"]),
  amount: z.number().positive(),
  description: z.string().min(1).max(200),
  frequency: z.enum(["weekly", "biweekly", "monthly", "yearly"]),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export type RecurringTransaction = {
  id: string;
  workspace_id: string;
  category_id: string | null;
  type: "income" | "expense";
  amount: number;
  description: string;
  frequency: "weekly" | "biweekly" | "monthly" | "yearly";
  start_date: string;
  end_date: string | null;
  next_run_date: string;
  created_by: string;
  created_at: string;
  category_name?: string;
  category_icon?: string;
};

export async function createRecurring(input: z.infer<typeof createRecurringSchema>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Nao autorizado" };

  const parsed = createRecurringSchema.parse(input);
  const amountCents = Math.round(parsed.amount * 100);
  const { error } = await supabase.from("recurring_transactions").insert({
    workspace_id: parsed.workspace_id,
    category_id: parsed.category_id,
    type: parsed.type,
    amount: amountCents,
    description: parsed.description,
    frequency: parsed.frequency,
    start_date: parsed.start_date,
    end_date: parsed.end_date ?? null,
    next_run_date: parsed.start_date,
    created_by: user.id,
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/recurring");
  return { ok: true as const };
}

export async function updateRecurring(
  id: string,
  workspaceId: string,
  input: Partial<z.infer<typeof createRecurringSchema>>
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Nao autorizado" };

  const updates: Record<string, unknown> = {};
  if (input.amount !== undefined) updates.amount = Math.round(input.amount * 100);
  if (input.description !== undefined) updates.description = input.description;
  if (input.category_id !== undefined) updates.category_id = input.category_id;
  if (input.frequency !== undefined) updates.frequency = input.frequency;
  if (input.start_date !== undefined) updates.start_date = input.start_date;
  if (input.end_date !== undefined) updates.end_date = input.end_date;

  const { error } = await supabase
    .from("recurring_transactions")
    .update(updates)
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/recurring");
  return { ok: true as const };
}

export async function deleteRecurring(id: string, workspaceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Nao autorizado" };

  const { error } = await supabase
    .from("recurring_transactions")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/recurring");
  return { ok: true as const };
}

export async function getRecurringTransactions(workspaceId: string): Promise<RecurringTransaction[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("recurring_transactions")
    .select("id, workspace_id, category_id, type, amount, description, frequency, start_date, end_date, next_run_date, created_by, created_at")
    .eq("workspace_id", workspaceId)
    .order("next_run_date", { ascending: true });

  if (error || !data?.length) return [];

  const categoryIds = Array.from(new Set((data.map((r) => r.category_id).filter(Boolean) as string[])));
  let categoryMap = new Map<string, { name: string; icon: string }>();
  if (categoryIds.length > 0) {
    const { data: cats } = await supabase
      .from("categories")
      .select("id, name, icon")
      .in("id", categoryIds);
    categoryMap = new Map(
      (cats ?? []).map((c) => [c.id, { name: c.name, icon: c.icon ?? "box" }])
    );
  }

  return data.map((r) => ({
    id: r.id,
    workspace_id: r.workspace_id,
    category_id: r.category_id,
    type: r.type as "income" | "expense",
    amount: Number(r.amount),
    description: r.description,
    frequency: r.frequency as "weekly" | "biweekly" | "monthly" | "yearly",
    start_date: r.start_date,
    end_date: r.end_date,
    next_run_date: r.next_run_date,
    created_by: r.created_by,
    created_at: r.created_at,
    category_name: r.category_id ? categoryMap.get(r.category_id)?.name : undefined,
    category_icon: r.category_id ? categoryMap.get(r.category_id)?.icon : undefined,
  }));
}
