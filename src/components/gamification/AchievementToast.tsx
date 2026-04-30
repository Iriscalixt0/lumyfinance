import { useEffect, useState } from "react";
import { Share2, X } from "lucide-react";
import type { AchievementDef } from "@/hooks/useGamification";
import { ShareableAchievementCard } from "@/components/gamification/ShareableAchievementCard";

interface AchievementToastProps {
  achievement: AchievementDef | null;
  onDone: () => void;
}

export function AchievementToast({ achievement, onDone }: AchievementToastProps) {
  const [visible, setVisible] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (!achievement) return;
    setVisible(true);
    // Auto-dismiss after 6s — but pause if user opened the share modal
    const timer = setTimeout(() => {
      if (!shareOpen) {
        setVisible(false);
        setTimeout(onDone, 300);
      }
    }, 6000);
    return () => clearTimeout(timer);
  }, [achievement, onDone, shareOpen]);

  if (!achievement) return null;

  // Map achievement → ShareableAchievementCard props.
  // Streak achievements use type="streak" (flame), all others use type="goal" (Finny).
  const isStreak = achievement.key?.toLowerCase().includes("streak");
  const numericValue = Number(achievement.value ?? 0) || 1;

  return (
    <>
      <div
        className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
        }`}
      >
        <div className="bg-card border-2 border-primary/30 rounded-2xl px-5 py-4 shadow-lg flex items-center gap-4 max-w-md">
          <span className="text-3xl shrink-0">{achievement.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">
              Conquista desbloqueada!
            </p>
            <p className="text-sm font-bold text-foreground truncate">{achievement.name}</p>
            <p className="text-xs text-muted-foreground line-clamp-2">{achievement.description}</p>
          </div>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            aria-label="Compartilhar conquista"
            className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-full bg-primary text-primary-foreground hover:brightness-110 active:scale-95 transition-all"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {shareOpen && (
        <div
          className="fixed inset-0 z-[110] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShareOpen(false)}
        >
          <div
            className="w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <ShareableAchievementCard
              type={isStreak ? "streak" : "goal"}
              value={numericValue}
              label={achievement.name}
              onClose={() => {
                setShareOpen(false);
                setVisible(false);
                setTimeout(onDone, 300);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
