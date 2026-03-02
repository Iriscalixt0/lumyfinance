"use client";

import Image from "next/image";

type LogoSize = "sm" | "md" | "lg";

const sizeMap = {
  sm: { className: "h-8 w-8 sm:h-9 sm:w-9", width: 36, height: 36 },
  md: { className: "h-10 w-10 sm:h-11 sm:w-11", width: 44, height: 44 },
  lg: { className: "h-14 w-14 sm:h-16 sm:w-16 md:h-[4.5rem] md:w-[4.5rem]", width: 72, height: 72 },
} as const;

export function Logo({ size = "md", className = "" }: { size?: LogoSize; className?: string }) {
  const { className: sizeClass, width, height } = sizeMap[size];
  return (
    <Image
      src="/pig.png"
      alt="Lumyf"
      width={width}
      height={height}
      className={`object-contain ${sizeClass} ${className}`}
      sizes="(max-width: 640px) 36px, (max-width: 768px) 44px, 72px"
      priority
    />
  );
}
