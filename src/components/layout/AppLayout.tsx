import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
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
];

const SISTEMA_ITEMS = [
  { label: "Plano", href: "/plan", icon: CreditCard },
  { label: "Workspace", href: "/workspace", icon: Users },
  { label: "Suporte", href: "/support", icon: MessageCircle },
  { label: "Configurações", href: "/settings", icon: Settings },
];

export function AppLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (href: string) => location.pathname === href;

  const NavLink = ({ item }: { item: typeof PRINCIPAL_ITEMS[0] }) => (
    <Link
      to={item.href}
      onClick={() => setSidebarOpen(false)}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
        isActive(item.href)
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
      }`}
    >
      <item.icon className="h-[18px] w-[18px]" />
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
        <button className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors w-full">
          <Download className="h-[18px] w-[18px]" />
          Baixar o app
        </button>
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors w-full"
        >
          {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
        </button>
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-destructive hover:bg-destructive/10 transition-colors w-full"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sair da conta
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 lg:w-60 flex-col border-r border-border bg-card fixed inset-y-0 left-0 z-30">
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
      <div className="flex-1 md:ml-56 lg:ml-60">
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
            <button className="hidden sm:flex items-center gap-2 text-sm font-semibold text-foreground hover:bg-secondary px-3 py-1.5 rounded-lg transition-colors">
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
              Minhas Finanças
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <button className="relative min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                2
              </span>
            </button>

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
