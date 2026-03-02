"use client";

import {
  Wallet,
  Briefcase,
  Gift,
  Inbox,
  ShoppingCart,
  Home,
  Car,
  HeartPulse,
  Gamepad2,
  ShoppingBag,
  Package,
  type LucideIcon,
} from "lucide-react";

const LUCIDE_ICON_MAP: Record<string, LucideIcon> = {
  wallet: Wallet,
  money: Wallet,
  briefcase: Briefcase,
  gift: Gift,
  inbox: Inbox,
  "shopping-cart": ShoppingCart,
  shoppingcart: ShoppingCart,
  home: Home,
  car: Car,
  "heart-pulse": HeartPulse,
  heartpulse: HeartPulse,
  "gamepad-2": Gamepad2,
  gamepad2: Gamepad2,
  "shopping-bag": ShoppingBag,
  shoppingbag: ShoppingBag,
  box: Package,
  package: Package,
};

function getLucideIcon(icon: string): LucideIcon | null {
  const key = icon.trim().toLowerCase().replace(/\s+/g, "-");
  return LUCIDE_ICON_MAP[key] ?? null;
}

export function CategoryIcon({
  icon,
  color,
  className = "w-5 h-5 shrink-0",
}: {
  icon: string;
  color?: string;
  className?: string;
}) {
  const LucideComponent = getLucideIcon(icon);
  if (LucideComponent) {
    return (
      <LucideComponent
        className={className}
        style={color ? { color } : undefined}
        aria-hidden
      />
    );
  }
  return <span className={`inline-flex items-center justify-center ${className}`} aria-hidden>{icon}</span>;
}
