import { Ban, CircleAlert, CloudOff, DatabaseZap, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { Card, CardContent } from "@/react-app/components/ui/card";

type DataStateCardProps = {
  state:
    | "loading"
    | "empty"
    | "error"
    | "permission"
    | "disconnected"
    | "partial_outage"
    | "recovery_running";
  title: string;
  detail: string;
  onRetry?: () => void;
};

export function DataStateCard({ state, title, detail, onRetry }: DataStateCardProps) {
  const accessibilityRole = state === "error" || state === "permission" ? "alert" : "status";
  const liveMode = state === "error" || state === "permission" ? "assertive" : "polite";

  const icon =
    state === "loading" ? (
      <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
    ) : state === "permission" ? (
      <Ban className="w-5 h-5 mx-auto text-destructive" />
    ) : state === "disconnected" ? (
      <CloudOff className="w-5 h-5 mx-auto text-muted-foreground" />
    ) : state === "partial_outage" ? (
      <TriangleAlert className="w-5 h-5 mx-auto text-warning" />
    ) : state === "recovery_running" ? (
      <DatabaseZap className="w-5 h-5 mx-auto text-primary" />
    ) : (
      <CircleAlert className="w-5 h-5 mx-auto text-muted-foreground" />
    );

  return (
    <Card>
      <CardContent className="py-8 text-center" role={accessibilityRole} aria-live={liveMode}>
        {icon}
        <p className="mt-3 text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-1">{detail}</p>
        {onRetry ? (
          <Button size="sm" variant="outline" className="mt-4" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
