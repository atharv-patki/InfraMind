import type {
  IncidentStatus,
  OpsConnectionStatus,
  ResourceHealth,
} from "@/react-app/lib/aws-contracts";
import { Badge } from "@/react-app/components/ui/badge";

type StatusValue = OpsConnectionStatus | ResourceHealth | IncidentStatus;

export function OpsStatusBadge({ status }: { status: StatusValue }) {
  if (status === "connected") {
    return <Badge className="bg-success/15 text-success hover:bg-success/20">Connected</Badge>;
  }

  if (status === "Healthy" || status === "Resolved") {
    return <Badge className="bg-success/15 text-success hover:bg-success/20">{status}</Badge>;
  }

  if (status === "disconnected") {
    return <Badge variant="outline">Disconnected</Badge>;
  }

  if (status === "permission_denied") {
    return <Badge variant="destructive">Permission Denied</Badge>;
  }

  if (status === "Warning" || status === "Analyzing" || status === "Detected") {
    return <Badge className="bg-warning/20 text-warning hover:bg-warning/25">{status}</Badge>;
  }

  if (status === "Recovering" || status === "recovery_running") {
    return <Badge className="bg-primary/15 text-primary hover:bg-primary/20">Recovery Running</Badge>;
  }

  if (status === "partial_outage") {
    return <Badge className="bg-warning/20 text-warning hover:bg-warning/25">Partial Outage</Badge>;
  }

  if (status === "Escalated") {
    return <Badge variant="destructive">Escalated</Badge>;
  }

  return <Badge variant="destructive">{status}</Badge>;
}
