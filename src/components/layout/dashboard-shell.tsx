"use client";

import { Suspense, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { useTour } from "@reactour/tour";
import type { Workspace } from "@/types/database";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { useBrowserLocationRequest } from "@/components/onboarding/location-consent-modal";
import { GuidedTourProvider, TOUR_WILL_OPEN_EVENT } from "@/components/onboarding/guided-tour";
import { CommandPalette } from "@/components/command-palette";
import { BetaDecisionModal } from "@/components/beta/beta-decision-modal";
import { BetaUpgradeModal } from "@/components/beta/beta-upgrade-modal";
import { VisitorProvider } from "@/components/visitor/visitor-context";
import { VisitorReminder } from "@/components/visitor/visitor-reminder";
import { ToastProvider, useToast } from "@/components/ui/toast-provider";
import { CheckoutSuccessRefresher } from "@/components/checkout-success-refresher";

/** Rotas em que a mensagem "assine o plano Pro" deve aparecer (e rolar até ela) quando não há plano ativo. */
const PATHS_REQUIRING_PLAN = [
  "/dashboard/investments",
  "/dashboard/cobrancas",
  "/dashboard/goals",
  "/dashboard/budgets",
  "/dashboard/recurring",
  "/dashboard/reports",
  "/dashboard/workspace",
];

type DashboardShellProps = {
  workspace: Workspace | null;
  workspaces: Workspace[];
  isBetaAdmin?: boolean;
  isVisitor?: boolean;
  isViewer?: boolean;
  hasActivePlan?: boolean;
  isInActiveBeta?: boolean;
  needsBetaDecision?: boolean;
  betaDecisionWorkspaceId?: string | null;
  betaDecisionStatus?: string;
  showBetaUpgradeModal?: boolean;
  children: React.ReactNode;
};

/** Sincroniza abertura/fechamento do sidebar mobile com o passo do tour. Precisa estar DENTRO do GuidedTourProvider para useTour() ter o contexto correto. */
function TourSidebarSync({
  isMobileViewport,
  setMobileMenuOpen,
}: {
  isMobileViewport: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}) {
  const { currentStep = 0, isOpen: isTourOpen } = useTour();

  useEffect(() => {
    if (!isMobileViewport) return;
    if (!isTourOpen) {
      setMobileMenuOpen(false);
      return;
    }
    const STEPS_REQUIRE_SIDEBAR_CLOSED = [7, 8]; // Workspace (header), Visão geral (conteúdo)
    if (STEPS_REQUIRE_SIDEBAR_CLOSED.includes(currentStep)) {
      setMobileMenuOpen(false);
      return;
    }
    if (currentStep >= 0 && currentStep < 7) {
      setMobileMenuOpen(true);
    } else {
      setMobileMenuOpen(false);
    }
  }, [isMobileViewport, isTourOpen, currentStep, setMobileMenuOpen]);

  return null;
}

export function DashboardShell(props: DashboardShellProps) {
  return (
    <ToastProvider>
      <DashboardShellContent {...props} />
    </ToastProvider>
  );
}

function DashboardShellContent({
  workspace,
  workspaces,
  isBetaAdmin = false,
  isVisitor = false,
  isViewer = false,
  hasActivePlan = true,
  isInActiveBeta = false,
  needsBetaDecision = false,
  betaDecisionWorkspaceId,
  betaDecisionStatus = "feedback_pending",
  showBetaUpgradeModal = false,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const pathRequiresPlan = PATHS_REQUIRING_PLAN.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const showPlanReminderOnPath = !hasActivePlan && pathRequiresPlan && !isInActiveBeta;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const { toast } = useToast();
  const t = useTranslations("billing");
  const viewerBlockedMessage =
    "Opa, para utilizar funções você precisa ser um editor, no momento seu convite é de visualizador.";
  useBrowserLocationRequest();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 767px)");
    const handler = () => setIsMobileViewport(mql.matches);
    handler();
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Abrir o sidebar assim que o tour for iniciado (para o primeiro passo mostrar o menu já aberto)
  useEffect(() => {
    const openSidebarForTour = () => setMobileMenuOpen(true);
    window.addEventListener(TOUR_WILL_OPEN_EVENT, openSidebarForTour);
    return () => window.removeEventListener(TOUR_WILL_OPEN_EVENT, openSidebarForTour);
  }, []);

  return (
    <GuidedTourProvider>
      <TourSidebarSync
        isMobileViewport={isMobileViewport}
        setMobileMenuOpen={setMobileMenuOpen}
      />
      <div className="flex h-screen max-h-[100dvh] overflow-hidden bg-background text-foreground">
        <Suspense fallback={null}>
          <CheckoutSuccessRefresher />
        </Suspense>
        {needsBetaDecision && betaDecisionWorkspaceId && (
          <BetaDecisionModal
            workspaceId={betaDecisionWorkspaceId}
            currentStatus={betaDecisionStatus}
          />
        )}
        {!needsBetaDecision && showBetaUpgradeModal && betaDecisionWorkspaceId && (
          <BetaUpgradeModal workspaceId={betaDecisionWorkspaceId} />
        )}
        <CommandPalette />
        <Sidebar
          isBetaAdmin={isBetaAdmin}
          isVisitor={isVisitor}
          hasActivePlan={hasActivePlan}
          isInActiveBeta={isInActiveBeta}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          mobileOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-background">
          <Header
            workspace={workspace}
            workspaces={workspaces}
            onMenuClick={() => setMobileMenuOpen(true)}
            sidebarCollapsed={sidebarCollapsed}
            onSidebarToggle={() => setSidebarCollapsed((v) => !v)}
          />
          <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:px-6 lg:py-6 relative">
            <VisitorProvider
              isVisitor={isVisitor ?? false}
              isViewer={isViewer}
              hasActivePlan={hasActivePlan}
              isInActiveBeta={isInActiveBeta}
              showPlanReminderOnPath={showPlanReminderOnPath}
              onRequireProBlocked={(reason) =>
                toast(reason === "viewer" ? viewerBlockedMessage : t("proRequiredToast"), "error")
              }
            >
              <div className="max-w-7xl mx-auto w-full">
                <VisitorReminder />
                {children}
              </div>
            </VisitorProvider>
          </main>
        </div>
      </div>
    </GuidedTourProvider>
  );
}
