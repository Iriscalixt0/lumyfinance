import { useState, useRef, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { VoiceFAB } from "@/components/voice/VoiceFAB";
import { BottomNav } from "@/components/layout/BottomNav";
import { useIntlFormat } from "@/hooks/useIntlFormat";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useNotifications, getNotifCategory } from "@/hooks/useNotifications";
import { useTranslations } from "@/lib/i18n";
import { Logo } from "@/components/logo";
import { useTheme } from "@/components/theme-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import {
  LayoutDashboard,
  ArrowLeftRight,
  TrendingUp,
  Receipt,
  Target,
  Wallet2,
  Repeat,
  FileBarChart,
  CreditCard,
  Users,
  MessageCircle,
  Settings,
  Moon,
  Sun,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronDown,
  Check,
  Plus,
  Info,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Trash2,
  Calculator,
  LineChart,
  Bot,
  Bitcoin,
  Plane,
} from "lucide-react";

interface NavItem {
  labelKey: string;
  href: string;
  icon: typeof LayoutDashboard;
}

// 🔵 Main nav — only 3 core items
const MAIN_ITEMS: NavItem[] = [
  { labelKey: "overview", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "transactions", href: "/transactions", icon: ArrowLeftRight },
  { labelKey: "budgets", href: "/budgets", icon: Wallet2 },
  { labelKey: "goals", href: "/goals", icon: Target },
  { labelKey: "investments", href: "/investments", icon: TrendingUp },
  { labelKey: "recurring", href: "/recurring", icon: Repeat },
  { labelKey: "lumy", href: "/lumy", icon: Bot },
];

// 🧰 Mais Ferramentas (collapsed by default)
const MORE_TOOLS_ITEMS: NavItem[] = [
  { labelKey: "cobrancas", href: "/billings", icon: Receipt },
  { labelKey: "reports", href: "/annual-report", icon: FileBarChart },
  { labelKey: "projection", href: "/projection", icon: LineChart },
  { labelKey: "crypto", href: "/crypto", icon: Bitcoin },
  { labelKey: "calculators", href: "/calculators", icon: Calculator },
  { labelKey: "travelMode", href: "/travel", icon: Plane },
];

// ⚙️ Sistema
const SYSTEM_ITEMS: NavItem[] = [
  { labelKey: "plan", href: "/plan", icon: CreditCard },
  { labelKey: "workspace", href: "/workspace", icon: Users },
  { labelKey: "support", href: "/support", icon: MessageCircle },
  { labelKey: "settings", href: "/settings", icon: Settings },
];

interface SidebarGroupProps {
  label: string;
  items: NavItem[];
  t: (key: string) => string;
  isActive: (href: string) => boolean;
  onNavigate: () => void;
  defaultOpen?: boolean;
}

