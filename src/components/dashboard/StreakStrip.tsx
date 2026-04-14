import { Flame, TrendingUp, Trophy, Sparkles } from "lucide-react";

interface StreakStripProps {
  currentStreak: number;
  totalTx: number;
  lastWeekTx?: number;
  thisWeekTx?: number;
}

export function StreakStrip({ currentStreak, totalTx, lastWeekTx = 0, thisWeekTx = 0 }: StreakStripProps) {
  // Pick the right small-win message
  const getWinMessage = (): { icon: string; text: string } | null => {
    if (currentStreak >= 7) return { icon: "🏆", text: "Semana perfeita! Você é disciplinado." };
    if (currentStreak >= 3) return { icon: "🔥", text: "Tá no ritmo! Segue assim." };
    if (thisWeekTx > lastWeekTx && lastWeekTx > 0) return { icon: "📈", text: "Melhor que semana passada!" };
    if (totalTx >= 50) return { icon: "💎", text: "Você já é profissional." };
    if (totalTx >= 10) return { icon: "⭐", text: "Organizado demais!" };
    if (totalTx >= 1) return { icon: "🎯", text: "Primeiro passo dado!" };
    return null;
  };

  const win = getWinMessage();

  if (currentStreak === 0 && !win) return null;

  return (
    <div className="flex items-center gap-3 overflow-x-auto pb-1 -mx-1 px-1">
      {/* Streak pill */}
      {currentStreak > 0 && (
        <div className="flex items-center gap-1.5 bg-orange-500/10 text-orange-400 px-3 py-1.5 rounded-full shrink-0">
          <Flame className="h-3.5 w-3.5" />
          <span className="text-xs font-bold tabular-nums">{currentStreak} dia{currentStreak > 1 ? "s" : ""}</span>
        </div>
      )}

      {/* Small win */}
      {win && (
        <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full shrink-0">
          <span className="text-sm">{win.icon}</span>
          <span className="text-xs font-semibold">{win.text}</span>
        </div>
      )}
    </div>
  );
}
