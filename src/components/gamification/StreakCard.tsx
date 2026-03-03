import { Flame, Trophy, Calendar } from "lucide-react";
import type { Streak } from "@/hooks/useGamification";

interface StreakCardProps {
  streak: Streak;
  totalTx: number;
}

export function StreakCard({ streak, totalTx }: StreakCardProps) {
  const isActive = streak.current_streak > 0;

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isActive ? "bg-amber-500/10" : "bg-muted"}`}>
          <Flame className={`h-5 w-5 ${isActive ? "text-amber-500" : "text-muted-foreground"}`} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            {streak.current_streak > 0
              ? `${streak.current_streak} dia${streak.current_streak > 1 ? "s" : ""} seguido${streak.current_streak > 1 ? "s" : ""}!`
              : "Inicie seu streak hoje!"
            }
          </p>
          <p className="text-xs text-muted-foreground">Lance um gasto para manter a sequência</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-2 bg-muted/50 rounded-lg">
          <Flame className="h-4 w-4 text-amber-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-foreground">{streak.current_streak}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Atual</p>
        </div>
        <div className="text-center p-2 bg-muted/50 rounded-lg">
          <Trophy className="h-4 w-4 text-primary mx-auto mb-1" />
          <p className="text-lg font-bold text-foreground">{streak.longest_streak}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Recorde</p>
        </div>
        <div className="text-center p-2 bg-muted/50 rounded-lg">
          <Calendar className="h-4 w-4 text-primary mx-auto mb-1" />
          <p className="text-lg font-bold text-foreground">{streak.total_days_active}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Dias</p>
        </div>
      </div>
    </div>
  );
}
