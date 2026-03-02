"use client";

import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-6 text-center rounded-2xl bg-secondary/30 border border-dashed border-border ${className}`}
      role="status"
      aria-label={`${title}. ${description}`}
    >
      <div
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"
        aria-hidden
      >
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-base font-bold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-4">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
