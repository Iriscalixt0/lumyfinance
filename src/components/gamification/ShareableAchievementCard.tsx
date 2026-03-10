import { useCallback, useRef, useState } from "react";
import { useIntlFormat } from "@/hooks/useIntlFormat";
import { useTranslations } from "@/lib/i18n";
import { Share2, Download, X } from "lucide-react";

interface ShareableAchievementCardProps {
  type: "goal" | "streak";
  /** For goal: amount saved. For streak: days count */
  value: number;
  label?: string;
  onClose?: () => void;
}

export function ShareableAchievementCard({ type, value, label, onClose }: ShareableAchievementCardProps) {
  const t = useTranslations("gamification");
  const fmt = useIntlFormat();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sharing, setSharing] = useState(false);

  const generateCard = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      const w = 600;
      const h = 340;
      canvas.width = w;
      canvas.height = h;

      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, "#0f172a");
      grad.addColorStop(1, "#1e3a3a");
      ctx.fillStyle = grad;
      ctx.roundRect(0, 0, w, h, 24);
      ctx.fill();

      // Accent line
      const accent = ctx.createLinearGradient(0, 0, w, 0);
      accent.addColorStop(0, "#10b981");
      accent.addColorStop(1, "#06b6d4");
      ctx.fillStyle = accent;
      ctx.fillRect(0, 0, w, 4);

      // Emoji
      ctx.font = "48px serif";
      ctx.textAlign = "center";
      ctx.fillText(type === "streak" ? "🔥" : "🎯", w / 2, 80);

      // Main value
      ctx.fillStyle = "#10b981";
      ctx.font = "bold 52px system-ui, sans-serif";
      ctx.textAlign = "center";
      if (type === "goal") {
        ctx.fillText(fmt.money(value), w / 2, 150);
      } else {
        ctx.fillText(`${value} ${t("streakDays")}`, w / 2, 150);
      }

      // Label
      ctx.fillStyle = "#94a3b8";
      ctx.font = "18px system-ui, sans-serif";
      ctx.fillText(
        label || (type === "goal" ? t("savedThisMonth") : t("streakAchieved")),
        w / 2,
        190
      );

      // Tagline
      ctx.fillStyle = "#64748b";
      ctx.font = "14px system-ui, sans-serif";
      ctx.fillText(t("shareTagline"), w / 2, 240);

      // Brand
      ctx.fillStyle = "#10b981";
      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.fillText("lumyf.app", w / 2, 300);

      canvas.toBlob((blob) => resolve(blob!), "image/png");
    });
  }, [type, value, label, fmt, t]);

  const handleShare = useCallback(async () => {
    setSharing(true);
    try {
      const blob = await generateCard();
      const file = new File([blob], "lumyf-achievement.png", { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "Lumyf",
          text: type === "goal"
            ? t("shareGoalText", { value: fmt.money(value) })
            : t("shareStreakText", { value: String(value) }),
          files: [file],
        });
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "lumyf-achievement.png";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // user cancelled share
    } finally {
      setSharing(false);
    }
  }, [generateCard, type, value, fmt, t]);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 animate-fade">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          {t("shareAchievement")}
        </h3>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Preview */}
      <div className="bg-gradient-to-br from-[#0f172a] to-[#1e3a3a] rounded-xl p-6 text-center mb-4">
        {type === "streak" ? <span className="text-4xl">🔥</span> : <img src="/pig.png" alt="Lumyf" className="h-12 w-12 mx-auto object-contain" />}
        <p className="text-2xl font-extrabold text-emerald-400 mt-2 tabular-nums">
          {type === "goal" ? fmt.money(value) : `${value} ${t("streakDays")}`}
        </p>
        <p className="text-sm text-slate-400 mt-1">
          {label || (type === "goal" ? t("savedThisMonth") : t("streakAchieved"))}
        </p>
        <p className="text-xs text-slate-500 mt-3">lumyf.app</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleShare}
          disabled={sharing}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 active:scale-[0.97] transition-all disabled:opacity-60"
        >
          <Share2 className="h-4 w-4" />
          {t("share")}
        </button>
        <button
          onClick={handleShare}
          disabled={sharing}
          className="flex items-center justify-center px-3 py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
