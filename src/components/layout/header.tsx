"use client";

import { useState, useRef, useEffect, useMemo, useTransition } from "react";
import type { Workspace } from "@/types/database";
import { Menu, Moon, Sun, ChevronDown, PanelLeftClose, PanelLeftOpen, Loader2 } from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useTheme } from "@/components/theme-provider";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/locale-switcher";

export function Header({
  workspace,
  workspaces,
  onMenuClick,
  sidebarCollapsed = false,
  onSidebarToggle,
}: {
  workspace: Workspace | null;
  workspaces: Workspace[];
  onMenuClick?: () => void;
  sidebarCollapsed?: boolean;
  onSidebarToggle?: () => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const t = useTranslations("header");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [optimisticWorkspaceId, setOptimisticWorkspaceId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const displayedWorkspace = useMemo(() => {
    if (!optimisticWorkspaceId) return workspace;
    return workspaces.find((w) => w.id === optimisticWorkspaceId) ?? workspace;
  }, [optimisticWorkspaceId, workspace, workspaces]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function setWorkspace(workspaceId: string) {
    const previousWorkspaceId = workspace?.id ?? null;
    setOpen(false);
    setOptimisticWorkspaceId(workspaceId);
    const response = await fetch("/api/set-workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: workspaceId }),
    });
    if (!response.ok) {
      console.error("Falha ao trocar workspace", await response.text());
      setOptimisticWorkspaceId(previousWorkspaceId);
      return;
    }
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <header className="sticky top-0 z-20 h-14 md:h-20 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between px-3 sm:px-6 gap-2 print:hidden">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-foreground hover:bg-secondary transition-colors shrink-0"
            aria-label={t("openMenu")}
          >
            <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        )}
        {onSidebarToggle && (
          <button
            type="button"
            onClick={onSidebarToggle}
            className="hidden md:flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-foreground hover:bg-secondary transition-colors shrink-0"
            aria-label={sidebarCollapsed ? t("expandSidebar") : t("collapseSidebar")}
            aria-expanded={!sidebarCollapsed}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
        )}
        <div className="relative min-w-0" ref={ref} data-tour="header-workspace">
          <button
            type="button"
            onClick={() => workspaces.length > 1 && setOpen((o) => !o)}
            className={`flex items-center gap-2 min-h-[44px] px-3 py-2 rounded-xl text-left transition-colors w-full ${
              workspaces.length > 1
                ? "hover:bg-secondary cursor-pointer"
                : "cursor-default"
            }`}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label={t("currentWorkspace")}
          >
            {isPending && (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
            )}
            <span className="font-bold text-foreground truncate text-sm sm:text-base">
              {displayedWorkspace?.name ?? tCommon("loading")}
            </span>
            {workspaces.length > 1 && !isPending && (
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                  open ? "rotate-180" : ""
                }`}
              />
            )}
          </button>
          {open && workspaces.length > 1 && (
            <div
              role="listbox"
              className="absolute top-full left-0 mt-1 min-w-[200px] max-w-[280px] py-2 bg-card border border-border rounded-xl shadow-lg z-30"
            >
              {workspaces.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  role="option"
                  aria-selected={(optimisticWorkspaceId ?? workspace?.id) === w.id}
                  onClick={() => setWorkspace(w.id)}
                  disabled={isPending}
                  className={`w-full px-4 py-3 text-left text-sm font-medium transition-colors flex items-center justify-between ${
                    (optimisticWorkspaceId ?? workspace?.id) === w.id
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-secondary"
                  }`}
                >
                  <span className="truncate">{w.name}</span>
                  <span className="text-xs text-muted-foreground ml-2 shrink-0">
                    {w.plan}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-3 text-xs font-bold shrink-0">
        <NotificationBell />
        <LocaleSwitcher />
        <button
          type="button"
          onClick={toggleTheme}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-secondary text-muted-foreground hover:text-primary transition-colors"
          aria-label={t("toggleTheme")}
        >
          {theme === "dark" ? <Sun className="h-4 w-4 sm:h-5 sm:w-5" /> : <Moon className="h-4 w-4 sm:h-5 sm:w-5" />}
        </button>
      </div>
    </header>
  );
}
