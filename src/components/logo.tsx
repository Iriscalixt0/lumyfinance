import finnyLogo from "@/assets/finny-happy.png";

type LogoSize = "sm" | "md" | "lg";

const sizeMap = {
  sm: "h-11 w-11 sm:h-12 sm:w-12",
  md: "h-14 w-14 sm:h-16 sm:w-16",
  lg: "h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28",
} as const;

export function Logo({ size = "md", className = "" }: { size?: LogoSize; className?: string }) {
  return (
    <div className={`relative inline-flex items-center justify-center ${sizeMap[size]} ${className}`}>
      {/*
        Adaptive glow:
        - Dark mode: vivid teal halo + soft accent bloom for premium feel on #05130d background.
        - Light mode: subtle, low-opacity halo that adds depth without muddying white surfaces.
        Tailwind `dark:` variants flip intensity per theme.
      */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full scale-110 blur-xl animate-pulse
                   bg-primary/15 dark:bg-primary/40"
      />
      <span
        aria-hidden
        className="absolute inset-0 rounded-full scale-125 blur-2xl
                   bg-accent/10 dark:bg-accent/30"
      />
      <img
        src={finnyLogo}
        alt="Lumy — Finny mascote"
        className="relative h-full w-full object-contain
                   drop-shadow-[0_2px_6px_hsl(var(--primary)/0.25)]
                   dark:drop-shadow-[0_0_12px_hsl(var(--primary)/0.55)]"
        loading="eager"
      />
    </div>
  );
}
