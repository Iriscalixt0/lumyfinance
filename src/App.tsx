import { Routes, Route } from "react-router-dom";
import { LandingPage } from "@/components/landing/LandingPage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { OnboardingPage } from "@/pages/OnboardingPage";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { TransactionsPage } from "@/pages/TransactionsPage";
import { GoalsPage } from "@/pages/GoalsPage";
import { InvestmentsPage } from "@/pages/InvestmentsPage";
import { BillingsPage } from "@/pages/BillingsPage";
import { BudgetsPage } from "@/pages/BudgetsPage";
import { RecurringPage } from "@/pages/RecurringPage";
import { AnnualReportPage } from "@/pages/AnnualReportPage";
import { PlanPage } from "@/pages/PlanPage";
import { WorkspacePage } from "@/pages/WorkspacePage";
import { SupportPage } from "@/pages/SupportPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { CalculatorsPage } from "@/pages/CalculatorsPage";
import { ProjectionPage } from "@/pages/ProjectionPage";
import { LumyPage } from "@/pages/LumyPage";
import { CryptoPage } from "@/pages/CryptoPage";
import { TravelModePage } from "@/pages/TravelModePage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Onboarding (protected but no layout) */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />

      {/* Protected app routes */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/investments" element={<InvestmentsPage />} />
        <Route path="/billings" element={<BillingsPage />} />
        <Route path="/budgets" element={<BudgetsPage />} />
        <Route path="/recurring" element={<RecurringPage />} />
        <Route path="/annual-report" element={<AnnualReportPage />} />
        <Route path="/calculators" element={<CalculatorsPage />} />
        <Route path="/projection" element={<ProjectionPage />} />
        <Route path="/lumy" element={<LumyPage />} />
        <Route path="/crypto" element={<CryptoPage />} />
        <Route path="/travel" element={<TravelModePage />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<LandingPage />} />
    </Routes>
  );
}

export default App;
