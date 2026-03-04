import { BrowserRouter as Router, Routes, Route } from "react-router";
import { AuthProvider } from "@getmocha/users-service/react";
import HomePage from "@/react-app/pages/Home";
import FeaturesPage from "@/react-app/pages/Features";
import PricingPage from "@/react-app/pages/Pricing";
import LoginPage from "@/react-app/pages/Login";
import SignupPage from "@/react-app/pages/Signup";
import AuthCallbackPage from "@/react-app/pages/AuthCallback";
import Docs from "./pages/docs";

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
        </Routes>
      </Router>
    </AuthProvider>
  );
}
