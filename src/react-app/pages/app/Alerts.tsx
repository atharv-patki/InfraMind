import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Eye, RefreshCw, Siren, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/react-app/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/react-app/components/ui/table";
import { Badge } from "@/react-app/components/ui/badge";
import { DataStateCard } from "@/react-app/components/dashboard/DataStateCard";
import { OpsStatusBadge } from "@/react-app/components/dashboard/OpsStatusBadge";
import { TimelineList } from "@/react-app/components/dashboard/TimelineList";
import { PageSkeleton } from "@/react-app/components/dashboard/PageSkeleton";
import { useAwsOps } from "@/react-app/context/AwsOpsContext";
import { useToast } from "@/react-app/context/ToastContext";
import {
  acknowledgeIncident,
  escalateIncident,
  getAlerts,
  subscribeAlertsSnapshots,
  updateAlertStatus,
} from "@/react-app/lib/aws-api";
import type { AlertIncident, IncidentSeverity, IncidentStatus } from "@/react-app/lib/aws-contracts";

const selectClassName =
  "h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

const statusOptions: Array<IncidentStatus | "All"> = [
  "All",
  "Detected",
  "Analyzing",
  "Recovering",
  "Resolved",
  "Escalated",
];
const severityOptions: Array<IncidentSeverity | "All"> = [
  "All",
  "Critical",
  "High",
  "Medium",
  "Low",
];

