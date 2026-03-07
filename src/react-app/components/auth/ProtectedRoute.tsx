import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/react-app/context/AuthContext";
import { Activity } from "lucide-react";

export default function ProtectedRoute() {
  const { user, isPending } = useAuth();
  const location = useLocation();

  if (isPending) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center mx-auto">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Checking session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(
          location.pathname + location.search + location.hash
        )}`}
        replace
      />
    );
  }

  return <Outlet />;
}
