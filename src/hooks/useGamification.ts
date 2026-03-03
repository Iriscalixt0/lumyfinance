import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export interface Streak {
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  total_days_active: number;
}

/** Extra context fed into achievement checks */
export interface AchievementContext {
  streak: Streak;
  totalTx: number;
  /** Number of consecutive months where every budget stayed under limit */
  budgetUnderStreakMonths: number;
  /** Number of goals at 100 %+ completion */
  goalsCompleted: number;
  /** Total number of goals */
  totalGoals: number;
  /** Total invested (cents) */
  totalInvested: number;
  /** Number of crypto holdings */
  cryptoHoldings: number;
  /** Number of recurring transactions */
  recurringCount: number;
}

export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  icon: string;
  category: "streak" | "transactions" | "budget" | "goals" | "investing" | "misc";
  check: (ctx: AchievementContext) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── Streaks ──
  { key: "first_tx", name: "Primeiro Passo", description: "Lançou sua primeira transação", icon: "🎯", category: "transactions", check: (c) => c.totalTx >= 1 },
  { key: "streak_3", name: "Constância", description: "3 dias consecutivos lançando gastos", icon: "🔥", category: "streak", check: (c) => c.streak.longest_streak >= 3 },
  { key: "streak_7", name: "Semana Perfeita", description: "7 dias consecutivos", icon: "⚡", category: "streak", check: (c) => c.streak.longest_streak >= 7 },
  { key: "streak_14", name: "Disciplinado", description: "14 dias consecutivos", icon: "💪", category: "streak", check: (c) => c.streak.longest_streak >= 14 },
  { key: "streak_30", name: "Mestre do Hábito", description: "30 dias consecutivos", icon: "🏆", category: "streak", check: (c) => c.streak.longest_streak >= 30 },

  // ── Transactions ──
  { key: "tx_10", name: "Organizado", description: "10 transações registradas", icon: "📊", category: "transactions", check: (c) => c.totalTx >= 10 },
  { key: "tx_50", name: "Detalhista", description: "50 transações registradas", icon: "🔍", category: "transactions", check: (c) => c.totalTx >= 50 },
  { key: "tx_100", name: "Profissional", description: "100 transações registradas", icon: "💎", category: "transactions", check: (c) => c.totalTx >= 100 },

  // ── Days active ──
  { key: "days_10", name: "Veterano", description: "10 dias ativos no total", icon: "📅", category: "streak", check: (c) => c.streak.total_days_active >= 10 },
  { key: "days_30", name: "Lenda", description: "30 dias ativos no total", icon: "👑", category: "streak", check: (c) => c.streak.total_days_active >= 30 },

  // ── Budget achievements ──
  { key: "budget_under_1", name: "No Controle", description: "Ficou dentro do orçamento por 1 mês", icon: "✅", category: "budget", check: (c) => c.budgetUnderStreakMonths >= 1 },
  { key: "budget_under_3", name: "Mão de Ferro", description: "3 meses seguidos dentro do orçamento", icon: "🛡️", category: "budget", check: (c) => c.budgetUnderStreakMonths >= 3 },
  { key: "budget_under_6", name: "Economia de Ouro", description: "6 meses seguidos dentro do orçamento", icon: "🥇", category: "budget", check: (c) => c.budgetUnderStreakMonths >= 6 },
  { key: "budget_under_12", name: "Orçamento Imbatível", description: "1 ano inteiro dentro do orçamento", icon: "🏅", category: "budget", check: (c) => c.budgetUnderStreakMonths >= 12 },

  // ── Goal achievements ──
  { key: "goal_created", name: "Sonhador", description: "Criou sua primeira meta", icon: "💭", category: "goals", check: (c) => c.totalGoals >= 1 },
  { key: "goal_100", name: "Objetivo Atingido", description: "Alcançou 100% de uma meta", icon: "🎉", category: "goals", check: (c) => c.goalsCompleted >= 1 },
  { key: "goal_3", name: "Colecionador de Sonhos", description: "Atingiu 3 metas diferentes", icon: "⭐", category: "goals", check: (c) => c.goalsCompleted >= 3 },
  { key: "goal_5", name: "Realizador", description: "Atingiu 5 metas diferentes", icon: "🌟", category: "goals", check: (c) => c.goalsCompleted >= 5 },

  // ── Investing ──
  { key: "first_invest", name: "Investidor Iniciante", description: "Registrou seu primeiro investimento", icon: "📈", category: "investing", check: (c) => c.totalInvested > 0 },
  { key: "crypto_start", name: "Hodler", description: "Adicionou seu primeiro criptoativo", icon: "₿", category: "investing", check: (c) => c.cryptoHoldings >= 1 },

  // ── Misc ──
  { key: "recurring_setup", name: "No Automático", description: "Configurou uma transação recorrente", icon: "🔄", category: "misc", check: (c) => c.recurringCount >= 1 },
];

