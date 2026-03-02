"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/components/theme-provider";
import { Logo } from "@/components/logo";
import {
  X,
  LayoutDashboard,
  ArrowLeftRight,
  Receipt,
  FileText,
  TrendingUp,
  Target,
  Briefcase,
  Settings,
  LogOut,
  Moon,
  Sun,
  PiggyBank,
  Repeat,
  FlaskConical,
  Sparkles,
  Loader2,
  CreditCard,
  MessageCircle,
  Download,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createCheckoutForVisitorUpgrade } from "@/actions/billing";
import { useInstallPrompt } from "@/components/install-prompt-provider";

const menuStructure = [
  {
    groupKey: "main",
    items: [
      { href: "/dashboard", labelKey: "overview", icon: LayoutDashboard, dataTour: "nav-overview" },
      { href: "/dashboard/transactions", labelKey: "transactions", icon: ArrowLeftRight, dataTour: "nav-transactions" },
      { href: "/dashboard/investments", labelKey: "investments", icon: TrendingUp, dataTour: "nav-investments" },
      { href: "/dashboard/cobrancas", labelKey: "cobrancas", icon: Receipt, dataTour: "nav-cobrancas" },
      { href: "/dashboard/goals", labelKey: "goals", icon: Target, dataTour: "nav-goals" },
      { href: "/dashboard/budgets", labelKey: "budgets", icon: PiggyBank, dataTour: "nav-budgets" },
      { href: "/dashboard/recurring", labelKey: "recurring", icon: Repeat, dataTour: "nav-recurring" },
      { href: "/dashboard/reports", labelKey: "reports", icon: FileText, dataTour: "nav-reports" },
    ],
  },
  {
    groupKey: "system",
    items: [
      { href: "/dashboard/plan", labelKey: "plan", icon: CreditCard, dataTour: "nav-plan" },
      { href: "/dashboard/workspace", labelKey: "workspace", icon: Briefcase, dataTour: "nav-workspace" },
      { href: "/dashboard/support", labelKey: "support", icon: MessageCircle, dataTour: "nav-support" },
      { href: "/dashboard/settings", labelKey: "settings", icon: Settings, dataTour: "nav-settings" },
    ],
  },
  {
    groupKey: "betaAdmin",
    items: [
      { href: "/admin/beta", labelKey: "betaPrograms", icon: FlaskConical, dataTour: "nav-beta-programs" },
    ],
  },
] as const;

