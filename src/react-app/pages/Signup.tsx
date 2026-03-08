import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Activity, Bell, Brain, Check, Server } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { useAuth } from "@/react-app/context/AuthContext";
import { getPlanLabel, normalizePlan, type SubscriptionPlan } from "@/react-app/lib/plans";

export default function Signup() {
  const { isPending, register, isFetching } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedPlan = normalizePlan(searchParams.get("plan"));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setError("All fields are required.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      const result = await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        plan: selectedPlan,
      });
      const welcomeParam =
        result.welcomeEmailStatus === "disabled" ? "disabled" : "queued";
      navigate(
        `/login?registered=1&welcome=${welcomeParam}&email=${encodeURIComponent(email.trim())}&plan=${result.user.plan}`,
        { replace: true }
      );
    } catch (authError) {
      const message =
        authError instanceof Error ? authError.message : "Unable to create account.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-20" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col justify-center px-16">
          <Link to="/" className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">InfraMind</span>
          </Link>

          <h1 className="text-4xl font-bold text-white mb-6">
            Create your account
            <br />
            <span className="text-gradient">and start monitoring</span>
          </h1>

          <p className="text-lg text-slate-400 mb-12 max-w-md">
            Build your team workspace with full dashboard access and alert management.
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-4 text-slate-300">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Server className="w-5 h-5 text-primary" />
              </div>
              <span>Monitor infrastructure in one workspace</span>
            </div>
            <div className="flex items-center gap-4 text-slate-300">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <span>Receive alert updates instantly</span>
            </div>
            <div className="flex items-center gap-4 text-slate-300">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <span>Unlock AI insights and forecasts</span>
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
            <h2 className="text-3xl font-bold tracking-tight">Create account</h2>
            <p className="mt-2 text-muted-foreground">
              Use your details to register
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="text-xs text-muted-foreground">Selected plan:</span>
              <span className="inline-flex h-6 items-center rounded-full bg-primary/15 px-2.5 text-xs font-medium text-primary">
                {getPlanLabel(selectedPlan)}
              </span>
              <Link to="/pricing" className="text-xs text-primary hover:underline">
                Change
              </Link>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{planDescription(selectedPlan)}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">First name</label>
                <Input
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  autoComplete="given-name"
                  placeholder="Aarav"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Last name</label>
                <Input
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  autoComplete="family-name"
                  placeholder="Sharma"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="you@company.com"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Minimum 8 characters"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm password</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Re-enter your password"
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button
              type="submit"
              disabled={isSubmitting || isFetching || isPending}
              className="w-full h-11"
            >
              {isSubmitting || isFetching ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <ul className="mt-6 space-y-2 text-sm">
            <li className="flex items-center gap-3">
              <Check className="w-4 h-4 text-success shrink-0" />
              <span>Role-ready dashboard access</span>
            </li>
            <li className="flex items-center gap-3">
              <Check className="w-4 h-4 text-success shrink-0" />
              <span>Session-based secure login</span>
            </li>
          </ul>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function planDescription(plan: SubscriptionPlan): string {
  if (plan === "enterprise") {
    return "Enterprise onboarding includes full feature access and expanded limits.";
  }
  if (plan === "pro") {
    return "Pro trial includes AI insights, auto-healing, and incident lifecycle modules.";
  }
  return "Starter includes core monitoring, infrastructure, metrics, and alert basics.";
}
