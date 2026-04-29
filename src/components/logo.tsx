import finnyLogo from "@/assets/finny-happy.png";

type LogoSize = "sm" | "md" | "lg";

const sizeMap = {
  sm: "h-8 w-8 sm:h-9 sm:w-9",
  md: "h-10 w-10 sm:h-11 sm:w-11",
  lg: "h-14 w-14 sm:h-16 sm:w-16 md:h-[4.5rem] md:w-[4.5rem]",
} as const;

export function Logo({ size = "md", className = "" }: { size?: LogoSize; className?: string }) {
  return (
    <div className={`relative inline-flex items-center justify-center ${sizeMap[size]} ${className}`}>
      {/* Glow halo behind Finny */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full bg-primary/40 blur-xl scale-110 animate-pulse"
      />
      <span
        aria-hidden
        className="absolute inset-0 rounded-full bg-accent/30 blur-2xl scale-125"
      />
      <img
        src={finnyLogo}
        alt="Lumy — Finny mascote"
        className="relative h-full w-full object-contain drop-shadow-[0_0_12px_hsl(var(--primary)/0.55)]"
        loading="eager"
      />
    </div>
  );
}
