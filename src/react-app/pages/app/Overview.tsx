import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  HardDrive,
  Server,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Badge } from "@/react-app/components/ui/badge";

const healthTrend = [42, 40, 43, 45, 44, 47, 49, 46, 44, 41, 39, 38, 40, 37, 35, 36, 34, 33, 35, 36, 34, 32, 31, 30];

const alertFeed: Array<{
  id: string;
  severity: "Critical" | "Warning" | "Info";
  message: string;
  source: string;
  time: string;
  status: string;
}> = [
  {
    id: "ALT-2401",
    severity: "Critical",
    message: "Database latency exceeded 250ms threshold",
    source: "db-primary-01",
    time: "2 min ago",
    status: "Active",
  },
  {
    id: "ALT-2398",
    severity: "Warning",
    message: "Memory usage crossed 82% on app-worker-07",
    source: "app-worker-07",
    time: "18 min ago",
    status: "Investigating",
  },
  {
    id: "ALT-2392",
    severity: "Info",
    message: "Scheduled backup completed successfully",
    source: "backup-service",
    time: "1 hr ago",
    status: "Resolved",
  },
];

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Average CPU"
          value="41%"
          trend="-3.2%"
          icon={<Activity className="w-4 h-4" />}
          trendDirection="down"
          accent="primary"
        />
        <StatCard
          label="Memory Utilization"
          value="67%"
          trend="+4.1%"
          icon={<HardDrive className="w-4 h-4" />}
          trendDirection="up"
          accent="warning"
        />
        <StatCard
          label="Healthy Servers"
          value="24 / 27"
          trend="89% health"
          icon={<Server className="w-4 h-4" />}
          trendDirection="up"
          accent="success"
        />
        <StatCard
          label="Incident MTTR"
          value="14m"
          trend="-22%"
          icon={<Clock3 className="w-4 h-4" />}
          trendDirection="down"
          accent="primary"
        />
      </section>

      <section className="grid xl:grid-cols-[2fr_1fr] gap-6">
        <Card className="bg-card">
          <CardHeader className="border-b border-border/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>24-Hour System Health Trend</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Composite score based on CPU, memory, disk, and network stability.
                </p>
              </div>
              <Badge variant="outline" className="gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                Stable
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <TrendChart data={healthTrend} />
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="border-b border-border/70">
            <CardTitle>Resource Pressure</CardTitle>
            <p className="text-sm text-muted-foreground">
              Current saturation across critical layers.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <PressureRow label="CPU Cluster Average" value={41} status="good" />
            <PressureRow label="Memory Cluster Average" value={67} status="warning" />
            <PressureRow label="Disk Capacity Used" value={58} status="good" />
            <PressureRow label="Network Throughput" value={73} status="warning" />
          </CardContent>
        </Card>
      </section>

      <section className="grid xl:grid-cols-[1.6fr_1fr] gap-6">
        <Card className="bg-card">
          <CardHeader className="border-b border-border/70">
            <CardTitle>Recent Alerts</CardTitle>
            <p className="text-sm text-muted-foreground">
              Latest incidents across monitored infrastructure.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {alertFeed.map((alert) => (
              <article
                key={alert.id}
                className="rounded-xl border border-border bg-secondary/30 p-4"
              >
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <SeverityDot severity={alert.severity} />
                    <p className="font-medium text-sm">{alert.message}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{alert.id}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>{alert.source}</span>
                  <span>•</span>
                  <span>{alert.time}</span>
                  <span>•</span>
                  <span>{alert.status}</span>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="border-b border-border/70">
            <CardTitle>Incident Breakdown</CardTitle>
            <p className="text-sm text-muted-foreground">
              Severity distribution in the last 24 hours.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <IncidentStat label="Critical" count={3} icon={<AlertTriangle className="w-4 h-4" />} tone="critical" />
            <IncidentStat label="Warning" count={9} icon={<AlertTriangle className="w-4 h-4" />} tone="warning" />
            <IncidentStat label="Resolved" count={21} icon={<CheckCircle2 className="w-4 h-4" />} tone="success" />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  trend,
  icon,
  trendDirection,
  accent,
}: {
  label: string;
  value: string;
  trend: string;
  icon: ReactNode;
  trendDirection: "up" | "down";
  accent: "primary" | "success" | "warning";
}) {
  const accentStyles: Record<typeof accent, string> = {
    primary: "bg-primary/15 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning",
  };

  return (
    <Card className="bg-card">
      <CardContent className="pt-1">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          </div>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accentStyles[accent]}`}>
            {icon}
          </div>
        </div>
        <div className="mt-4 inline-flex items-center gap-1 text-xs text-muted-foreground">
          {trendDirection === "up" ? (
            <TrendingUp className="w-3.5 h-3.5 text-success" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-primary" />
          )}
          {trend}
        </div>
      </CardContent>
    </Card>
  );
}

function TrendChart({ data }: { data: number[] }) {
  const width = 720;
  const height = 220;
  const padding = 16;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(max - min, 1);

  const points = data
    .map((value, index) => {
      const x = padding + (index * (width - padding * 2)) / (data.length - 1);
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const polygon = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;

  return (
    <div className="h-56 w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        <defs>
          <linearGradient id="overviewTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <rect
          x={padding}
          y={padding}
          width={width - padding * 2}
          height={height - padding * 2}
          fill="transparent"
          stroke="hsl(var(--border))"
          strokeDasharray="4 6"
          rx="10"
        />
        <polygon points={polygon} fill="url(#overviewTrendFill)" />
        <polyline
          points={points}
          fill="none"
          stroke="hsl(var(--chart-1))"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function PressureRow({
  label,
  value,
  status,
}: {
  label: string;
  value: number;
  status: "good" | "warning";
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="text-muted-foreground">{label}</span>
        <span className={status === "warning" ? "text-warning font-medium" : "font-medium"}>{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full ${status === "warning" ? "bg-warning" : "bg-success"}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function SeverityDot({ severity }: { severity: "Critical" | "Warning" | "Info" }) {
  const colorClass =
    severity === "Critical"
      ? "bg-destructive"
      : severity === "Warning"
      ? "bg-warning"
      : "bg-primary";

  return <span className={`size-2 rounded-full ${colorClass}`} aria-hidden />;
}

function IncidentStat({
  label,
  count,
  icon,
  tone,
}: {
  label: string;
  count: number;
  icon: ReactNode;
  tone: "critical" | "warning" | "success";
}) {
  const toneClass: Record<typeof tone, string> = {
    critical: "bg-destructive/15 text-destructive",
    warning: "bg-warning/20 text-warning",
    success: "bg-success/15 text-success",
  };

  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${toneClass[tone]}`}>
          {icon}
        </span>
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-lg font-semibold">{count}</span>
    </div>
  );
}
