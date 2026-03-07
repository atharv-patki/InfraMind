import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Activity } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      navigate("/login", { replace: true });
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center mx-auto mb-6">
          <Activity className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Redirecting to login...</h2>
        <p className="text-muted-foreground">
          Use email and password authentication to continue.
        </p>
      </div>
    </div>
  );
}