export default function AlertsPage() {
  const { config, isLoading: isConfigLoading } = useAwsOps();
  const { pushToast } = useToast();

  const [incidents, setIncidents] = useState<AlertIncident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | "All">("All");
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | "All">("All");
  const [search, setSearch] = useState("");
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [inFlightIncidentId, setInFlightIncidentId] = useState<string | null>(null);

  const loadIncidents = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setIsLoading(true);
      }
      setError("");
      const data = await getAlerts();
      setIncidents(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load incidents.";
      setError(message);
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!config) return;
    if (config.connectionStatus === "disconnected" || config.connectionStatus === "permission_denied") {
      return;
    }
    void loadIncidents();
  }, [config, loadIncidents]);

  useEffect(() => {
    if (!config) return;
    if (config.connectionStatus === "disconnected" || config.connectionStatus === "permission_denied") {
      return;
    }

    const unsubscribe = subscribeAlertsSnapshots(() => {
      void loadIncidents(true);
    });

    return () => {
      unsubscribe();
    };
  }, [config, loadIncidents]);

  const selectedIncident = useMemo(
    () => incidents.find((incident) => incident.id === selectedIncidentId) ?? null,
    [incidents, selectedIncidentId]
  );

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      const statusMatch = statusFilter === "All" || incident.status === statusFilter;
      const severityMatch = severityFilter === "All" || incident.severity === severityFilter;
      const value = search.trim().toLowerCase();
      const searchMatch =
        value.length === 0 ||
        incident.id.toLowerCase().includes(value) ||
        incident.title.toLowerCase().includes(value) ||
        incident.owner.toLowerCase().includes(value) ||
        incident.team.toLowerCase().includes(value) ||
        incident.source.toLowerCase().includes(value);
      return statusMatch && severityMatch && searchMatch;
    });
  }, [incidents, search, severityFilter, statusFilter]);

  const summary = useMemo(() => {
    return {
      active: incidents.filter((incident) => incident.status !== "Resolved").length,
      recovering: incidents.filter((incident) => incident.status === "Recovering").length,
      escalated: incidents.filter((incident) => incident.status === "Escalated").length,
    };
  }, [incidents]);

  const upsertIncident = useCallback((updated: AlertIncident) => {
    setIncidents((prev) => prev.map((incident) => (incident.id === updated.id ? updated : incident)));
  }, []);

  const runAction = useCallback(
    async (
      incidentId: string,
      action: "acknowledge" | "escalate" | "resolve"
    ) => {
      try {
        setInFlightIncidentId(incidentId);
        const updated =
          action === "acknowledge"
            ? await acknowledgeIncident(incidentId)
            : action === "escalate"
            ? await escalateIncident(incidentId)
            : await updateAlertStatus({ incidentId, status: "Resolved" });
        upsertIncident(updated);
        pushToast(`Incident ${incidentId} updated.`, "success");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to update incident.";
        setError(message);
        pushToast(message, "error");
      } finally {
        setInFlightIncidentId(null);
      }
    },
    [pushToast, upsertIncident]
  );

  if (isConfigLoading || !config) {
    return (
      <DataStateCard
        state="loading"
        title="Loading alerting context"
        detail="Checking AWS connection for incident lifecycle view."
      />
    );
  }

  if (config.connectionStatus === "disconnected") {
    return (
      <DataStateCard
        state="disconnected"
        title="AWS account is disconnected"
        detail="Connect an AWS account in Settings to manage incidents."
      />
    );
  }

  if (config.connectionStatus === "permission_denied") {
    return (
      <DataStateCard
        state="permission"
        title="Incident access denied"
        detail="IAM permissions are required to read CloudWatch alarms and incidents."
      />
    );
  }

  if (isLoading) {
    return <PageSkeleton cards={3} rows={6} />;
  }

  if (error) {
    return (
      <DataStateCard
        state="error"
        title="Unable to load incidents"
        detail={error}
        onRetry={() => void loadIncidents()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Active Incidents"
          value={summary.active}
          helper="Detected to escalated"
          icon={<Siren className="h-4 w-4" />}
        />
        <SummaryCard
          label="Recovering"
          value={summary.recovering}
          helper="Auto-recovery running"
          icon={<RefreshCw className="h-4 w-4" />}
        />
        <SummaryCard
          label="Escalated"
          value={summary.escalated}
          helper="Requires human action"
          icon={<Users className="h-4 w-4" />}
        />
      </section>

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle>Incident Lifecycle</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Workflow statuses: Detected, Analyzing, Recovering, Resolved, Escalated.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="w-64"
                placeholder="Search id, title, team, owner"
                aria-label="Search incidents"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                className={`${selectClassName} w-40`}
                aria-label="Filter incidents by severity"
                value={severityFilter}
                onChange={(event) =>
                  setSeverityFilter(event.target.value as IncidentSeverity | "All")
                }
              >
                {severityOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <select
                className={`${selectClassName} w-40`}
                aria-label="Filter incidents by status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as IncidentStatus | "All")}
              >
                {statusOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="outline" onClick={() => void loadIncidents()}>
                <RefreshCw className="mr-1.5 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredIncidents.length === 0 ? (
            <DataStateCard
              state="empty"
              title="No incidents found"
              detail="Adjust severity or status filters."
            />
          ) : (
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%]">Incident</TableHead>
                  <TableHead className="w-[7%]">Severity</TableHead>
                  <TableHead className="w-[9%]">Status</TableHead>
                  <TableHead className="w-[13%] whitespace-normal">Owner / Team</TableHead>
                  <TableHead className="w-[12%] whitespace-normal">Service</TableHead>
                  <TableHead className="w-[11%]">Detected</TableHead>
                  <TableHead className="w-[18%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIncidents.map((incident) => {
                  const isBusy = inFlightIncidentId === incident.id;
                  return (
                    <TableRow key={incident.id}>
                      <TableCell className="align-top whitespace-normal break-words">
                        <p className="font-medium">{incident.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{incident.id}</p>
                      </TableCell>
                      <TableCell className="align-top">
                        <SeverityBadge severity={incident.severity} />
                      </TableCell>
                      <TableCell className="align-top">
                        <OpsStatusBadge status={incident.status} />
                      </TableCell>
                      <TableCell className="align-top whitespace-normal break-words">
                        <p className="text-sm">{incident.owner}</p>
                        <p className="text-xs text-muted-foreground">{incident.team}</p>
                      </TableCell>
                      <TableCell className="align-top whitespace-normal break-words">
                        <p className="text-sm">{incident.service}</p>
                        <p className="text-xs text-muted-foreground">{incident.source}</p>
                      </TableCell>
                      <TableCell className="align-top whitespace-nowrap text-xs tabular-nums xl:text-sm">
                        {formatDetectedAt(incident.detectedAt)}
                      </TableCell>
                      <TableCell className="w-[18%] text-right align-top">
                        <div className="ml-auto flex max-w-[240px] flex-wrap justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isBusy || incident.status === "Resolved"}
                            onClick={() => void runAction(incident.id, "acknowledge")}
                          >
                            Acknowledge
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isBusy || incident.status === "Escalated"}
                            onClick={() => void runAction(incident.id, "escalate")}
                          >
                            Escalate
                          </Button>
                          <Button
                            size="sm"
                            disabled={isBusy || incident.status === "Resolved"}
                            onClick={() => void runAction(incident.id, "resolve")}
                          >
                            Resolve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedIncidentId(incident.id)}
                          >
                            <Eye className="mr-1.5 h-4 w-4" />
                            Timeline
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedIncident)} onOpenChange={(open) => !open && setSelectedIncidentId(null)}>
        <DialogContent className="!left-auto !right-0 !top-0 !h-screen !max-w-md !translate-x-0 !translate-y-0 rounded-none border-l border-border p-0">
          {selectedIncident ? (
            <div className="flex h-full flex-col">
              <DialogHeader className="border-b border-border px-5 py-4">
                <DialogTitle>{selectedIncident.id}</DialogTitle>
                <DialogDescription>{selectedIncident.title}</DialogDescription>
                <div className="mt-2 flex items-center gap-2">
                  <SeverityBadge severity={selectedIncident.severity} />
                  <OpsStatusBadge status={selectedIncident.status} />
                </div>
              </DialogHeader>
              <div className="space-y-4 overflow-y-auto px-5 py-4">
                <article className="rounded-xl border border-border bg-secondary/30 p-3 text-sm">
                  <p className="font-medium">Ownership</p>
                  <p className="mt-1 text-muted-foreground">
                    {selectedIncident.owner} | {selectedIncident.team}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Source: {selectedIncident.source} ({selectedIncident.service})
                  </p>
                </article>
                <article className="rounded-xl border border-border bg-secondary/30 p-3 text-sm">
                  <p className="font-medium">Timeline</p>
                  <div className="mt-3">
                    <TimelineList events={selectedIncident.timeline} />
                  </div>
                </article>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: number;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        </div>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          {icon}
        </span>
      </CardContent>
    </Card>
  );
}

function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  if (severity === "Critical") {
    return <Badge variant="destructive">Critical</Badge>;
  }
  if (severity === "High") {
    return <Badge className="bg-warning/20 text-warning hover:bg-warning/25">High</Badge>;
  }
  if (severity === "Medium") {
    return <Badge className="bg-primary/15 text-primary hover:bg-primary/20">Medium</Badge>;
  }
  return <Badge variant="outline">Low</Badge>;
}

function formatDetectedAt(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

