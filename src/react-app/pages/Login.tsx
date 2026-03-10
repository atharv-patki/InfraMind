import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Activity, Loader2, Shield, Zap } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { useAuth } from "@/react-app/context/AuthContext";
import { getSafeNextPath } from "@/react-app/lib/auth-client";
import { getPlanLabel, normalizePlan } from "@/react-app/lib/plans";

const PLAN_OVERRIDE_KEY = "inframind_plan_override";

export default function Login() {
  const { isPending, login, isFetching } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(() => searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const nextPath = getSafeNextPath(searchParams.get("next"), "/app/overview");
  const isFreshRegistration = searchParams.get("registered") === "1";
  const isLoggedOut = searchParams.get("logged_out") === "1";
  const signupPlan = normalizePlan(searchParams.get("plan"));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      if (isFreshRegistration) {
        window.localStorage.setItem(PLAN_OVERRIDE_KEY, signupPlan);
      } else {
        window.localStorage.removeItem(PLAN_OVERRIDE_KEY);
      }
      await login({ email: email.trim(), password });
      setIsRedirecting(true);
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      navigate(nextPath, { replace: true });
    } catch (authError) {
      const message =
        authError instanceof Error ? authError.message : "Unable to sign in.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex relative">
      {isRedirecting ? (
        <div
          className="absolute inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center"
          role="status"
          aria-live="polite"
          aria-label="Signing in and loading dashboard"
        >
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center mx-auto">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <p className="mt-3 text-sm font-medium">Preparing your dashboard...</p>
            <p className="mt-1 text-xs text-muted-foreground">Loading your account workspace</p>
          </div>
        </div>
      ) : null}

      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-20" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col justify-center px-16">
          <Link to="/" className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">InfraMind</span>
          </Link>

          <h1 className="text-4xl font-bold text-white mb-6">
            Welcome back to
            <br />
            <span className="text-gradient">intelligent monitoring</span>
          </h1>

          <p className="text-lg text-slate-400 mb-12 max-w-md">
            Sign in to access dashboards, alerts, and automation controls.
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-4 text-slate-300">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <span>Credential-based authentication</span>
            </div>
            <div className="flex items-center gap-4 text-slate-300">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <span>Fast access to private monitoring data</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold">InfraMind</span>
            </Link>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold tracking-tight">Sign in</h2>
            <p className="mt-2 text-muted-foreground">
              Enter your account credentials
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" aria-busy={isSubmitting || isFetching}>
            {isFreshRegistration ? (
              <div className="space-y-1" aria-live="polite">
                <p className="text-sm text-success" role="status">
                  {getPlanLabel(signupPlan)} account created successfully. Please sign in.
                </p>
              </div>
            ) : null}

            {isLoggedOut ? (
              <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
                You have been signed out successfully.
              </p>
            ) : null}

            <div className="space-y-2">
              <label htmlFor="login-email" className="text-sm font-medium">Email</label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="login-password" className="text-sm font-medium">Password</label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert" aria-live="assertive">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={isSubmitting || isFetching || isPending}
              className="w-full h-11"
              aria-label="Sign in"
            >
              {isSubmitting || isFetching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Do not have an account?{" "}
            <Link to="/signup" className="text-primary hover:underline font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
