import { useState, useEffect } from "react";
import bearMascot from "@/assets/bear-mascot.png";
import { Star, Info } from "lucide-react";
import { BearSpeechBubble } from "./BearSpeechBubble";

interface SafeToSpendCardProps {
  amount: string;
  label?: string;
  safeToSpend?: number;
  streak?: number;
  totalTx?: number;
  userName?: string;
}

export function SafeToSpendCard({
  amount,
  label = "Safe-to-Spend",
  safeToSpend = 0,
  streak = 0,
  totalTx = 0,
  userName = "User",
}: SafeToSpendCardProps) {
  const [bearBounce, setBearBounce] = useState(false);

  // Bear bounces on mount
  useEffect(() => {
    setBearBounce(true);
    const timer = setTimeout(() => setBearBounce(false), 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(160,50%,30%)] to-[hsl(160,45%,40%)] p-6 sm:p-8">
        {/* Decorative stars */}
        <Star className="absolute top-4 right-6 h-6 w-6 text-yellow-300 fill-yellow-300 animate-pulse" />
        <Star className="absolute top-10 right-14 h-4 w-4 text-yellow-300 fill-yellow-300 opacity-80" />
        <Star className="absolute bottom-6 right-24 h-5 w-5 text-yellow-300 fill-yellow-300 opacity-60" />
        <Star className="absolute top-3 left-[45%] h-3 w-3 text-yellow-300 fill-yellow-300 opacity-50" />
        <Star className="absolute bottom-3 left-[55%] h-4 w-4 text-yellow-300 fill-yellow-300 opacity-40" />
        <Star className="absolute top-6 left-[30%] h-3 w-3 text-green-300 fill-green-300 opacity-30" />

        {/* Speech bubble */}
        <BearSpeechBubble
          safeToSpend={safeToSpend}
          streak={streak}
          totalTx={totalTx}
          userName={userName}
        />

        <div className="flex items-center gap-5">
          {/* Bear mascot — animated */}
          <img
            src={bearMascot}
            alt="Lumyf mascot"
            className={`h-28 w-28 sm:h-36 sm:w-36 object-contain drop-shadow-2xl flex-shrink-0 cursor-pointer hover:scale-110 transition-transform duration-300 ${
              bearBounce ? "animate-[bounce_0.6s_ease-out]" : ""
            }`}
            loading="eager"
            width={512}
            height={512}
            onClick={() => {
              setBearBounce(true);
              setTimeout(() => setBearBounce(false), 600);
            }}
          />

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold uppercase tracking-wider text-white/70 mb-1">
              {label}
            </p>
            <p className="text-3xl sm:text-4xl font-black tabular-nums text-white">
              {amount}
            </p>
          </div>
        </div>
      </div>

      {/* Saúde do Cashflow label */}
      <div className="flex items-center justify-between mt-3 px-1 flex-wrap gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground truncate">Saúde do Cashflow</span>
          <Info className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
        </div>
        <span className="text-xs text-muted-foreground/60 whitespace-nowrap">Nenhum pagamento pendente</span>
      </div>
    </div>
  );
}
