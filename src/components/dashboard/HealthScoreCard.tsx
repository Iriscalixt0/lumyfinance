import { useEffect, useState } from "react";
import { useTranslations } from "@/lib/i18n";

interface HealthScoreCardProps {
  score: number;
  loading?: boolean;
}

function getScoreColor(score: number) {
  if (score < 40) return { stroke: "hsl(0, 84%, 60%)", label: "text-rose-500", bg: "bg-rose-500/10" };
  if (score <= 70) return { stroke: "hsl(45, 93%, 47%)", label: "text-amber-500", bg: "bg-amber-500/10" };
  return { stroke: "hsl(142, 71%, 45%)", label: "text-emerald-500", bg: "bg-emerald-500/10" };
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
          <circle cx="80" cy="80" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
          <circle
            cx="80" cy="80" r={radius}
            fill="none"
            stroke={colors.stroke}
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
    </div>
  );
}
