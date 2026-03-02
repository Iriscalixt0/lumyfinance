"use client";

import { useEffect, useMemo } from "react";
import { TourProvider, useTour, type StepType } from "@reactour/tour";
import { useTranslations } from "next-intl";

const TOUR_STORAGE_KEY = "nf_tour_pending";
const TOUR_OPEN_EVENT = "nf-tour-open";
/** Disparado antes de abrir o tour para o layout abrir o sidebar (mobile) primeiro. */
export const TOUR_WILL_OPEN_EVENT = "nf-tour-will-open";
const SIDEBAR_OPEN_DELAY_MS = 450;

function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

function GuidedTourController() {
  const { setIsOpen, setCurrentStep } = useTour();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const openTour = () => {
      setCurrentStep(0);
      setIsOpen(true);
    };

    const openTourAfterSidebar = () => {
      window.dispatchEvent(new CustomEvent(TOUR_WILL_OPEN_EVENT));
      setTimeout(openTour, SIDEBAR_OPEN_DELAY_MS);
    };

    const pending = sessionStorage.getItem(TOUR_STORAGE_KEY);
    if (pending === "1") {
      sessionStorage.removeItem(TOUR_STORAGE_KEY);
      setTimeout(openTourAfterSidebar, 250);
    }

    window.addEventListener(TOUR_OPEN_EVENT, openTourAfterSidebar);
    return () => window.removeEventListener(TOUR_OPEN_EVENT, openTourAfterSidebar);
  }, [setCurrentStep, setIsOpen]);

  return null;
}

export function GuidedTourProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("tour");
  const scope = isMobileViewport() ? "mobile" : "desktop";

  const baseSteps = useMemo<StepType[]>(
    () => [
      { selector: `[data-tour='sidebar-${scope}']`, content: `${t("sidebarTitle")} - ${t("sidebarDesc")}` },
      { selector: `[data-tour='nav-overview-${scope}']`, content: `${t("overviewTitle")} - ${t("overviewDesc")}` },
      { selector: `[data-tour='nav-transactions-${scope}']`, content: `${t("transactionsTitle")} - ${t("transactionsDesc")}` },
      { selector: `[data-tour='nav-investments-${scope}']`, content: `${t("investmentsTitle")} - ${t("investmentsDesc")}` },
      { selector: `[data-tour='nav-cobrancas-${scope}']`, content: `${t("cobrancasTitle")} - ${t("cobrancasDesc")}` },
      { selector: `[data-tour='nav-goals-${scope}']`, content: `${t("goalsTitle")} - ${t("goalsDesc")}` },
      { selector: `[data-tour='nav-budgets-${scope}']`, content: `${t("budgetsTitle")} - ${t("budgetsDesc")}` },
      { selector: "[data-tour='header-workspace']", content: `${t("navWorkspaceTitle")} - ${t("navWorkspaceDesc")}` },
      { selector: "[data-tour='dashboard-content']", content: `${t("overviewTitle")} - ${t("overviewDesc")}` },
    ],
    [scope, t]
  );

  const steps = useMemo<StepType[]>(() => baseSteps, [baseSteps]);

  return (
    <TourProvider
      steps={steps}
      styles={{
        popover: (base) => ({
          ...base,
          width: "min(92vw, 340px)",
          maxWidth: "340px",
          backgroundColor: "#fff",
          color: "#111827",
        }),
        close: (base, { disabled }) => ({
          ...base,
          color: disabled ? "#9ca3af" : "#374151",
          minWidth: 44,
          minHeight: 44,
          padding: 12,
          top: 12,
          right: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }),
      }}
    >
      <GuidedTourController />
      {children}
    </TourProvider>
  );
}

export function startGuidedTour() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TOUR_OPEN_EVENT));
  }
}

export function setTourPending() {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(TOUR_STORAGE_KEY, "1");
  }
}
