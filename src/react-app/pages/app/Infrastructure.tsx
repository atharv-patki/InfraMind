import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { MoreHorizontal, RefreshCw, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/react-app/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/react-app/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/react-app/components/ui/dropdown-menu";
import { DataStateCard } from "@/react-app/components/dashboard/DataStateCard";
import { OpsStatusBadge } from "@/react-app/components/dashboard/OpsStatusBadge";
import { ConfirmActionDialog } from "@/react-app/components/dashboard/ConfirmActionDialog";
import { PageSkeleton } from "@/react-app/components/dashboard/PageSkeleton";
import { useAwsOps } from "@/react-app/context/AwsOpsContext";
import { useToast } from "@/react-app/context/ToastContext";
import {
  getResources,
  runResourceQuickAction,
} from "@/react-app/lib/aws-api";
import type {
  AwsServiceType,
  InfrastructureResource,
  RecoveryActionType,
} from "@/react-app/lib/aws-contracts";

type ServiceFilter = AwsServiceType | "All";
type ResourceColumn = {
  id: string;
  label: string;
  render: (resource: InfrastructureResource) => ReactNode;
};

const serviceTabs: ServiceFilter[] = ["All", "EC2", "ECS", "Lambda", "RDS", "ALB"];
const quickActions: RecoveryActionType[] = ["restart", "scale", "redeploy", "failover"];

const selectClassName =
  "h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default function InfrastructurePage() {
  const { config, isLoading: isConfigLoading } = useAwsOps();
  const { pushToast } = useToast();

  const [resources, setResources] = useState<InfrastructureResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("All");
  const [regionFilter, setRegionFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [pendingAction, setPendingAction] = useState<{
    resourceId: string;
    resourceName: string;
    action: RecoveryActionType;
  } | null>(null);
  const [isActionRunning, setIsActionRunning] = useState(false);

  const loadResources = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      const data = await getResources("All");
      setResources(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load AWS resources.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!config) return;
    if (config.connectionStatus === "disconnected" || config.connectionStatus === "permission_denied") {
      return;
    }
    void loadResources();
  }, [config, loadResources]);

  const regions = useMemo(() => {
    const allRegions = Array.from(new Set(resources.map((resource) => resource.region)));
    return ["All", ...allRegions];
  }, [resources]);

  const filteredResources = useMemo(() => {
    return resources.filter((resource) => {
      const serviceMatch = serviceFilter === "All" || resource.type === serviceFilter;
      const regionMatch = regionFilter === "All" || resource.region === regionFilter;
      const search = query.trim().toLowerCase();
      const queryMatch =
        search.length === 0 ||
        resource.name.toLowerCase().includes(search) ||
        resource.id.toLowerCase().includes(search) ||
        resource.owner.toLowerCase().includes(search) ||
        resource.team.toLowerCase().includes(search);
      return serviceMatch && regionMatch && queryMatch;
    });
  }, [query, regionFilter, resources, serviceFilter]);

  const counts = useMemo(() => {
    const healthy = filteredResources.filter((item) => item.health === "Healthy").length;
    const warning = filteredResources.filter((item) => item.health === "Warning").length;
    const critical = filteredResources.filter((item) => item.health === "Critical").length;
    return { healthy, warning, critical };
  }, [filteredResources]);

  const columns = useMemo(() => getColumns(serviceFilter), [serviceFilter]);

  const confirmAction = useCallback(async () => {
    if (!pendingAction) return;
    try {
      setIsActionRunning(true);
      await runResourceQuickAction({
        resourceId: pendingAction.resourceId,
        action: pendingAction.action,
      });
      pushToast(
        `${actionLabel(pendingAction.action)} executed on ${pendingAction.resourceName}.`,
        "success"
      );
      await loadResources();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to run resource action.";
      pushToast(message, "error");
      setError(message);
    } finally {
      setIsActionRunning(false);
      setPendingAction(null);
    }
  }, [loadResources, pendingAction, pushToast]);

  if (isConfigLoading || !config) {
    return (
      <DataStateCard
        state="loading"
        title="Loading infrastructure context"
        detail="Checking AWS integration status."
      />
    );
  }

  if (config.connectionStatus === "disconnected") {
    return (
      <DataStateCard
        state="disconnected"
        title="AWS account is disconnected"
        detail="Connect an AWS account in Settings to view infrastructure inventory."
      />
    );
  }

  if (config.connectionStatus === "permission_denied") {
    return (
      <DataStateCard
        state="permission"
        title="IAM access required"
        detail="Current IAM policy does not allow infrastructure discovery."
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
        title="Infrastructure is unavailable"
        detail={error}
        onRetry={() => void loadResources()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Healthy" value={counts.healthy} tone="success" />
        <SummaryCard label="Warning" value={counts.warning} tone="warning" />
        <SummaryCard label="Critical" value={counts.critical} tone="critical" />
      </section>

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle>AWS Resource Inventory</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Filter by service type and region, then execute quick recovery actions.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="w-64 pl-9"
                  placeholder="Search name, id, owner"
                  aria-label="Search resources by name, id, or owner"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <select
                className={`${selectClassName} w-36`}
                aria-label="Filter resources by region"
                value={regionFilter}
                onChange={(event) => setRegionFilter(event.target.value)}
              >
                {regions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="outline" onClick={() => void loadResources()}>
                <RefreshCw className="mr-1.5 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={serviceFilter} onValueChange={(value) => setServiceFilter(value as ServiceFilter)}>
            <TabsList className="flex w-full flex-wrap justify-start">
              {serviceTabs.map((service) => (
                <TabsTrigger key={service} value={service}>
                  {service}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {filteredResources.length === 0 ? (
            <DataStateCard
              state="empty"
              title="No resources match the current filters"
              detail="Try a different service tab, region, or search term."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((column) => (
                      <TableHead key={column.id}>{column.label}</TableHead>
                    ))}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResources.map((resource) => (
                    <TableRow key={resource.id}>
                      {columns.map((column) => (
                        <TableCell key={`${resource.id}-${column.id}`}>
                          {column.render(resource)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon-sm" variant="ghost" aria-label="Open actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            {quickActions.map((action) => (
                              <DropdownMenuItem
                                key={action}
                                onSelect={(event) => {
                                  event.preventDefault();
                                  setPendingAction({
                                    resourceId: resource.id,
                                    resourceName: resource.name,
                                    action,
                                  });
                                }}
                              >
                                {actionLabel(action)}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmActionDialog
        open={Boolean(pendingAction)}
        title={
          pendingAction
            ? `Run ${actionLabel(pendingAction.action)} on ${pendingAction.resourceName}?`
            : "Run action"
        }
        description={
          isActionRunning
            ? "Executing action..."
            : "This is a simulated AWS operation in mock mode."
        }
        confirmLabel={isActionRunning ? "Running..." : "Run Action"}
        onOpenChange={(open) => {
          if (!open && !isActionRunning) {
            setPendingAction(null);
          }
        }}
        onConfirm={() => void confirmAction()}
      />
    </div>
  );
}

function getColumns(serviceFilter: ServiceFilter): ResourceColumn[] {
  const base: ResourceColumn[] = [
    {
      id: "name",
      label: "Resource",
      render: (resource) => (
        <div>
          <p className="font-medium">{resource.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{resource.id}</p>
        </div>
      ),
    },
    {
      id: "type",
      label: "Type",
      render: (resource) => <span>{resource.type}</span>,
    },
    {
      id: "region",
      label: "Region",
      render: (resource) => <span>{resource.region}</span>,
    },
    {
      id: "health",
      label: "Health",
      render: (resource) => <OpsStatusBadge status={resource.health} />,
    },
  ];

  const utilizationColumns: ResourceColumn[] = [
    {
      id: "cpu",
      label: "CPU",
      render: (resource) => `${resource.cpuUtilization}%`,
    },
    {
      id: "memory",
      label: "Memory",
      render: (resource) => `${resource.memoryUtilization}%`,
    },
  ];

  const trafficColumns: ResourceColumn[] = [
    {
      id: "rpm",
      label: "Req/Min",
      render: (resource) => resource.requestsPerMinute.toLocaleString(),
    },
    {
      id: "uptime",
      label: "Uptime",
      render: (resource) => resource.uptime,
    },
  ];

  if (serviceFilter === "Lambda") {
    return [
      ...base,
      {
        id: "invocations",
        label: "Invocations/Min",
        render: (resource) => resource.requestsPerMinute.toLocaleString(),
      },
      {
        id: "memory",
        label: "Memory",
        render: (resource) => `${resource.memoryUtilization}%`,
      },
      {
        id: "owner",
        label: "Owner",
        render: (resource) => resource.owner,
      },
    ];
  }

  if (serviceFilter === "RDS") {
    return [
      ...base,
      ...utilizationColumns,
      {
        id: "team",
        label: "Team",
        render: (resource) => resource.team,
      },
      {
        id: "last-event",
        label: "Last Event",
        render: (resource) => (
          <span className="text-xs text-muted-foreground">{resource.lastEvent}</span>
        ),
      },
    ];
  }

  if (serviceFilter === "ALB") {
    return [
      ...base,
      {
        id: "traffic",
        label: "Requests/Min",
        render: (resource) => resource.requestsPerMinute.toLocaleString(),
      },
      {
        id: "owner",
        label: "Owner",
        render: (resource) => resource.owner,
      },
      {
        id: "last-event",
        label: "Last Event",
        render: (resource) => (
          <span className="text-xs text-muted-foreground">{resource.lastEvent}</span>
        ),
      },
    ];
  }

  return [
    ...base,
    ...utilizationColumns,
    ...trafficColumns,
    {
      id: "owner",
      label: "Owner/Team",
      render: (resource) => (
        <div className="text-sm">
          <p>{resource.owner}</p>
          <p className="text-xs text-muted-foreground">{resource.team}</p>
        </div>
      ),
    },
  ];
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "critical";
}) {
  const toneClass: Record<typeof tone, string> = {
    success: "text-success bg-success/15",
    warning: "text-warning bg-warning/20",
    critical: "text-destructive bg-destructive/15",
  };

  return (
    <Card>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <span
          className={`inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium ${toneClass[tone]}`}
        >
          {label}
        </span>
      </CardContent>
    </Card>
  );
}

function actionLabel(action: RecoveryActionType): string {
  if (action === "restart") return "Restart";
  if (action === "scale") return "Scale";
  if (action === "redeploy") return "Redeploy";
  return "Failover";
}
