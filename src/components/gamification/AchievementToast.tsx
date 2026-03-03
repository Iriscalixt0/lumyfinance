import { useEffect, useState } from "react";
import type { AchievementDef } from "@/hooks/useGamification";

interface AchievementToastProps {
  achievement: AchievementDef | null;
  onDone: () => void;
}

export function AchievementToast({ achievement, onDone }: AchievementToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!achievement) return;
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 300);
    }, 3500);
    return () => clearTimeout(timer);
  }, [achievement, onDone]);

  if (!achievement) return null;

  return (
    <div
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
      }`}
    >
      <div className="bg-card border-2 border-primary/30 rounded-2xl px-6 py-4 shadow-lg flex items-center gap-4">
        <span className="text-3xl">{achievement.icon}</span>
        <div>
          <p className="text-xs font-semibold text-primary uppercase tracking-wider">Conquista desbloqueada!</p>
          <p className="text-sm font-bold text-foreground">{achievement.name}</p>
          <p className="text-xs text-muted-foreground">{achievement.description}</p>
        </div>
      </div>
    </div>
  );
}
