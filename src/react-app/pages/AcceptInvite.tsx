import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { Activity, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { Card, CardContent } from "@/react-app/components/ui/card";
import { useAuth } from "@/react-app/context/AuthContext";
import { useWorkspace } from "@/react-app/context/WorkspaceContext";
import { acceptWorkspaceInvitation } from "@/react-app/lib/workspace-client";

export default function AcceptInvitePage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { user, isPending: isAuthPending } = useAuth();
  const { refresh: refreshWorkspace } = useWorkspace();

  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");

  const nextPath = useMemo(() => `/invite/${encodeURIComponent(token)}`, [token]);

  useEffect(() => {
    if (!user || !token) return;
    let cancelled = false;

    const run = async () => {
      try {
        setState("loading");
        setMessage("");
        const workspace = await acceptWorkspaceInvitation(token);
        if (cancelled) return;
        setWorkspaceName(workspace?.name ?? "Workspace");
        setState("success");
        setMessage("Invitation accepted successfully.");
        await refreshWorkspace();
      } catch (error) {
        if (cancelled) return;
        setState("error");
        setMessage(error instanceof Error ? error.message : "Unable to accept invitation.");
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [refreshWorkspace, token, user]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (isAuthPending) {
    return (
      <FullScreenState
        icon={<Loader2 className="w-6 h-6 animate-spin" />}
        title="Checking session"
        description="Verifying your account before accepting invitation."
      />
    );
  }

  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(nextPath)}`} replace />;
  }

  if (state === "loading" || state === "idle") {
    return (
      <FullScreenState
        icon={<Loader2 className="w-6 h-6 animate-spin" />}
        title="Accepting invitation"
        description="Applying workspace membership permissions."
      />
    );
  }

  if (state === "error") {
    return (
      <FullScreenState
        icon={<XCircle className="w-6 h-6 text-destructive" />}
        title="Invitation could not be accepted"
        description={message}
      >
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" onClick={() => void navigate(0)}>
            Retry
          </Button>
          <Button asChild>
            <Link to="/app/overview">Open Dashboard</Link>
          </Button>
        </div>
      </FullScreenState>
    );
  }

  return (
    <FullScreenState
      icon={<CheckCircle2 className="w-6 h-6 text-success" />}
      title="Invitation accepted"
      description={`${message} You now have access to ${workspaceName}.`}
    >
      <Button asChild>
        <Link to="/app/overview">Continue to Dashboard</Link>
      </Button>
    </FullScreenState>
  );
}

function FullScreenState({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-lg">
        <CardContent className="py-12 text-center space-y-4">
          <div className="inline-flex size-12 rounded-xl bg-primary/15 text-primary items-center justify-center">
            {icon}
          </div>
          <div>
            <p className="text-xl font-semibold">{title}</p>
            <p className="text-sm text-muted-foreground mt-2">{description}</p>
          </div>
          <div className="pt-2">{children}</div>
          <div className="pt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="w-3.5 h-3.5" />
            InfraMind Workspace Access
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
