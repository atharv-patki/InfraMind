import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@getmocha/users-service/react";
import { Activity, Loader2 } from "lucide-react";

export default function AuthCallback() {
  const { exchangeCodeForSessionToken } = useAuth();
  const navigate = useNavigate();
  const hasRun = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    exchangeCodeForSessionToken()
      .then(() => {
        navigate("/app");
      })
      .catch((err) => {
        console.error("Auth error:", err);
        setError("Authentication failed. Please try again.");
        setTimeout(() => navigate("/login"), 3000);
      });
  }, [exchangeCodeForSessionToken, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center mx-auto mb-6">
          <Activity className="w-8 h-8 text-white" />
        </div>
        
        {error ? (
          <>
            <h2 className="text-xl font-semibold text-destructive mb-2">
              {error}
            </h2>
            <p className="text-muted-foreground">
              Redirecting to login...
            </p>
          </>
        ) : (
          <>
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-4 text-primary" />
            <h2 className="text-xl font-semibold mb-2">Signing you in...</h2>
            <p className="text-muted-foreground">
              Please wait while we complete authentication
            </p>
          </>
        )}
      </div>
    </div>
  );
}
