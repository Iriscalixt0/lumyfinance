import { useEffect, useState } from "react";
import { useTranslations } from "@/lib/i18n";

interface HealthScoreCardProps {
  score: number;
  loading?: boolean;
}

function getScoreColor(score: number) {
  if (score < 40) return { label: "text-rose-500", bg: "bg-rose-500/10" };
  if (score <= 70) return { label: "text-amber-500", bg: "bg-amber-500/10" };
  return { label: "text-emerald-500", bg: "bg-emerald-500/10" };
}

function getScorePhrase(score: number, t: (k: string) => string): string {
  if (score <= 40) return t("scorePhraseLow");
  if (score <= 70) return t("scorePhraseMid");
  return t("scorePhraseHigh");
}

export function HealthScoreCard({ score, loading }: HealthScoreCardProps) {
  const t = useTranslations("dashboard");
  const [animatedScore, setAnimatedScore] = useState(0);
  const colors = getScoreColor(score);

  useEffect(() => {
    if (loading) return;
    let frame: number;
    const duration = 1200;
    const start = performance.now();
    function animate(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(eased * score));
      if (progress < 1) frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score, loading]);

  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedScore / 100) * circumference;

  // Gradient stop colors based on score position
  const gradientId = "health-score-gradient";

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-4 animate-pulse">
        <div className="h-44 w-44 rounded-full bg-muted" />
        <div className="h-5 w-48 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-4 animate-fade">
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
        {t("healthScore")}
      </h2>

      <div className="relative w-44 h-44">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(0, 84%, 60%)" />
              <stop offset="50%" stopColor="hsl(45, 93%, 47%)" />
              <stop offset="100%" stopColor="hsl(142, 71%, 45%)" />
            </linearGradient>
          </defs>
          <circle cx="80" cy="80" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
          <circle
            cx="80" cy="80" r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-5xl font-extrabold tabular-nums ${colors.label}`}>
            {animatedScore}
          </span>
          <span className="text-xs text-muted-foreground font-medium mt-0.5">/ 100</span>
        </div>
      </div>

      {/* Dynamic phrase */}
      <p className={`text-sm font-medium text-center max-w-xs leading-relaxed ${colors.label}`}>
        {getScorePhrase(score, t)}
      </p>
    </div>
  );
}
