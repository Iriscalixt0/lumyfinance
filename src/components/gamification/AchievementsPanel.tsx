import { ACHIEVEMENTS } from "@/hooks/useGamification";
import { Lock } from "lucide-react";

interface AchievementsPanelProps {
  unlockedKeys: Set<string>;
}

export function AchievementsPanel({ unlockedKeys }: AchievementsPanelProps) {
  const unlocked = ACHIEVEMENTS.filter((a) => unlockedKeys.has(a.key));
  const locked = ACHIEVEMENTS.filter((a) => !unlockedKeys.has(a.key));

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground text-sm">Conquistas</h3>
        <span className="text-xs text-muted-foreground">
          {unlocked.length}/{ACHIEVEMENTS.length} desbloqueadas
        </span>
      </div>

      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
        {unlocked.map((a) => (
          <div
            key={a.key}
            className="relative group flex flex-col items-center"
            title={`${a.name}: ${a.description}`}
          >
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-lg transition-transform group-hover:scale-110">
              {a.icon}
            </div>
            <p className="text-[9px] text-foreground font-medium mt-1 text-center truncate w-full">{a.name}</p>
          </div>
        ))}
        {locked.map((a) => (
          <div
            key={a.key}
            className="relative group flex flex-col items-center opacity-40"
            title={a.description}
          >
            <div className="h-10 w-10 rounded-xl bg-muted border border-border flex items-center justify-center">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-[9px] text-muted-foreground font-medium mt-1 text-center truncate w-full">???</p>
          </div>
        ))}
      </div>
    </div>
  );
}
