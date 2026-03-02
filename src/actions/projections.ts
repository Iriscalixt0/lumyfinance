"use server";

import { createClient } from "@/lib/supabase/server";

export type ProjectionMonth = {
  month: string;
  year: number;
  income: number;
  expense: number;
  balance: number;
  cumulativeBalance: number;
};

export async function getCashFlowProjection(
  workspaceId: string,
  monthsAhead: number = 6
): Promise<ProjectionMonth[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const now = new Date();
  const result: ProjectionMonth[] = [];
  let cumulative = 0;
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  for (let i = 0; i < monthsAhead; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

    const { data: tx } = await supabase
      .from("transactions")
      .select("type, amount")
      .eq("workspace_id", workspaceId)
      .gte("date", start)
      .lte("date", end);

    let income = 0;
    let expense = 0;
    for (const t of tx ?? []) {
      if (t.type === "income") income += t.amount;
      else if (t.type === "expense") expense += t.amount;
    }

    const balance = income - expense;
    cumulative += balance;
    result.push({
      month: monthNames[d.getMonth()],
      year,
      income,
      expense,
      balance,
      cumulativeBalance: cumulative,
    });
  }
  return result;
}

export async function getGoalSimulation(
  goalId: string,
  monthlyAmountCents: number
): Promise<{ monthsToGoal: number; targetDate: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { monthsToGoal: 0, targetDate: null };

  const { data: goal } = await supabase
    .from("goals")
    .select("target_amount, deadline")
    .eq("id", goalId)
    .single();
  if (!goal) return { monthsToGoal: 0, targetDate: null };

  const { data: contrib } = await supabase
    .from("goal_contributions")
    .select("amount")
    .eq("goal_id", goalId);

  const accumulated = (contrib ?? []).reduce((a, c) => a + c.amount, 0);
  const remaining = Math.max(0, Number(goal.target_amount) - accumulated);
  if (monthlyAmountCents <= 0 || remaining <= 0) {
    return { monthsToGoal: 0, targetDate: remaining <= 0 ? new Date().toISOString().slice(0, 10) : null };
  }
  const monthsToGoal = Math.ceil(remaining / monthlyAmountCents);
  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + monthsToGoal);
  return { monthsToGoal, targetDate: targetDate.toISOString().slice(0, 10) };
}
