import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export interface Streak {
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  total_days_active: number;
}

export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  icon: string;
  check: (streak: Streak, totalTx: number) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: "first_tx", name: "Primeiro Passo", description: "Lançou sua primeira transação", icon: "🎯", check: (_, tx) => tx >= 1 },
  { key: "streak_3", name: "Constância", description: "3 dias consecutivos lançando gastos", icon: "🔥", check: (s) => s.longest_streak >= 3 },
  { key: "streak_7", name: "Semana Perfeita", description: "7 dias consecutivos", icon: "⚡", check: (s) => s.longest_streak >= 7 },
  { key: "streak_14", name: "Disciplinado", description: "14 dias consecutivos", icon: "💪", check: (s) => s.longest_streak >= 14 },
  { key: "streak_30", name: "Mestre do Hábito", description: "30 dias consecutivos", icon: "🏆", check: (s) => s.longest_streak >= 30 },
  { key: "tx_10", name: "Organizado", description: "10 transações registradas", icon: "📊", check: (_, tx) => tx >= 10 },
  { key: "tx_50", name: "Detalhista", description: "50 transações registradas", icon: "🔍", check: (_, tx) => tx >= 50 },
  { key: "tx_100", name: "Profissional", description: "100 transações registradas", icon: "💎", check: (_, tx) => tx >= 100 },
  { key: "days_10", name: "Veterano", description: "10 dias ativos no total", icon: "📅", check: (s) => s.total_days_active >= 10 },
  { key: "days_30", name: "Lenda", description: "30 dias ativos no total", icon: "👑", check: (s) => s.total_days_active >= 30 },
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
        // Already recorded today
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

    // Check new achievements
    const newTotalTx = totalTx + 1;
    setTotalTx(newTotalTx);

    const newlyUnlocked: string[] = [];
    for (const ach of ACHIEVEMENTS) {
      if (!unlockedKeys.has(ach.key) && ach.check(newStreak, newTotalTx)) {
        newlyUnlocked.push(ach.key);
      }
    }

    if (newlyUnlocked.length > 0) {
      await supabase.from("user_achievements").insert(
        newlyUnlocked.map((key) => ({
          user_id: user.id,
          workspace_id: workspaceId,
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
  }, [user, workspaceId, totalTx, unlockedKeys]);

  return { streak, unlockedKeys, totalTx, loading, recordActivity, reload: load };
}
