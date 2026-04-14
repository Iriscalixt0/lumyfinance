import { useMemo } from "react";
import { Flame, Trophy, Star, Zap, Target } from "lucide-react";
import type { AchievementDef } from "@/hooks/useGamification";
import { ACHIEVEMENTS } from "@/hooks/useGamification";
import { Link } from "react-router-dom";

interface GamificationBarProps {
  streak: number;
  unlockedKeys: string[];
  totalTx: number;
}

function getLevel(totalTx: number): { level: number; title: string; progress: number; nextAt: number } {
  const tiers = [
    { min: 0, title: "Iniciante", icon: "🌱" },
    { min: 5, title: "Aprendiz", icon: "📘" },
    { min: 20, title: "Organizado", icon: "📊" },
    { min: 50, title: "Disciplinado", icon: "💪" },
    { min: 100, title: "Controlador", icon: "🎯" },
    { min: 200, title: "Estrategista", icon: "🧠" },
    { min: 500, title: "Mestre Financeiro", icon: "🏆" },
  ];

  let current = tiers[0];
  let next = tiers[1];
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (totalTx >= tiers[i].min) {
      current = tiers[i];
      next = tiers[i + 1] || tiers[i];
      break;
    }
  }

  const level = tiers.indexOf(current) + 1;
  const progress = next === current ? 100 : Math.min(100, Math.round(((totalTx - current.min) / (next.min - current.min)) * 100));

  return { level, title: `${current.icon} ${current.title}`, progress, nextAt: next.min };
}

export function GamificationBar({ streak, unlockedKeys, totalTx }: GamificationBarProps) {
  const { level, title, progress, nextAt } = useMemo(() => getLevel(totalTx), [totalTx]);
  const totalAchievements = ACHIEVEMENTS.length;
  const unlockedCount = unlockedKeys.length;

  // Find next locked achievement hint
  const nextAchievement = useMemo(() => {
    return ACHIEVEMENTS.find(a => !unlockedKeys.includes(a.key));
  }, [unlockedKeys]);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4 animate-fade-in shadow-[var(--card-shadow)]">
      {/* Top row: Level + Streak */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nível {level}</p>
            <p className="text-sm font-bold text-foreground truncate">{title}</p>
          </div>
        </div>

        {/* Streak badge */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shrink-0 ${
          streak >= 3
            ? "bg-orange-500/15 border border-orange-500/30"
            : "bg-muted/50 border border-border"
        }`}>
          <Flame className={`h-4 w-4 ${streak >= 3 ? "text-orange-500" : "text-muted-foreground"}`} />
          <span className={`text-sm font-bold tabular-nums ${streak >= 3 ? "text-orange-500" : "text-muted-foreground"}`}>
            {streak}
          </span>
        </div>
      </div>

      {/* XP Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground font-medium">{totalTx} transações</span>
          <span className="text-muted-foreground/60">{progress < 100 ? `Próx: ${nextAt}` : "Nível máximo!"}</span>
        </div>
        <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-emerald-400 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Achievements row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-500" />
          <span className="text-xs font-semibold text-foreground">
            {unlockedCount}/{totalAchievements} conquistas
          </span>
        </div>

        {nextAchievement && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Target className="h-3 w-3" />
            <span className="truncate max-w-[160px]">{nextAchievement.hint}</span>
          </div>
        )}
      </div>

      {/* Recent unlocked badges */}
      {unlockedCount > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {unlockedKeys.slice(-5).map(key => {
            const ach = ACHIEVEMENTS.find(a => a.key === key);
            return ach ? (
              <span
                key={key}
                className="text-lg hover:scale-125 transition-transform cursor-default"
                title={ach.name}
              >
                {ach.icon}
              </span>
            ) : null;
          })}
          {unlockedCount > 5 && (
            <span className="text-[11px] text-muted-foreground font-medium ml-1">+{unlockedCount - 5}</span>
          )}
        </div>
      )}
    </div>
  );
}
