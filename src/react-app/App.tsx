import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router";
import { AuthProvider } from "@/react-app/context/AuthContext";
import { ThemeProvider } from "@/react-app/context/ThemeContext";
import { AwsOpsProvider } from "@/react-app/context/AwsOpsContext";
import { ToastProvider } from "@/react-app/context/ToastContext";
import HomePage from "@/react-app/pages/Home";
import FeaturesPage from "@/react-app/pages/Features";
import PricingPage from "@/react-app/pages/Pricing";
import LoginPage from "@/react-app/pages/Login";
import SignupPage from "@/react-app/pages/Signup";
import AuthCallbackPage from "@/react-app/pages/AuthCallback";
import CompanyPage from "@/react-app/pages/Company";
import LegalPage from "@/react-app/pages/Legal";
import ChangelogPage from "@/react-app/pages/Changelog";
import Docs from "./pages/docs";
import DashboardLayout from "@/react-app/components/dashboard/DashboardLayout";
import ProtectedRoute from "@/react-app/components/auth/ProtectedRoute";
import PlanAccessGate from "@/react-app/components/auth/PlanAccessGate";
import OverviewPage from "@/react-app/pages/app/Overview";
import InfrastructurePage from "@/react-app/pages/app/Infrastructure";
import MetricsPage from "@/react-app/pages/app/Metrics";
import AlertsPage from "@/react-app/pages/app/Alerts";
import AutoHealingPage from "@/react-app/pages/app/AutoHealing";
import AIInsightsPage from "@/react-app/pages/app/AIInsights";
import AppDocsPage from "@/react-app/pages/app/Docs";
import SettingsPage from "@/react-app/pages/app/Settings";
import IncidentHistoryPage from "@/react-app/pages/app/IncidentHistory";

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AwsOpsProvider>
          <AuthProvider>
            <Router>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/features" element={<FeaturesPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="/company" element={<CompanyPage />} />
                <Route path="/legal" element={<LegalPage />} />
                <Route path="/changelog" element={<ChangelogPage />} />
                <Route path="/docs" element={<Docs />} />
                <Route element={<ProtectedRoute />}>
                  <Route path="/app" element={<DashboardLayout />}>
                    <Route index element={<Navigate to="/app/overview" replace />} />
                    <Route path="overview" element={<OverviewPage />} />
                    <Route path="infrastructure" element={<InfrastructurePage />} />
                    <Route path="metrics" element={<MetricsPage />} />
                    <Route path="alerts" element={<AlertsPage />} />
                    <Route
                      path="autohealing"
                      element={
                        <PlanAccessGate
                          minimumPlan="pro"
                          title="Auto-Healing is a Pro Feature"
                          description="Upgrade to Pro to configure recovery playbooks and run automated remediation chains."
                        >
                          <AutoHealingPage />
                        </PlanAccessGate>
                      }
                    />
                    <Route
                      path="aiinsights"
                      element={
                        <PlanAccessGate
                          minimumPlan="pro"
                          title="AI Insights is a Pro Feature"
                          description="Upgrade to Pro to access anomaly intelligence, predictions, and action recommendations."
                        >
                          <AIInsightsPage />
                        </PlanAccessGate>
                      }
                    />
                    <Route
                      path="incidents"
                      element={
                        <PlanAccessGate
                          minimumPlan="pro"
                          title="Incident History is a Pro Feature"
                          description="Upgrade to Pro to audit full incident timelines, executed actions, and verification reports."
                        >
                          <IncidentHistoryPage />
                        </PlanAccessGate>
                      }
                    />
                    <Route path="docs" element={<AppDocsPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                  </Route>
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Router>
          </AuthProvider>
        </AwsOpsProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
