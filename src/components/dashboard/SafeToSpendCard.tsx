import bearMascot from "@/assets/bear-mascot.png";
import { Star } from "lucide-react";

interface SafeToSpendCardProps {
  amount: string;
  label?: string;
}

export function SafeToSpendCard({ amount, label = "Safe-to-Spend" }: SafeToSpendCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/90 to-accent/80 p-5 text-primary-foreground">
      {/* Decorative stars */}
      <Star className="absolute top-3 right-3 h-5 w-5 text-yellow-300 fill-yellow-300 animate-pulse" />
      <Star className="absolute top-8 right-10 h-3 w-3 text-yellow-300 fill-yellow-300 opacity-70" />
      <Star className="absolute bottom-4 right-20 h-4 w-4 text-yellow-300 fill-yellow-300 opacity-60" />
      <Star className="absolute top-2 left-1/2 h-3 w-3 text-yellow-300 fill-yellow-300 opacity-50" />

      <div className="flex items-center gap-4">
        {/* Bear mascot */}
        <img
          src={bearMascot}
          alt="Lumyf mascot"
          className="h-24 w-24 sm:h-28 sm:w-28 object-contain drop-shadow-lg flex-shrink-0"
          loading="eager"
          width={512}
          height={512}
        />

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/70 mb-1">
            {label}
          </p>
          <p className="text-2xl sm:text-3xl font-black tabular-nums">
            {amount}
          </p>
        </div>
      </div>
    </div>
  );
}
