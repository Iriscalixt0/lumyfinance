"use client";

import {
  Sun,
  PartyPopper,
  Leaf,
  CloudSun,
  Sprout,
  Flame,
  Snowflake,
  Wind,
  Flower,
  Ghost,
  
  CloudRain,
  TreePine,
  type LucideIcon,
} from "lucide-react";
import { MONTH_ICON_NAMES } from "@/lib/utils/dates";

const iconMap: Record<(typeof MONTH_ICON_NAMES)[number], LucideIcon> = {
  Sun,
  Mask: PartyPopper,
  Leaf,
  CloudSun,
  Sprout,
  Flame,
  Snowflake,
  Wind,
  Flower2: Flower,
  Ghost,
  CloudRain,
  TreePine,
};

interface MonthIconProps {
  monthIndex: number;
  className?: string;
}

export function MonthIcon({ monthIndex, className = "w-8 h-8" }: MonthIconProps) {
  const iconName = MONTH_ICON_NAMES[monthIndex];
  const IconComponent = iconMap[iconName];

  if (!IconComponent) {
    return null;
  }

  return <IconComponent className={className} />;
}
