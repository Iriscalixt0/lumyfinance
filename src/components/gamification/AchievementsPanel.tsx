import { ACHIEVEMENTS } from "@/hooks/useGamification";
import { Lock } from "lucide-react";

interface AchievementsPanelProps {
  unlockedKeys: Set<string>;
}

const CATEGORY_LABELS: Record<string, string> = {
  streak: "🔥 Consistência",
  transactions: "📊 Transações",
  budget: "🛡️ Orçamento",
  goals: "🎯 Metas",
  investing: "📈 Investimentos",
  misc: "🔄 Outros",
};

const CATEGORY_ORDER = ["streak", "transactions", "budget", "goals", "investing", "misc"];

export function AchievementsPanel({ unlockedKeys }: AchievementsPanelProps) {
  const total = ACHIEVEMENTS.length;
  const unlockedCount = ACHIEVEMENTS.filter((a) => unlockedKeys.has(a.key)).length;

  // Group by category
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat] || cat,
    items: ACHIEVEMENTS.filter((a) => a.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground text-sm">Conquistas</h3>
        <span className="text-xs text-muted-foreground">
          {unlockedCount}/{total} desbloqueadas
        </span>
      </div>

      <div className="space-y-4">
        {grouped.map((group) => {
          const groupUnlocked = group.items.filter((a) => unlockedKeys.has(a.key)).length;
          return (
            <div key={group.category}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground">{group.label}</span>
                <span className="text-[10px] text-muted-foreground">{groupUnlocked}/{group.items.length}</span>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {group.items.map((a) => {
                  const isUnlocked = unlockedKeys.has(a.key);
                  return (
                    <div
                      key={a.key}
                      className={`relative group flex flex-col items-center ${!isUnlocked ? "opacity-40" : ""}`}
                      title={`${a.name}: ${a.description}`}
                    >
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-lg transition-transform group-hover:scale-110 ${
                        isUnlocked
                          ? "bg-primary/10 border border-primary/20"
                          : "bg-muted border border-border"
                      }`}>
                        {isUnlocked ? a.icon : <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                      </div>
                      <p className={`text-[9px] font-medium mt-1 text-center truncate w-full ${
                        isUnlocked ? "text-foreground" : "text-muted-foreground"
                      }`}>
                        {isUnlocked ? a.name : a.hint}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
