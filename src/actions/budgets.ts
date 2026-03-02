"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createBudgetSchema = z.object({
  workspace_id: z.string().uuid(),
  category_id: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  limit_amount: z.number().positive(),
});

export type BudgetWithUsage = {
  id: string;
  workspace_id: string;
  category_id: string;
  category_name: string;
  category_icon: string;
  category_color: string;
  year: number;
  month: number;
  limit_amount: number;
  used_amount: number;
};

export async function createBudget(input: z.infer<typeof createBudgetSchema>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Nao autorizado" };

  const parsed = createBudgetSchema.parse(input);
  const limitCents = Math.round(parsed.limit_amount * 100);

  const { data: category } = await supabase
    .from("categories")
    .select("type")
    .eq("id", parsed.category_id)
    .eq("workspace_id", parsed.workspace_id)
    .single();
  if (!category || category.type !== "expense") {
    return { ok: false as const, error: "Apenas categorias de despesa podem ter orçamento." };
  }

  const { error } = await supabase.from("budgets").insert({
    workspace_id: parsed.workspace_id,
    category_id: parsed.category_id,
    year: parsed.year,
    month: parsed.month,
    limit_amount: limitCents,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false as const, error: "Ja existe orcamento para esta categoria neste periodo." };
    }
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/budgets");
  revalidatePath("/dashboard/reports");
  return { ok: true as const };
}

export async function updateBudget(
  id: string,
  workspaceId: string,
  input: { limit_amount: number }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Nao autorizado" };

  const limitCents = Math.round(input.limit_amount * 100);
  const { error } = await supabase
    .from("budgets")
    .update({ limit_amount: limitCents })
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/budgets");
  revalidatePath("/dashboard/reports");
  return { ok: true as const };
}

export async function deleteBudget(id: string, workspaceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Nao autorizado" };

  const { error } = await supabase
    .from("budgets")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/budgets");
  revalidatePath("/dashboard/reports");
  return { ok: true as const };
}

export async function getBudgetsWithUsage(
  workspaceId: string,
  year: number,
  month: number
): Promise<BudgetWithUsage[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const yearStr = String(year);
  const monthStr = String(month).padStart(2, "0");
  const firstDay = `${yearStr}-${monthStr}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const lastDayStr = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  const { data: budgets, error: budgetsError } = await supabase
    .from("budgets")
    .select("id, workspace_id, category_id, year, month, limit_amount")
    .eq("workspace_id", workspaceId)
    .eq("year", year)
    .eq("month", month);

  if (budgetsError || !budgets?.length) return [];

  const categoryIds = budgets.map((b) => b.category_id);
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, icon, color")
    .in("id", categoryIds);
  const categoryMap = new Map(
    (categories ?? []).map((c) => [c.id, { name: c.name, icon: c.icon ?? "box", color: c.color ?? "#6366f1" }])
  );

  const { data: txAgg } = await supabase
    .from("transactions")
    .select("category_id, amount")
    .eq("workspace_id", workspaceId)
    .eq("type", "expense")
    .gte("date", firstDay)
    .lte("date", lastDayStr)
    .in("category_id", categoryIds);

  const usedByCategory = new Map<string, number>();
  for (const tx of txAgg ?? []) {
    if (tx.category_id) {
      usedByCategory.set(tx.category_id, (usedByCategory.get(tx.category_id) ?? 0) + tx.amount);
    }
  }

  return budgets.map((b) => {
    const cat = categoryMap.get(b.category_id);
    return {
      id: b.id,
      workspace_id: b.workspace_id,
      category_id: b.category_id,
      category_name: cat?.name ?? "Categoria",
      category_icon: cat?.icon ?? "box",
      category_color: cat?.color ?? "#6366f1",
      year: b.year,
      month: b.month,
      limit_amount: Number(b.limit_amount),
      used_amount: usedByCategory.get(b.category_id) ?? 0,
    };
  });
}
