"use server";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const goalSchema = z.object({
  workspace_id: z.string().uuid(),
  title: z.string().min(1).max(100),
  target_amount: z.number().positive(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const contributionSchema = z.object({
  workspace_id: z.string().uuid(),
  goal_id: z.string().uuid(),
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).optional(),
});

export async function createGoal(formData: z.infer<typeof goalSchema>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");

  const parsed = goalSchema.parse(formData);
  const targetCents = Math.round(parsed.target_amount * 100);

  const { error } = await supabase.from("goals").insert({
    workspace_id: parsed.workspace_id,
    title: parsed.title,
    target_amount: targetCents,
    deadline: parsed.deadline ?? null,
    created_by: user.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/goals");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/transactions");
}

export async function updateGoal(
  id: string,
  workspaceId: string,
  formData: { title: string; target_amount: number; deadline?: string }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");

  const parsed = goalSchema.pick({ title: true, target_amount: true, deadline: true }).parse({
    ...formData,
    workspace_id: workspaceId,
  });
  const targetCents = Math.round(parsed.target_amount * 100);

  const { error } = await supabase
    .from("goals")
    .update({
      title: parsed.title,
      target_amount: targetCents,
      deadline: parsed.deadline ?? null,
    })
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/goals");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/transactions");
}

export async function deleteGoal(id: string, workspaceId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/goals");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/transactions");
}

export async function createGoalContribution(
  formData: z.infer<typeof contributionSchema>
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");

  const parsed = contributionSchema.parse(formData);
  const amountCents = Math.round(parsed.amount * 100);

  const { error } = await supabase.from("goal_contributions").insert({
    goal_id: parsed.goal_id,
    workspace_id: parsed.workspace_id,
    amount: amountCents,
    date: parsed.date,
    notes: parsed.notes ?? null,
    created_by: user.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/goals");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/transactions");
}

export async function deleteGoalContribution(
  id: string,
  workspaceId: string
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("goal_contributions")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/goals");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/transactions");
}

// Read-only routes remain available even after trial expires.
export const getGoals = cache(async (workspaceId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
});

// Read-only routes remain available even after trial expires.
export async function getGoalContributionsForGoal(goalId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goal_contributions")
    .select("*")
    .eq("goal_id", goalId)
    .order("date", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

// Read-only routes remain available even after trial expires.
export async function getMonthlyGoalContributions(
  workspaceId: string,
  year: number,
  month: number
) {
  const supabase = await createClient();
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("goal_contributions")
    .select("*, goal:goals(id, title)")
    .eq("workspace_id", workspaceId)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}


