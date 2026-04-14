import { useState, useEffect, useCallback } from "react";
import { Star, Heart, TrendingUp, Shield } from "lucide-react";
import { getFinnyState, type FinnyState } from "@/lib/finny-personality";

interface SafeToSpendCardProps {
  amount: string;
  label?: string;
  safeToSpend?: number;
  monthlyIncome?: number;
  monthlyExpenses?: number;
  streak?: number;
  totalTx?: number;
  userName?: string;
}

export function SafeToSpendCard({
  amount,
  label = "Safe-to-Spend",
  safeToSpend = 0,
  monthlyIncome = 0,
  monthlyExpenses = 0,
  streak = 0,
  totalTx = 0,
  userName = "User",
}: SafeToSpendCardProps) {
  const [bearBounce, setBearBounce] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [finny, setFinny] = useState<FinnyState | null>(null);

  // Calculate Finny state
  useEffect(() => {
    const state = getFinnyState({ safeToSpend, monthlyIncome, monthlyExpenses, streak, totalTx, userName });
    setFinny(state);
  }, [safeToSpend, monthlyIncome, monthlyExpenses, streak, totalTx, userName]);

  // Animate in
  useEffect(() => {
    const t1 = setTimeout(() => setBearBounce(true), 300);
    const t2 = setTimeout(() => setBearBounce(false), 900);
    const t3 = setTimeout(() => setShowBubble(true), 800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  // Rotate phrase every 8s
  useEffect(() => {
    const interval = setInterval(() => {
      setFinny(getFinnyState({ safeToSpend, monthlyIncome, monthlyExpenses, streak, totalTx, userName }));
    }, 8000);
    return () => clearInterval(interval);
  }, [safeToSpend, monthlyIncome, monthlyExpenses, streak, totalTx, userName]);

  const handleBearClick = useCallback(() => {
    setBearBounce(true);
    setTimeout(() => setBearBounce(false), 600);
    // Force new phrase
    setFinny(getFinnyState({ safeToSpend, monthlyIncome, monthlyExpenses, streak, totalTx, userName }));
  }, [safeToSpend, monthlyIncome, monthlyExpenses, streak, totalTx, userName]);

  if (!finny) return null;

  const healthBarColor =
    finny.healthPercent >= 80 ? "from-emerald-400 to-emerald-500" :
    finny.healthPercent >= 60 ? "from-primary to-accent" :
    finny.healthPercent >= 40 ? "from-yellow-400 to-yellow-500" :
    "from-red-400 to-red-500";

  return (
    <div className="space-y-3">
      {/* Main premium card */}
      <div className="relative overflow-hidden rounded-2xl p-5 sm:p-7"
        style={{
          background: "linear-gradient(135deg, #1FAF8B 0%, #0E7A66 100%)",
          boxShadow: "0 8px 32px -8px rgba(14,122,102,0.5), 0 0 60px -20px rgba(31,175,139,0.2), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        {/* Floating stars — gentle twinkle */}
        <Star className="absolute top-3 right-5 h-5 w-5 text-yellow-300/80 fill-yellow-300/80 animate-pulse" style={{ animationDuration: "3s" }} />
        <Star className="absolute top-9 right-14 h-3 w-3 text-yellow-300/60 fill-yellow-300/60 animate-pulse" style={{ animationDuration: "4s", animationDelay: "1s" }} />
        <Star className="absolute bottom-5 right-20 h-3.5 w-3.5 text-yellow-300/50 fill-yellow-300/50 animate-pulse" style={{ animationDuration: "3.5s", animationDelay: "2s" }} />
        <Star className="absolute top-2 left-[42%] h-2.5 w-2.5 text-emerald-200/40 fill-emerald-200/40 animate-pulse" style={{ animationDuration: "5s", animationDelay: "0.5s" }} />
        <Star className="absolute bottom-3 left-[55%] h-2 w-2 text-yellow-200/30 fill-yellow-200/30 animate-pulse" style={{ animationDuration: "4.5s", animationDelay: "1.5s" }} />

        {/* Glow behind mascot */}
        <div className="absolute bottom-0 left-4 w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-white/8 blur-2xl pointer-events-none" />
        <div className="absolute -top-16 -right-16 w-36 h-36 rounded-full bg-emerald-300/8 blur-3xl pointer-events-none" />

        {/* Speech Bubble */}
        <div
          className={`absolute top-1 left-[7.5rem] sm:left-[9.5rem] z-10 transition-all duration-700 ${
            showBubble ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-3 scale-90"
          }`}
        >
          <div className="relative bg-white/95 dark:bg-white/15 backdrop-blur-xl rounded-2xl rounded-bl-sm px-3 py-2 shadow-xl max-w-[180px] sm:max-w-[220px] border border-white/20">
            <p className="text-[10px] sm:text-[11px] font-semibold text-foreground leading-snug" key={finny.phrase}>
              {finny.phrase}
            </p>
            <div className="absolute -bottom-1.5 left-4 w-3 h-3 bg-white/95 dark:bg-white/15 rotate-45 border-b border-r border-white/20" />
          </div>
        </div>

        <div className="flex items-end gap-4 sm:gap-5">
          {/* Finny — reactive mascot */}
          <div className="relative flex-shrink-0">
            <img
              src={finny.image}
              alt={`Finny está ${finny.mood}`}
              className={`h-28 w-28 sm:h-36 sm:w-36 object-contain drop-shadow-2xl cursor-pointer transition-all duration-300 hover:scale-110 ${
                bearBounce ? "animate-[bounce_0.6s_ease-out]" : ""
              }`}
              loading="eager"
              width={512}
              height={512}
              onClick={handleBearClick}
            />
            {/* Mood indicator dot */}
            <div className={`absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full border-2 border-white/30 ${
              finny.mood === "worried" ? "bg-red-400" :
              finny.mood === "celebrating" ? "bg-yellow-400 animate-pulse" :
              "bg-emerald-400"
            }`} />
          </div>

          {/* Amount + label */}
          <div className="flex-1 min-w-0 pb-1">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.15em] text-white/60 mb-0.5">
              {label}
            </p>
            <p className="text-2xl sm:text-4xl font-black tabular-nums text-white leading-none mb-2">
              {amount}
            </p>
            {/* Mini mood tag */}
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
              finny.mood === "worried" ? "bg-red-500/20 text-red-300" :
              finny.mood === "celebrating" ? "bg-yellow-500/20 text-yellow-300" :
              finny.mood === "happy" ? "bg-emerald-500/20 text-emerald-300" :
              "bg-white/10 text-white/60"
            }`}>
              {finny.mood === "worried" && "⚠️ atenção"}
              {finny.mood === "neutral" && "😐 neutro"}
              {finny.mood === "happy" && "😊 tranquilo"}
              {finny.mood === "celebrating" && "🎉 excelente"}
            </span>
          </div>
        </div>
      </div>

      {/* Financial Health Bar */}
      <div className="bg-card/80 backdrop-blur-sm border border-border rounded-2xl px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Heart className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-foreground">Saúde Financeira</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-black tabular-nums ${finny.healthColor}`}>
              {finny.healthPercent}%
            </span>
            <span className={`text-[10px] font-bold uppercase ${finny.healthColor}`}>
              {finny.healthLabel}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${healthBarColor} rounded-full transition-all duration-1000 ease-out`}
            style={{ width: `${finny.healthPercent}%` }}
          />
        </div>

        {/* Quick stats */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
          <div className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            <span>Nenhum pagamento pendente</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            <span>Finny cuida de você</span>
          </div>
        </div>
      </div>
    </div>
  );
}
