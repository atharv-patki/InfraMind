import { useMemo, useState } from "react";
import { BellPlus, CheckCircle2, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Button } from "@/react-app/components/ui/button";
import { Badge } from "@/react-app/components/ui/badge";
import { Input } from "@/react-app/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/react-app/components/ui/table";

type Severity = "Critical" | "Warning" | "Info";
type AlertStatus = "Active" | "Resolved";
type SeverityFilter = "All" | Severity;
type StatusFilter = "All" | AlertStatus;

type AlertItem = {
  id: string;
  title: string;
  source: string;
  severity: Severity;
  status: AlertStatus;
  createdAt: string;
};

const seedAlerts: AlertItem[] = [
  {
    id: "ALT-8412",
    title: "Database connection timeout exceeded threshold",
    source: "db-primary-01",
    severity: "Critical",
    status: "Active",
    createdAt: "2 min ago",
  },
  {
    id: "ALT-8410",
    title: "Memory usage above 80% for 10 minutes",
    source: "prod-api-02",
    severity: "Warning",
    status: "Active",
    createdAt: "14 min ago",
  },
  {
    id: "ALT-8408",
    title: "Cache service restarted automatically",
    source: "cache-node-01",
    severity: "Info",
    status: "Resolved",
    createdAt: "32 min ago",
  },
  {
    id: "ALT-8397",
    title: "Packet loss spike detected in eu-west-1",
    source: "edge-gateway-03",
    severity: "Warning",
    status: "Resolved",
    createdAt: "1 hr ago",
  },
];

const selectClassName =
  "h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>(seedAlerts);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [severity, setSeverity] = useState<Severity>("Warning");
  const [error, setError] = useState("");

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const severityMatch = severityFilter === "All" || alert.severity === severityFilter;
      const statusMatch = statusFilter === "All" || alert.status === statusFilter;
      return severityMatch && statusMatch;
    });
  }, [alerts, severityFilter, statusFilter]);

  const summary = useMemo(() => {
    const active = alerts.filter((alert) => alert.status === "Active").length;
    const resolved = alerts.filter((alert) => alert.status === "Resolved").length;
    const critical = alerts.filter(
      (alert) => alert.severity === "Critical" && alert.status === "Active"
    ).length;
    return { active, resolved, critical };
  }, [alerts]);

  const createAlert = () => {
    const trimmedTitle = title.trim();
    const trimmedSource = source.trim();

    if (!trimmedTitle || !trimmedSource) {
      setError("Alert title and source are required.");
      return;
    }

    const newAlert: AlertItem = {
      id: `ALT-${Math.floor(Math.random() * 9000 + 1000)}`,
      title: trimmedTitle,
      source: trimmedSource,
      severity,
      status: "Active",
      createdAt: "Just now",
    };

    setAlerts((prev) => [newAlert, ...prev]);
    setTitle("");
    setSource("");
    setSeverity("Warning");
    setError("");
  };

  const toggleResolved = (id: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === id
          ? { ...alert, status: alert.status === "Active" ? "Resolved" : "Active" }
          : alert
      )
    );
  };

  const removeAlert = (id: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  };

  return (
    <div className="space-y-6">
      <section className="grid sm:grid-cols-3 gap-4">
        <SummaryCard label="Active Alerts" value={summary.active} tone="critical" />
        <SummaryCard label="Resolved Alerts" value={summary.resolved} tone="success" />
        <SummaryCard label="Critical Open" value={summary.critical} tone="warning" />
      </section>

      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle>Create Alert</CardTitle>
          <p className="text-sm text-muted-foreground">
            Simulate incoming incidents for testing alert workflows.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-[1.5fr_1fr_180px] gap-3">
            <Input
              placeholder="Alert title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <Input
              placeholder="Source service or host"
              value={source}
              onChange={(event) => setSource(event.target.value)}
            />
            <select
              value={severity}
              onChange={(event) => setSeverity(event.target.value as Severity)}
              className={selectClassName}
            >
              <option value="Critical">Critical</option>
              <option value="Warning">Warning</option>
              <option value="Info">Info</option>
            </select>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button onClick={createAlert}>
            <BellPlus className="w-4 h-4 mr-1.5" />
            Add Alert
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle>Alert Management</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Filter by status and severity, then resolve incidents as needed.
              </p>
            </div>
            <div className="flex gap-2">
              <select
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)}
                className={`${selectClassName} w-36`}
              >
                <option value="All">All severity</option>
                <option value="Critical">Critical</option>
                <option value="Warning">Warning</option>
                <option value="Info">Info</option>
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className={`${selectClassName} w-32`}
              >
                <option value="All">All status</option>
                <option value="Active">Active</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alert</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAlerts.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell>
                    <p className="font-medium">{alert.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{alert.id}</p>
                  </TableCell>
                  <TableCell>{alert.source}</TableCell>
                  <TableCell>
                    <SeverityBadge severity={alert.severity} />
                  </TableCell>
                  <TableCell>
                    {alert.status === "Resolved" ? (
                      <Badge className="bg-success/15 text-success hover:bg-success/20">
                        Resolved
                      </Badge>
                    ) : (
                      <Badge variant="outline">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell>{alert.createdAt}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => toggleResolved(alert.id)}
                        aria-label={`Resolve ${alert.id}`}
                      >
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => removeAlert(alert.id)}
                        aria-label={`Delete ${alert.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No alerts match the selected filters.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "critical" | "warning" | "success";
}) {
  const toneClass: Record<typeof tone, string> = {
    critical: "bg-destructive/15 text-destructive",
    warning: "bg-warning/20 text-warning",
    success: "bg-success/15 text-success",
  };

  return (
    <Card>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <span className={`h-8 px-3 rounded-lg text-sm font-medium inline-flex items-center ${toneClass[tone]}`}>
          {label}
        </span>
      </CardContent>
    </Card>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  if (severity === "Critical") {
    return <Badge variant="destructive">Critical</Badge>;
  }
  if (severity === "Warning") {
    return <Badge className="bg-warning/20 text-warning hover:bg-warning/25">Warning</Badge>;
  }
  return <Badge className="bg-primary/15 text-primary hover:bg-primary/20">Info</Badge>;
}
