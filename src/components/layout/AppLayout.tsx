import { useState, useRef, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useNotifications, getNotifCategory } from "@/hooks/useNotifications";
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
  Download,
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
} from "lucide-react";

const PRINCIPAL_ITEMS = [
  { label: "Visão geral", href: "/dashboard", icon: LayoutDashboard },
  { label: "Transações", href: "/transactions", icon: ArrowLeftRight },
  { label: "Investimentos", href: "/investments", icon: TrendingUp },
  { label: "Cobranças", href: "/billings", icon: Receipt },
  { label: "Metas", href: "/goals", icon: Target },
  { label: "Orçamentos", href: "/budgets", icon: Wallet2 },
  { label: "Recorrentes", href: "/recurring", icon: Repeat },
  { label: "Relatório anual", href: "/annual-report", icon: FileBarChart },
  { label: "Calculadoras", href: "/calculators", icon: Calculator },
  { label: "Projeção de saldo", href: "/projection", icon: LineChart },
  { label: "Lumy (Assistente)", href: "/lumy", icon: Bot },
];

const SISTEMA_ITEMS = [
  { label: "Plano", href: "/plan", icon: CreditCard },
  { label: "Workspace", href: "/workspace", icon: Users },
  { label: "Suporte", href: "/support", icon: MessageCircle },
  { label: "Configurações", href: "/settings", icon: Settings },
];

export function AppLayout() {
  const { user, signOut } = useAuth();
  const { workspaces, activeWorkspace, switchWorkspace } = useWorkspace();
  const { notifications, unreadCount, markAsRead, markAllAsRead, dismiss } = useNotifications();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [wsSelectorOpen, setWsSelectorOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const wsSelectorRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

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

  const NavLink = ({ item }: { item: typeof PRINCIPAL_ITEMS[0] }) => (
    <Link
      to={item.href}
      onClick={() => setSidebarOpen(false)}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        isActive(item.href)
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
      }`}
    >
      <item.icon className="h-5 w-5" />
      {item.label}
    </Link>
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Logo size="sm" />
        <span className="text-lg font-bold text-gradient-hero">Lumyf</span>
      </div>

      {/* Nav sections */}
      <div className="flex-1 overflow-y-auto px-3 space-y-5">
        {/* PRINCIPAL */}
        <div>
          <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Principal
          </p>
          <div className="space-y-0.5">
            {PRINCIPAL_ITEMS.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>
        </div>

        {/* SISTEMA */}
        <div>
          <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Sistema
          </p>
          <div className="space-y-0.5">
            {SISTEMA_ITEMS.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="px-3 py-3 border-t border-border space-y-0.5">
        <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors w-full">
          <Download className="h-5 w-5" />
          Baixar o app
        </button>
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors w-full"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
        </button>
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors w-full"
        >
          <LogOut className="h-5 w-5" />
          Sair da conta
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
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-card flex flex-col shadow-xl">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute right-3 top-4 text-muted-foreground hover:text-foreground"
              aria-label="Fechar menu"
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
        <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-lg border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-secondary transition-colors"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>

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
                    Seus workspaces
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
                      <Plus className="h-3.5 w-3.5" /> Gerenciar workspaces
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
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
                    <h3 className="text-sm font-bold text-foreground">Notificações</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-primary font-medium hover:underline"
                      >
                        Marcar todas como lidas
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center">
                        <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                        <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
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
                                {new Date(n.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                              className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 opacity-0 group-hover/notif:opacity-100"
                              aria-label="Remover"
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

            {/* Locale */}
            <LocaleSwitcher />

            {/* Dark mode toggle (desktop) */}
            <button
              onClick={toggleTheme}
              className="hidden sm:flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Alternar tema"
            >
              {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