export function Sidebar({
  collapsed = false,
  mobileOpen = false,
  onClose,
  isBetaAdmin = false,
  isVisitor = false,
  hasActivePlan = true,
  isInActiveBeta = false,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onClose?: () => void;
  isBetaAdmin?: boolean;
  isVisitor?: boolean;
  hasActivePlan?: boolean;
  isInActiveBeta?: boolean;
}) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tBilling = useTranslations("billing");
  const locale = useLocale();
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const { triggerInstall } = useInstallPrompt();

  // Fecha o menu ao navegar (pathname muda)
  const prevPathname = useRef(pathname);
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      if (mobileOpen && onClose) onClose();
    }
  }, [pathname, mobileOpen, onClose]);

  async function handleDownloadApp(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    if (onClose) onClose();
    await triggerInstall();
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  async function handleSubscribePro() {
    setSubscribeLoading(true);
    const result = await createCheckoutForVisitorUpgrade(locale);
    setSubscribeLoading(false);
    if (result.ok) {
      if (result.workspaceId) {
        document.cookie = `workspace_id=${result.workspaceId}; path=/; max-age=31536000; SameSite=Lax`;
      }
      window.location.href = result.checkoutUrl;
    } else {
      console.error(result.error);
    }
  }

  const renderNavContent = (tourScope: "desktop" | "mobile") => (
    <>
      {/* Logo / Branding */}
      <div className={`flex items-center shrink-0 gap-2 ${collapsed ? "justify-center w-full px-0 py-4" : "justify-between p-6 sm:p-8"}`}>
        <Link
          href="/dashboard"
          prefetch={true}
          className={`flex items-center text-primary font-bold tracking-tight ${collapsed ? "w-12 h-12 min-w-12 min-h-12 shrink-0 items-center justify-center rounded-xl -translate-x-2" : "gap-3 text-2xl"}`}
        >
          <div className={`bg-primary/10 rounded-xl flex items-center justify-center shadow-sm shrink-0 overflow-hidden ${collapsed ? "w-8 h-8" : "w-9 h-9 sm:w-10 sm:h-10"}`}>
            <Logo size="md" className={collapsed ? "w-6 h-6" : "w-8 h-8 sm:w-9 sm:h-9"} />
          </div>
          {!collapsed && <span className="text-gradient-hero whitespace-nowrap">{tCommon("brand")}</span>}
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary transition-colors shrink-0"
            aria-label={t("closeMenu")}
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navegação Principal (grupos) - scroll interno quando muitos itens */}
      <nav
        className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col ${collapsed ? "items-center w-full px-0" : "px-4"}`}
        data-tour={`sidebar-${tourScope}`}
      >
        {menuStructure.map((group, idx) => {
          if (group.groupKey === "betaAdmin" && !isBetaAdmin) return null;
          const items = group.items;
          return (
          <div key={idx} className="mb-8">
            {!collapsed && (
              <h3 className="px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-3">
                {t(group.groupKey)}
              </h3>
            )}
            <div className={`space-y-1 ${collapsed ? "w-full flex flex-col items-center" : ""}`}>
              {items.map((item) => {
                // Ocultar "Plano" apenas em workspaces beta (entrada por convite); usuários normais inalterados
                if (isInActiveBeta && item.href === "/dashboard/plan") return null;
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    data-tour={`${item.dataTour}-${tourScope}`}
                    className={`flex items-center rounded-xl transition-all group relative ${collapsed ? "w-12 min-w-12 h-12 min-h-12 justify-center" : "w-full gap-3 px-4 py-3"} ${isActive
                      ? "bg-primary/10 text-primary font-bold"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    title={t(item.labelKey)}
                  >
                    <span className="shrink-0 flex items-center justify-center w-5 h-5">
                      <Icon
                        size={20}
                        className={
                          isActive
                            ? "text-primary"
                            : "text-muted-foreground group-hover:text-foreground transition-colors"
                        }
                      />
                    </span>
                    {!collapsed && <span className="text-sm truncate">{t(item.labelKey)}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
          );
        })}
      </nav>

      {/* Rodapé: em beta por convite mostramos "Plano ativo (Beta)"; caso contrário, Assinar Pro / link Plano para quem não tem plano */}
      <div className={`mt-auto border-t border-border shrink-0 ${collapsed ? "flex flex-col items-center w-full gap-1 px-0 py-2" : "space-y-1 p-4"}`}>
        {isInActiveBeta && (
          <div
            className={`flex items-center rounded-xl border border-primary/25 bg-primary/10 text-primary ${collapsed ? "w-12 min-w-12 h-12 min-h-12 justify-center shrink-0 -translate-x-2" : "w-full gap-3 px-4 py-3 justify-center"}`}
            title={`${tBilling("activePlan")} (Beta)`}
          >
            <Sparkles size={18} className="shrink-0" />
            {!collapsed && <span className="text-sm font-medium truncate">{tBilling("activePlan")} (Beta)</span>}
          </div>
        )}
        {/* Botão Assinar Pro / link Plano: apenas para quem não está em beta por convite */}
        {!hasActivePlan && !isInActiveBeta && (
          isVisitor ? (
            <button
              type="button"
              onClick={handleSubscribePro}
              disabled={subscribeLoading}
              className={`flex items-center rounded-xl font-medium bg-hero-gradient text-primary-foreground hover:opacity-90 transition-all group ${collapsed ? "w-12 min-w-12 h-12 min-h-12 justify-center shrink-0 -translate-x-2" : "w-full gap-3 px-4 py-3 justify-center"}`}
            >
              {subscribeLoading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <Sparkles size={20} className="shrink-0" />
                  {!collapsed && <span className="text-sm truncate">{tBilling("startPro")}</span>}
                </>
              )}
            </button>
          ) : (
            <Link
              href="/dashboard/plan"
              className={`flex items-center rounded-xl font-medium bg-hero-gradient text-primary-foreground hover:opacity-90 transition-all group ${collapsed ? "w-12 min-w-12 h-12 min-h-12 justify-center shrink-0 -translate-x-2" : "w-full gap-3 px-4 py-3 justify-center"}`}
            >
              <Sparkles size={20} className="shrink-0" />
              {!collapsed && <span className="text-sm truncate">{tBilling("startPro")}</span>}
            </Link>
          )
        )}
        <button
          type="button"
          onClick={(e) => handleDownloadApp(e)}
          className={`flex items-center rounded-xl border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-all font-medium ${collapsed ? "w-12 min-w-12 h-12 min-h-12 justify-center shrink-0 -translate-x-2" : "w-full gap-3 px-4 py-3"}`}
          title={t("downloadApp")}
        >
          <Download size={20} className="shrink-0" />
          {!collapsed && <span className="text-sm truncate">{t("downloadApp")}</span>}
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          className={`flex items-center rounded-xl text-muted-foreground hover:bg-secondary transition-all group ${collapsed ? "w-12 min-w-12 h-12 min-h-12 justify-center items-center shrink-0 -translate-x-2" : "w-full gap-3 px-4 py-3"}`}
          title={theme === "dark" ? t("lightMode") : t("darkMode")}
        >
          {collapsed ? (
            <span className="w-5 h-5 shrink-0 flex items-center justify-center">
              {theme === "dark" ? (
                <Sun size={20} className="text-amber-500" />
              ) : (
                <Moon size={20} />
              )}
            </span>
          ) : (
            <>
              <span className="w-5 h-5 shrink-0 flex items-center justify-center">
                {theme === "dark" ? (
                  <Sun size={20} className="text-amber-500" />
                ) : (
                  <Moon size={20} className="text-muted-foreground" />
                )}
              </span>
              <span className="text-sm truncate">
                {theme === "dark" ? t("lightMode") : t("darkMode")}
              </span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handleSignOut}
          className={`flex items-center rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all group ${collapsed ? "w-12 min-w-12 h-12 min-h-12 justify-center items-center shrink-0 -translate-x-2" : "w-full gap-3 px-4 py-3"}`}
          title={t("signOut")}
        >
          <span className="shrink-0 flex items-center justify-center w-5 h-5">
            <LogOut size={20} className="group-hover:translate-x-0.5 transition-transform" />
          </span>
          {!collapsed && <span className="text-sm truncate">{t("signOut")}</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop/Tablet: sidebar fixa (md+) - altura da viewport, scroll interno no nav */}
      <aside
        className={`hidden md:flex print:hidden h-screen max-h-[100dvh] bg-card border-r border-border flex-col min-h-0 transition-all duration-200 shrink-0 ${collapsed ? "w-20" : "w-64"}`}
      >
        {renderNavContent("desktop")}
      </aside>

      {/* Mobile: overlay */}
      {onClose && (
        <div
          role="button"
          tabIndex={-1}
          aria-hidden={!mobileOpen}
          onClick={onClose}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
          className={`md:hidden print:hidden fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 ${mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
        />
      )}

      {/* Mobile: sheet (painel deslizante) */}
      <aside
        aria-hidden={!mobileOpen}
        className={`md:hidden print:hidden fixed top-0 left-0 z-50 w-72 max-w-[85vw] h-full bg-card border-r border-border flex flex-col shadow-xl transition-transform duration-200 ease-out ${mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        {renderNavContent("mobile")}
      </aside>

    </>
  );
}
