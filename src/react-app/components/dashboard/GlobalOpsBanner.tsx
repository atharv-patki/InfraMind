import { AlertTriangle, CheckCircle2, ShieldAlert, Zap } from "lucide-react";
import { useAwsOps } from "@/react-app/context/AwsOpsContext";
import { Button } from "@/react-app/components/ui/button";

export function GlobalOpsBanner() {
  const { config, isLoading, error, refresh } = useAwsOps();

  if (isLoading || !config) return null;

  const status = config.connectionStatus;
  const toneClass =
    status === "connected"
      ? "border-success/30 bg-success/10 text-success"
      : status === "recovery_running"
      ? "border-primary/30 bg-primary/10 text-primary"
      : status === "partial_outage"
      ? "border-warning/30 bg-warning/20 text-warning"
      : "border-destructive/30 bg-destructive/10 text-destructive";

  return (
    <div className={`rounded-xl border px-3 py-2 text-sm flex items-center justify-between gap-3 ${toneClass}`}>
      <div className="flex items-center gap-2">
        {status === "connected" ? <CheckCircle2 className="w-4 h-4" /> : null}
        {status === "recovery_running" ? <Zap className="w-4 h-4" /> : null}
        {status === "partial_outage" ? <AlertTriangle className="w-4 h-4" /> : null}
        {status === "disconnected" || status === "permission_denied" ? (
          <ShieldAlert className="w-4 h-4" />
        ) : null}
        <span>
          AWS status: <span className="font-medium">{status}</span> ({config.region}, {config.environment})
        </span>
      </div>
      {error ? <span className="text-xs">{error}</span> : null}
      <Button size="sm" variant="outline" onClick={() => void refresh()}>
        Refresh
      </Button>
    </div>
  );
}
