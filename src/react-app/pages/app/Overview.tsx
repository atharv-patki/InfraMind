import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Clock3, HeartPulse, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Badge } from "@/react-app/components/ui/badge";
import { useAwsOps } from "@/react-app/context/AwsOpsContext";
import { DataStateCard } from "@/react-app/components/dashboard/DataStateCard";
import { OpsStatusBadge } from "@/react-app/components/dashboard/OpsStatusBadge";
import { getOverviewData } from "@/react-app/lib/aws-mock-service";
import type { OverviewData } from "@/react-app/lib/aws-contracts";

export default function OverviewPage() {
  const { config } = useAwsOps();
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOverview = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      const data = await getOverviewData();
      setOverview(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load overview.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const statusTone = useMemo(() => {
    if (!config) return "disconnected";
    return config.connectionStatus;
  }, [config]);

  if (!config || config.connectionStatus === "disconnected") {
    return (
      <DataStateCard
        state="disconnected"
        title="AWS account is disconnected"
        detail="Connect account from Settings to view live operational health."
      />
    );
  }

  if (config.connectionStatus === "permission_denied") {
    return (
      <DataStateCard
        state="permission"
        title="IAM permission check failed"
        detail="Some required permissions are missing for operational dashboards."
      />
    );
  }

  if (isLoading) {
    return (
      <DataStateCard
        state="loading"
        title="Loading AWS operational overview"
        detail="Fetching service health, incident, and region status."
      />
    );
  }

  if (error) {
    return (
      <DataStateCard
        state="error"
        title="Overview unavailable"
        detail={error}
        onRetry={() => void loadOverview()}
      />
    );
  }

  if (!overview) {
    return (
      <DataStateCard
        state="empty"
        title="No overview data available"
        detail="Mock service returned no records."
        onRetry={() => void loadOverview()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Service Health Score"
          value={`${overview.serviceHealthScore}%`}
          icon={<HeartPulse className="w-4 h-4" />}
          helper="Composite reliability index"
        />
        <StatCard
          label="Active Incidents"
          value={`${overview.activeIncidents}`}
          icon={<Activity className="w-4 h-4" />}
          helper="Detected and unresolved"
        />
        <StatCard
          label="Recoveries Today"
          value={`${overview.recoveriesToday}`}
          icon={<ShieldCheck className="w-4 h-4" />}
          helper="Automated + manual"
        />
        <StatCard
          label="Mean Recovery Time"
          value={`${overview.meanRecoveryTimeMinutes} min`}
          icon={<Clock3 className="w-4 h-4" />}
          helper="Rolling 24 hour average"
        />
      </section>

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Operational State</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Current system orchestration and automation status.
              </p>
            </div>
            <OpsStatusBadge status={statusTone} />
          </div>
        </CardHeader>
        <CardContent className="pt-4 text-sm text-muted-foreground">
          {statusTone === "recovery_running" ? (
            <p>Auto-recovery workflow is currently executing. Verification window is active.</p>
          ) : statusTone === "partial_outage" ? (
            <p>Partial outage mode detected. Some resources are degraded in one or more regions.</p>
          ) : (
            <p>Monitoring and auto-recovery are stable across connected AWS regions.</p>
          )}
        </CardContent>
      </Card>

      <section className="grid xl:grid-cols-[1.8fr_1fr] gap-6">
        <Card>
          <CardHeader className="border-b border-border/70">
            <CardTitle>Incident Trend</CardTitle>
            <p className="text-sm text-muted-foreground">
              14-point trend of incident pressure in the environment.
            </p>
          </CardHeader>
          <CardContent>
            <TrendChart data={overview.incidentTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/70">
            <CardTitle>Region Health</CardTitle>
            <p className="text-sm text-muted-foreground">
              Live health score by AWS region.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.regions.map((region) => (
              <article
                key={region.region}
                className="rounded-xl border border-border bg-secondary/30 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{region.region}</p>
                  <Badge variant="outline">{region.healthScore}%</Badge>
                </div>
                <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                  <span>Active: {region.activeIncidents}</span>
                  <span>Recovery: {region.recoveryRunning}</span>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        </div>
        <span className="w-9 h-9 rounded-lg bg-primary/15 text-primary inline-flex items-center justify-center">
          {icon}
        </span>
      </CardContent>
    </Card>
  );
}

function TrendChart({ data }: { data: number[] }) {
  const width = 760;
  const height = 220;
  const padding = 16;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(max - min, 1);

  const line = data
    .map((value, index) => {
      const x = padding + (index * (width - padding * 2)) / (data.length - 1);
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-56">
      <polygon points={area} fill="hsl(var(--chart-1))" opacity={0.16} />
      <polyline
        points={line}
        fill="none"
        stroke="hsl(var(--chart-1))"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
