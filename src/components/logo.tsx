type LogoSize = "sm" | "md" | "lg";

const sizeMap = {
  sm: "h-8 w-8 sm:h-9 sm:w-9",
  md: "h-10 w-10 sm:h-11 sm:w-11",
  lg: "h-14 w-14 sm:h-16 sm:w-16 md:h-[4.5rem] md:w-[4.5rem]",
} as const;

export function Logo({ size = "md", className = "" }: { size?: LogoSize; className?: string }) {
  return (
    <img
      src="/pig.png"
      alt="Lumy"
      className={`object-contain ${sizeMap[size]} ${className}`}
      loading="eager"
    />
  );
}
