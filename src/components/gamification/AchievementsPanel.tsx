import { ACHIEVEMENTS } from "@/hooks/useGamification";
import { useTranslations } from "@/lib/i18n";
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
  const t = useTranslations("gamification");
  const total = ACHIEVEMENTS.length;
  const unlockedCount = ACHIEVEMENTS.filter((a) => unlockedKeys.has(a.key)).length;

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat] || cat,
    items: ACHIEVEMENTS.filter((a) => a.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground text-sm">{t("achievements")}</h3>
        <span className="text-xs text-muted-foreground">
          {unlockedCount}/{total} {t("unlocked")}
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
                      className="relative group flex flex-col items-center"
                      title={isUnlocked ? `${a.name}: ${a.description}` : a.hint}
                    >
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-lg transition-all duration-300 group-hover:scale-110 ${
                        isUnlocked
                          ? "bg-primary/10 border border-primary/30 shadow-[0_0_12px_hsl(var(--primary)/0.3)] ring-1 ring-primary/20"
                          : "bg-muted/50 border border-border grayscale"
                      }`}>
                        {isUnlocked ? (
                          <span className="drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]">{a.icon}</span>
                        ) : (
                          <Lock className="h-3.5 w-3.5 text-muted-foreground/50" />
                        )}
                      </div>
                      <p className={`text-[9px] font-medium mt-1 text-center leading-tight w-full px-0.5 ${
                        isUnlocked ? "text-foreground" : "text-muted-foreground/60"
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