function CollapsibleGroup({ label, items, t, isActive, onNavigate, defaultOpen = false }: SidebarGroupProps) {
  const hasActive = items.some((item) => isActive(item.href));
  const [open, setOpen] = useState(hasActive || defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>{label}</span>
        <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`} />
      </button>
      <div className={`space-y-0.5 mt-0.5 overflow-hidden transition-all duration-200 ${open ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
        {items.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            onClick={onNavigate}
            title={t(item.labelKey)}
            className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
              isActive(item.href)
                ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/80 hover:translate-x-0.5 hover:shadow-sm"
            }`}
          >
            <item.icon className={`h-[18px] w-[18px] shrink-0 transition-all duration-200 ${
              isActive(item.href) ? "text-primary scale-110" : "group-hover:text-foreground group-hover:scale-105"
            }`} />
            <span className="truncate">{t(item.labelKey)}</span>
            {isActive(item.href) && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AppLayout() {
  const fmt = useIntlFormat();
  const t = useTranslations("nav");
  const { user, signOut } = useAuth();
  const { workspaces, activeWorkspace, switchWorkspace } = useWorkspace();
  const { notifications, unreadCount, markAsRead, markAllAsRead, dismiss } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [wsSelectorOpen, setWsSelectorOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const wsSelectorRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Ctrl+K / Cmd+K shortcut to open Lumy
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        navigate("/lumy");
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wsSelectorRef.current && !wsSelectorRef.current.contains(e.target as Node)) {
        setWsSelectorOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (wsSelectorOpen || notifOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [wsSelectorOpen, notifOpen]);

  const isActive = (href: string) => location.pathname === href;
  const closeSidebar = () => setSidebarOpen(false);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Logo size="sm" />
        <span className="text-lg font-bold text-gradient-hero">Lumyf</span>
      </div>

      {/* Nav sections */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1">
        {/* Main 3 items — always visible */}
        <div className="space-y-0.5">
          {MAIN_ITEMS.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={closeSidebar}
              title={t(item.labelKey)}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive(item.href)
                  ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/80 hover:translate-x-0.5 hover:shadow-sm"
              }`}
            >
              <item.icon className={`h-[18px] w-[18px] shrink-0 transition-all duration-200 ${
                isActive(item.href) ? "text-primary scale-110" : "group-hover:text-foreground group-hover:scale-105"
              }`} />
              <span className="truncate">{t(item.labelKey)}</span>
              {isActive(item.href) && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
              )}
            </Link>
          ))}
        </div>

        {/* CTA — Nova Transação */}
        <div className="px-1 pt-2">
          <Link
            to="/transactions?new=1"
            onClick={closeSidebar}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-md hover:shadow-lg hover:brightness-110 active:scale-[0.97] transition-all duration-200 w-full"
          >
            <Plus className="h-4 w-4" />
            {t("newTransaction")}
          </Link>
        </div>

        {/* 🧰 Mais Ferramentas */}
        <CollapsibleGroup
          label={t("moreTools")}
          items={MORE_TOOLS_ITEMS}
          t={t}
          isActive={isActive}
          onNavigate={closeSidebar}
        />

        {/* ⚙️ Sistema */}
        <CollapsibleGroup
          label={t("system")}
          items={SYSTEM_ITEMS}
          t={t}
          isActive={isActive}
          onNavigate={closeSidebar}
        />
      </div>

      {/* Bottom actions — only sign out (theme toggle moved to header only) */}
      <div className="px-3 py-3 border-t border-border space-y-0.5">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors w-full"
        >
          <LogOut className="h-5 w-5" />
          {t("signOut")}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 lg:w-64 flex-col border-r border-border bg-card fixed inset-y-0 left-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={closeSidebar} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-card flex flex-col shadow-xl">
            <button
              onClick={closeSidebar}
              className="absolute right-3 top-4 text-muted-foreground hover:text-foreground"
              aria-label={t("closeMenu")}
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 md:ml-60 lg:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-card/90 backdrop-blur-xl border-b border-border px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-secondary transition-colors"
              aria-label="Menu"
            >
              <Menu className="h-5 w-5 text-muted-foreground" />
            </button>

            {/* Mobile logo + user avatar */}
            <div className="md:hidden flex items-center gap-1.5">
              <Logo size="sm" />
              <span className="text-base font-bold text-foreground">Lumyf</span>
            </div>
            {user && (
              <div className="md:hidden flex items-center">
                <div className="h-7 w-7 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center ring-1 ring-primary/20">
                  {(user.user_metadata?.full_name || user.email || "U").charAt(0).toUpperCase()}
                </div>
              </div>
            )}

            {/* Workspace selector */}
            <div className="relative hidden sm:block" ref={wsSelectorRef}>
              <button
                onClick={() => setWsSelectorOpen((v) => !v)}
                className="flex items-center gap-2 text-sm font-semibold text-foreground hover:bg-secondary px-3 py-1.5 rounded-lg transition-colors"
              >
                <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                <span className="max-w-[160px] truncate">{activeWorkspace?.name || "Workspace"}</span>
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${wsSelectorOpen ? "rotate-180" : ""}`} />
              </button>

              {wsSelectorOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-card border border-border rounded-xl shadow-card-hover py-1 z-50 animate-fade">
                  <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {t("workspace")}
                  </p>
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => { switchWorkspace(ws); setWsSelectorOpen(false); }}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-secondary transition-colors text-left"
                    >
                      <span className="font-medium text-foreground truncate">{ws.name}</span>
                      {ws.id === activeWorkspace?.id && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                    </button>
                  ))}
                  <div className="border-t border-border mt-1 pt-1">
                    <Link
                      to="/workspace"
                      onClick={() => setWsSelectorOpen(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" /> {t("workspace")}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
              >
                <Bell className="h-[18px] w-[18px]" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute top-full right-0 mt-1 w-80 sm:w-96 bg-card border border-border rounded-xl shadow-card-hover z-50 animate-fade overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <h3 className="text-sm font-bold text-foreground">Notifications</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-primary font-medium hover:underline"
                      >
                        ✓
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center">
                        <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                        <p className="text-sm text-muted-foreground">—</p>
                      </div>
                    ) : (
                      notifications.map((n) => {
                        const IconMap: Record<string, typeof Info> = { info: Info, warning: AlertTriangle, success: CheckCircle2, error: XCircle };
                        const colorMap: Record<string, string> = { info: "text-blue-500", warning: "text-amber-500", success: "text-emerald-500", error: "text-rose-500" };
                        const cat = getNotifCategory(n.type);
                        const NIcon = IconMap[cat] || Info;
                        const isUnread = !n.read_at;
                        return (
                          <div
                            key={n.id}
                            onClick={() => { if (isUnread) markAsRead(n.id); }}
                            className={`px-4 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-secondary/50 transition-colors flex gap-3 group/notif ${
                              isUnread ? "bg-primary/5" : ""
                            }`}
                          >
                            <NIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${colorMap[cat] || "text-muted-foreground"}`} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${isUnread ? "font-semibold text-foreground" : "text-foreground"}`}>
                                {n.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {fmt.dateTime(n.created_at)}
                              </p>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                              className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 opacity-0 group-hover/notif:opacity-100"
                              aria-label="Remove"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
              aria-label={theme === "dark" ? t("lightMode") : t("darkMode")}
              title={theme === "dark" ? t("lightMode") : t("darkMode")}
            >
              {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>

            {/* Locale */}
            <LocaleSwitcher />
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 pb-20 md:pb-8 max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Bottom navigation — mobile only */}
      <BottomNav />

      {/* Voice FAB — always-on voice input */}
      <VoiceFAB />
    </div>
  );
}
