import { Routes, Route } from "react-router-dom";
import { LandingPage } from "@/components/landing/LandingPage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
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

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

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
      </Route>

      <Route path="*" element={<LandingPage />} />
    </Routes>
  );
}

export default App;