export function useGamification(workspaceId: string | null) {
  const { user } = useAuth();
  const [streak, setStreak] = useState<Streak>({ current_streak: 0, longest_streak: 0, last_activity_date: null, total_days_active: 0 });
  const [unlockedKeys, setUnlockedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [totalTx, setTotalTx] = useState(0);

  const load = useCallback(async () => {
    if (!user || !workspaceId) { setLoading(false); return; }

    const [streakRes, achRes, txCountRes] = await Promise.all([
      supabase.from("user_streaks").select("*").eq("user_id", user.id).eq("workspace_id", workspaceId).maybeSingle(),
      supabase.from("user_achievements").select("achievement_key").eq("user_id", user.id).eq("workspace_id", workspaceId),
      supabase.from("transactions").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    ]);

    if (streakRes.data) {
      setStreak({
        current_streak: streakRes.data.current_streak,
        longest_streak: streakRes.data.longest_streak,
        last_activity_date: streakRes.data.last_activity_date,
        total_days_active: streakRes.data.total_days_active,
      });
    }

    setUnlockedKeys(new Set((achRes.data ?? []).map((a: { achievement_key: string }) => a.achievement_key)));
    setTotalTx(txCountRes.count ?? 0);
    setLoading(false);
  }, [user, workspaceId]);

  useEffect(() => { load(); }, [load]);

  /** Build full achievement context by querying budget/goal/investment data */
  const buildContext = useCallback(async (currentStreak: Streak, currentTx: number): Promise<AchievementContext> => {
    if (!workspaceId) {
      return {
        streak: currentStreak, totalTx: currentTx,
        budgetUnderStreakMonths: 0, goalsCompleted: 0, totalGoals: 0,
        totalInvested: 0, cryptoHoldings: 0, recurringCount: 0,
      };
    }

    const [budgetsRes, goalsRes, contribRes, investRes, cryptoRes, recurRes] = await Promise.all([
      supabase.from("budgets").select("category, limit_amount, spent_amount, month, year").eq("workspace_id", workspaceId),
      supabase.from("goals").select("id, target_amount, status").eq("workspace_id", workspaceId),
      supabase.from("goal_contributions").select("goal_id, amount").eq("workspace_id", workspaceId),
      supabase.from("investments").select("amount").eq("workspace_id", workspaceId),
      supabase.from("crypto_holdings").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
      supabase.from("recurring_transactions").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    ]);

    // Budget under-limit streak: count consecutive months (backwards) where ALL budgets were under limit
    const budgets = budgetsRes.data ?? [];
    let budgetUnderStreakMonths = 0;
    if (budgets.length > 0) {
      // Group budgets by month/year
      const monthBuckets = new Map<string, { under: boolean }>();
      for (const b of budgets) {
        const key = `${b.year ?? 0}-${b.month ?? 0}`;
        const isUnder = b.spent_amount <= b.limit_amount;
        const existing = monthBuckets.get(key);
        if (existing) {
          existing.under = existing.under && isUnder;
        } else {
          monthBuckets.set(key, { under: isUnder });
        }
      }

      // Sort months descending and count consecutive under months
      const now = new Date();
      for (let i = 0; i < 24; i++) {
        const checkDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${checkDate.getFullYear()}-${checkDate.getMonth()}`;
        const bucket = monthBuckets.get(key);
        if (!bucket) break; // no budgets for that month
        if (!bucket.under) break; // exceeded limit
        budgetUnderStreakMonths++;
      }
    }

    // Goals completed (contributions >= target)
    const goals = goalsRes.data ?? [];
    const contributions = contribRes.data ?? [];
    const contribByGoal = new Map<string, number>();
    for (const c of contributions) {
      contribByGoal.set(c.goal_id, (contribByGoal.get(c.goal_id) ?? 0) + c.amount);
    }
    const goalsCompleted = goals.filter((g) => {
      const total = contribByGoal.get(g.id) ?? 0;
      return total >= g.target_amount || g.status === "completed";
    }).length;

    const totalInvested = (investRes.data ?? []).reduce((s: number, i: { amount: number }) => s + i.amount, 0);

    return {
      streak: currentStreak,
      totalTx: currentTx,
      budgetUnderStreakMonths,
      goalsCompleted,
      totalGoals: goals.length,
      totalInvested,
      cryptoHoldings: cryptoRes.count ?? 0,
      recurringCount: recurRes.count ?? 0,
    };
  }, [workspaceId]);

  /** Call after saving a transaction to update streak + check new achievements */
  const recordActivity = useCallback(async () => {
    if (!user || !workspaceId) return;

    const today = new Date().toISOString().split("T")[0];

    // Upsert streak
    const { data: existing } = await supabase
      .from("user_streaks")
      .select("*")
      .eq("user_id", user.id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    let newStreak: Streak;

    if (!existing) {
      newStreak = { current_streak: 1, longest_streak: 1, last_activity_date: today, total_days_active: 1 };
      await supabase.from("user_streaks").insert({
        user_id: user.id,
        workspace_id: workspaceId,
        ...newStreak,
      });
    } else {
      if (existing.last_activity_date === today) {
        newStreak = existing;
      } else {
        const lastDate = existing.last_activity_date ? new Date(existing.last_activity_date) : null;
        const todayDate = new Date(today);
        const diffDays = lastDate ? Math.floor((todayDate.getTime() - lastDate.getTime()) / 86400000) : 999;

        const currentStreak = diffDays === 1 ? existing.current_streak + 1 : 1;
        const longestStreak = Math.max(existing.longest_streak, currentStreak);
        const totalDaysActive = existing.total_days_active + 1;

        newStreak = { current_streak: currentStreak, longest_streak: longestStreak, last_activity_date: today, total_days_active: totalDaysActive };
        await supabase.from("user_streaks").update({
          ...newStreak,
          updated_at: new Date().toISOString(),
        }).eq("user_id", user.id).eq("workspace_id", workspaceId);
      }
    }

    setStreak(newStreak);

    const newTotalTx = totalTx + 1;
    setTotalTx(newTotalTx);

    // Build full context and check ALL achievements
    const ctx = await buildContext(newStreak, newTotalTx);
    return await checkAndUnlock(ctx);
  }, [user, workspaceId, totalTx, unlockedKeys, buildContext]);

  /** Check achievements without updating streak (for budget/goal/investment triggers) */
  const checkAchievements = useCallback(async () => {
    if (!user || !workspaceId) return;
    const ctx = await buildContext(streak, totalTx);
    return await checkAndUnlock(ctx);
  }, [user, workspaceId, streak, totalTx, unlockedKeys, buildContext]);

  /** Internal: compare context against ACHIEVEMENTS and persist new unlocks */
  const checkAndUnlock = useCallback(async (ctx: AchievementContext) => {
    if (!user || !workspaceId) return [];

    const newlyUnlocked: string[] = [];
    for (const ach of ACHIEVEMENTS) {
      if (!unlockedKeys.has(ach.key) && ach.check(ctx)) {
        newlyUnlocked.push(ach.key);
      }
    }

    if (newlyUnlocked.length > 0) {
      await supabase.from("user_achievements").insert(
        newlyUnlocked.map((key) => ({
          user_id: user!.id,
          workspace_id: workspaceId!,
          achievement_key: key,
        }))
      );
      setUnlockedKeys((prev) => {
        const next = new Set(prev);
        newlyUnlocked.forEach((k) => next.add(k));
        return next;
      });
    }

    return newlyUnlocked.map((key) => ACHIEVEMENTS.find((a) => a.key === key)!);
  }, [user, workspaceId, unlockedKeys]);

  return { streak, unlockedKeys, totalTx, loading, recordActivity, checkAchievements, reload: load };
}
