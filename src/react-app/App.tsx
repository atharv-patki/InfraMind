import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router";
import { AuthProvider } from "@/react-app/context/AuthContext";
import HomePage from "@/react-app/pages/Home";
import FeaturesPage from "@/react-app/pages/Features";
import PricingPage from "@/react-app/pages/Pricing";
import LoginPage from "@/react-app/pages/Login";
import SignupPage from "@/react-app/pages/Signup";
import AuthCallbackPage from "@/react-app/pages/AuthCallback";
import Docs from "./pages/docs";
import DashboardLayout from "@/react-app/components/dashboard/DashboardLayout";
import ProtectedRoute from "@/react-app/components/auth/ProtectedRoute";
import OverviewPage from "@/react-app/pages/app/Overview";
import InfrastructurePage from "@/react-app/pages/app/Infrastructure";
import MetricsPage from "@/react-app/pages/app/Metrics";
import AlertsPage from "@/react-app/pages/app/Alerts";
import AutoHealingPage from "@/react-app/pages/app/AutoHealing";
import AIInsightsPage from "@/react-app/pages/app/AIInsights";
import AppDocsPage from "@/react-app/pages/app/Docs";
import SettingsPage from "@/react-app/pages/app/Settings";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/docs" element={<Docs />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<DashboardLayout />}>
              <Route index element={<Navigate to="/app/overview" replace />} />
              <Route path="overview" element={<OverviewPage />} />
              <Route path="infrastructure" element={<InfrastructurePage />} />
              <Route path="metrics" element={<MetricsPage />} />
              <Route path="alerts" element={<AlertsPage />} />
              <Route path="autohealing" element={<AutoHealingPage />} />
              <Route path="aiinsights" element={<AIInsightsPage />} />
              <Route path="docs" element={<AppDocsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
