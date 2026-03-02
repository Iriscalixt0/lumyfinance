"use server";

import { createClient, getCachedUser } from "@/lib/supabase/server";
import { getBudgetsWithUsage } from "./budgets";
import { getGoals } from "./goals";
import { getReceivables } from "./receivables";

export async function checkAndCreateNotifications(workspaceId: string): Promise<void> {
  const user = await getCachedUser();
  if (!user) return;
  const supabase = await createClient();

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { data: existingNotifs } = await supabase
    .from("notifications")
    .select("data")
    .eq("user_id", user.id)
    .gte("created_at", oneDayAgo);

  const recentKeys = new Set(
    (existingNotifs ?? [])
      .map((r: { data?: { event_key?: string } }) => r.data?.event_key)
      .filter(Boolean)
  );

  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [budgetsWithUsage, goals, receivables] = await Promise.all([
    getBudgetsWithUsage(workspaceId, year, month),
    getGoals(workspaceId),
    getReceivables(workspaceId, {}),
  ]);

  const goalIds = goals.map((g) => g.id);
  const contribRes =
    goalIds.length > 0
      ? await supabase.from("goal_contributions").select("goal_id, amount").in("goal_id", goalIds)
      : { data: [] };
  const contribByGoal = new Map<string, number>();
  for (const c of contribRes.data ?? []) {
    contribByGoal.set(c.goal_id, (contribByGoal.get(c.goal_id) ?? 0) + c.amount);
  }

  for (const b of budgetsWithUsage) {
    const pct = b.limit_amount > 0 ? (b.used_amount / b.limit_amount) * 100 : 0;
    const key100 = `budget:${b.category_id}:${year}:${month}:100`;
    const key80 = `budget:${b.category_id}:${year}:${month}:80`;
    if (pct >= 100 && !recentKeys.has(key100)) {
      recentKeys.add(key100);
      await supabase.from("notifications").insert({
        user_id: user.id,
        workspace_id: workspaceId,
        type: "budget_warning",
        title: `Orçamento estourado: ${b.category_name}`,
        body: `Você ultrapassou o limite de ${b.category_name} este mês.`,
        data: { event_key: key100 },
      });
    } else if (pct >= 80 && !recentKeys.has(key80)) {
      recentKeys.add(key80);
      await supabase.from("notifications").insert({
        user_id: user.id,
        workspace_id: workspaceId,
        type: "budget_warning",
        title: `Atenção: ${b.category_name} em ${Math.round(pct)}%`,
        body: `Você já usou ${Math.round(pct)}% do orçamento de ${b.category_name}.`,
        data: { event_key: key80 },
      });
    }
  }

  for (const g of goals) {
    const acc = contribByGoal.get(g.id) ?? 0;
    const pct = g.target_amount > 0 ? (acc / g.target_amount) * 100 : 0;
    const key100 = `goal:${g.id}:100`;
    const key90 = `goal:${g.id}:90`;
    const key75 = `goal:${g.id}:75`;
    if (pct >= 100 && !recentKeys.has(key100)) {
      recentKeys.add(key100);
      await supabase.from("notifications").insert({
        user_id: user.id,
        workspace_id: workspaceId,
        type: "goal_milestone",
        title: `Meta concluída: ${g.title}`,
        body: `Parabéns! Você atingiu 100% da meta ${g.title}.`,
        data: { event_key: key100, link: "/dashboard/goals" },
      });
    } else if (pct >= 90 && !recentKeys.has(key90)) {
      recentKeys.add(key90);
      await supabase.from("notifications").insert({
        user_id: user.id,
        workspace_id: workspaceId,
        type: "goal_milestone",
        title: `Meta quase lá: ${g.title}`,
        body: `Falta pouco! Você está em ${Math.round(pct)}% da meta ${g.title}.`,
        data: { event_key: key90, link: "/dashboard/goals" },
      });
    } else if (pct >= 75 && !recentKeys.has(key75)) {
      recentKeys.add(key75);
      await supabase.from("notifications").insert({
        user_id: user.id,
        workspace_id: workspaceId,
        type: "goal_milestone",
        title: `Meta em progresso: ${g.title}`,
        body: `Você já atingiu ${Math.round(pct)}% da meta ${g.title}!`,
        data: { event_key: key75, link: "/dashboard/goals" },
      });
    }
  }

  const overdue = receivables.filter((r) => r.status === "overdue");
  for (const r of overdue.slice(0, 5)) {
    const key = `receivable:${r.id}:overdue`;
    if (recentKeys.has(key)) continue;
    recentKeys.add(key);
    await supabase.from("notifications").insert({
      user_id: user.id,
      workspace_id: workspaceId,
      type: "receivable_overdue",
      title: `Cobrança vencida: ${r.debtor_name}`,
      body: `Valor de R$ ${(r.amount / 100).toFixed(2)} estava previsto para ${r.due_date ?? "N/A"}.`,
      data: { event_key: key, link: "/dashboard/cobrancas" },
    });
  }
}
