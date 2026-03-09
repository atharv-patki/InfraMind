import { useCallback, useEffect, useMemo, useState } from "react";
import { Pause, Play, RefreshCw, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Button } from "@/react-app/components/ui/button";
import { Badge } from "@/react-app/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/react-app/components/ui/tabs";
import { DataStateCard } from "@/react-app/components/dashboard/DataStateCard";
import { PageSkeleton } from "@/react-app/components/dashboard/PageSkeleton";
import { useAwsOps } from "@/react-app/context/AwsOpsContext";
import {
  getMetrics,
  getResources,
  subscribeMetricsSnapshots,
} from "@/react-app/lib/aws-api";
import type {
  AwsServiceType,
  InfrastructureResource,
  MetricsCompareRange,
  MetricsFilters,
  MetricsRange,
  MetricsSeries,
  MetricsSnapshot,
} from "@/react-app/lib/aws-contracts";

type MetricKey = "cpu" | "memory" | "disk" | "network" | "errorRate" | "responseTime";
type MetricsPayload = { primary: MetricsSeries; compare: MetricsSeries | null };

const selectClassName =
  "h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

const rangeOptions: MetricsRange[] = ["15m", "1h", "24h"];
const compareOptions: MetricsCompareRange[] = ["none", "previous_period", "previous_day"];

const metricMeta: Array<{
  key: MetricKey;
  label: string;
  unit: string;
  min: number;
  max: number;
}> = [
  { key: "cpu", label: "CPU Utilization", unit: "%", min: 0, max: 100 },
  { key: "memory", label: "Memory Utilization", unit: "%", min: 0, max: 100 },
  { key: "disk", label: "Disk Usage", unit: "%", min: 0, max: 100 },
  { key: "network", label: "Network Throughput", unit: "rpm", min: 0, max: 2200 },
  { key: "errorRate", label: "Error Rate", unit: "%", min: 0, max: 15 },
  { key: "responseTime", label: "Response Time", unit: "ms", min: 0, max: 1800 },
];

export default function MetricsPage() {
  const { config, isLoading: isConfigLoading } = useAwsOps();

  const [resources, setResources] = useState<InfrastructureResource[]>([]);
  const [filters, setFilters] = useState<MetricsFilters>({
    region: "All",
    service: "All",
    resourceId: "All",
  });
  const [range, setRange] = useState<MetricsRange>("1h");
  const [compareRange, setCompareRange] = useState<MetricsCompareRange>("none");
  const [focusMetric, setFocusMetric] = useState<MetricKey>("cpu");
  const [liveMode, setLiveMode] = useState(true);
  const [data, setData] = useState<MetricsPayload | null>(null);
  const [latestSnapshot, setLatestSnapshot] = useState<MetricsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadResources = useCallback(async () => {
    const result = await getResources("All");
    setResources(result);
  }, []);

  const loadMetrics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      const payload = await getMetrics({ range, compareRange, filters });
      setData(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load metrics.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [compareRange, filters, range]);

  useEffect(() => {
    if (!config) return;
    if (config.connectionStatus === "disconnected" || config.connectionStatus === "permission_denied") {
      return;
    }
    void loadResources();
    void loadMetrics();
  }, [config, loadMetrics, loadResources]);

  const regionOptions = useMemo(() => {
    const list = Array.from(new Set(resources.map((resource) => resource.region)));
    return ["All", ...list];
  }, [resources]);

  const serviceOptions = useMemo(() => {
    const list = Array.from(new Set(resources.map((resource) => resource.type))) as AwsServiceType[];
    return ["All", ...list] as Array<AwsServiceType | "All">;
  }, [resources]);

  const resourceOptions = useMemo(() => {
    return resources.filter((resource) => {
      const regionMatch = filters.region === "All" || resource.region === filters.region;
      const serviceMatch = filters.service === "All" || resource.type === filters.service;
      return regionMatch && serviceMatch;
    });
  }, [filters.region, filters.service, resources]);

  useEffect(() => {
    if (filters.resourceId === "All") return;
    const exists = resourceOptions.some((resource) => resource.id === filters.resourceId);
    if (!exists) {
      setFilters((prev) => ({ ...prev, resourceId: "All" }));
    }
  }, [filters.resourceId, resourceOptions]);

  useEffect(() => {
    if (!liveMode) return;

    const unsubscribe = subscribeMetricsSnapshots((snapshot) => {
      setLatestSnapshot(snapshot);
      setData((prev) => {
        if (!prev) return prev;
        const nextPrimary: MetricsSeries = {
          cpu: appendPoint(prev.primary.cpu, snapshot.cpu),
          memory: appendPoint(prev.primary.memory, snapshot.memory),
          disk: appendPoint(prev.primary.disk, snapshot.disk),
          network: appendPoint(prev.primary.network, snapshot.network),
          errorRate: appendPoint(prev.primary.errorRate, snapshot.errorRate),
          responseTime: appendPoint(prev.primary.responseTime, snapshot.responseTime),
          anomalies: appendPoint(
            prev.primary.anomalies,
            snapshot.errorRate > 5 || snapshot.responseTime > 900 ? 1 : 0
          ),
        };
        return {
          ...prev,
          primary: nextPrimary,
        };
      });
    });

    return () => {
      unsubscribe();
    };
  }, [liveMode]);

  if (isConfigLoading || !config) {
    return (
      <DataStateCard
        state="loading"
        title="Loading metrics context"
        detail="Checking AWS integration state."
      />
    );
  }

  if (config.connectionStatus === "disconnected") {
    return (
      <DataStateCard
        state="disconnected"
        title="AWS account is disconnected"
        detail="Connect AWS account to stream CloudWatch-style metrics."
      />
    );
  }

  if (config.connectionStatus === "permission_denied") {
    return (
      <DataStateCard
        state="permission"
        title="Metrics permission denied"
        detail="Missing IAM permission for CloudWatch metrics access."
      />
    );
  }

  if (isLoading) {
    return <PageSkeleton cards={6} rows={4} />;
  }

  if (error) {
    return (
      <DataStateCard
        state="error"
        title="Metrics are unavailable"
        detail={error}
        onRetry={() => void loadMetrics()}
      />
    );
  }

  if (!data) {
    return (
      <DataStateCard
        state="empty"
        title="No metrics returned"
        detail="Try changing range or filters."
        onRetry={() => void loadMetrics()}
      />
    );
  }

  const focusedMeta = metricMeta.find((metric) => metric.key === focusMetric) ?? metricMeta[0];
  const primaryFocused = data.primary[focusMetric];
  const compareFocused = data.compare ? data.compare[focusMetric] : null;
  const anomalyIndexes = data.primary.anomalies
    .map((value, index) => (value === 1 ? index : -1))
    .filter((index) => index >= 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle>CloudWatch Context Filters</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Scope metrics by region, service, and resource.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className={`${selectClassName} w-36`}
                aria-label="Filter metrics by region"
                value={filters.region}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, region: event.target.value }))
                }
              >
                {regionOptions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
              <select
                className={`${selectClassName} w-36`}
                aria-label="Filter metrics by service"
                value={filters.service}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    service: event.target.value as AwsServiceType | "All",
                  }))
                }
              >
                {serviceOptions.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
              <select
                className={`${selectClassName} w-56`}
                aria-label="Filter metrics by resource"
                value={filters.resourceId}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, resourceId: event.target.value }))
                }
              >
                <option value="All">All resources</option>
                {resourceOptions.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name} ({resource.id})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={range} onValueChange={(value) => setRange(value as MetricsRange)}>
              <TabsList>
                {rangeOptions.map((option) => (
                  <TabsTrigger key={option} value={option}>
                    {option}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <select
              className={`${selectClassName} w-44`}
              aria-label="Compare metrics range"
              value={compareRange}
              onChange={(event) => setCompareRange(event.target.value as MetricsCompareRange)}
            >
              {compareOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant={liveMode ? "default" : "outline"}
              onClick={() => setLiveMode((prev) => !prev)}
            >
              {liveMode ? <Pause className="mr-1.5 h-4 w-4" /> : <Play className="mr-1.5 h-4 w-4" />}
              {liveMode ? "Live On" : "Live Off"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void loadMetrics()}>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Reload
            </Button>
            {latestSnapshot ? (
              <span className="text-xs text-muted-foreground">
                Latest: {new Date(latestSnapshot.at).toLocaleTimeString()}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metricMeta.map((metric) => {
          const values = data.primary[metric.key];
          const current = values[values.length - 1] ?? 0;
          const average =
            values.length === 0
              ? 0
              : values.reduce((sum, value) => sum + value, 0) / values.length;
          const anomalyCount = data.primary.anomalies.reduce((sum, value) => sum + value, 0);
          return (
            <Card
              key={metric.key}
              className={focusMetric === metric.key ? "ring-1 ring-primary/30" : undefined}
            >
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                  {anomalyCount > 0 && (metric.key === "errorRate" || metric.key === "responseTime") ? (
                    <Badge className="bg-warning/20 text-warning hover:bg-warning/25">
                      <TriangleAlert className="mr-1 h-3 w-3" />
                      {anomalyCount}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-2xl font-semibold">
                  {Math.round(current)}
                  {metric.unit}
                </p>
                <p className="text-xs text-muted-foreground">
                  Avg {Math.round(average)}
                  {metric.unit}
                </p>
                <Button size="sm" variant="ghost" onClick={() => setFocusMetric(metric.key)}>
                  Focus Panel
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>{focusedMeta.label}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Primary vs compare range with anomaly markers.
              </p>
            </div>
            <Badge variant="outline">{focusedMeta.unit}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <MetricLineChart
            primary={primaryFocused}
            compare={compareFocused}
            anomalies={anomalyIndexes}
            min={focusedMeta.min}
            max={focusedMeta.max}
          />
          <p className="text-xs text-muted-foreground">
            Anomaly markers are generated where error rate or response time exceeded thresholds.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricLineChart({
  primary,
  compare,
  anomalies,
  min,
  max,
}: {
  primary: number[];
  compare: number[] | null;
  anomalies: number[];
  min: number;
  max: number;
}) {
  if (primary.length === 0) {
    return (
      <div className="h-56 rounded-xl border border-border bg-secondary/30 flex items-center justify-center text-sm text-muted-foreground">
        No data points available.
      </div>
    );
  }

  const width = 980;
  const height = 260;
  const padding = 18;
  const hasCompare = compare && compare.length === primary.length;
  const allValues = hasCompare ? [...primary, ...compare] : primary;
  const minValue = Math.min(min, ...allValues);
  const maxValue = Math.max(max, ...allValues);
  const range = Math.max(maxValue - minValue, 1);

  const getPoint = (value: number, index: number, total: number) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(total - 1, 1);
    const y = height - padding - ((value - minValue) / range) * (height - padding * 2);
    return { x, y };
  };

  const primaryLine = primary
    .map((value, index) => {
      const point = getPoint(value, index, primary.length);
      return `${point.x},${point.y}`;
    })
    .join(" ");

  const compareLine =
    hasCompare && compare
      ? compare
          .map((value, index) => {
            const point = getPoint(value, index, compare.length);
            return `${point.x},${point.y}`;
          })
          .join(" ")
      : "";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full">
      <polyline
        points={primaryLine}
        fill="none"
        stroke="hsl(var(--chart-1))"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {hasCompare ? (
        <polyline
          points={compareLine}
          fill="none"
          stroke="hsl(var(--chart-2))"
          strokeWidth="2.5"
          strokeDasharray="7 6"
          strokeLinecap="round"
        />
      ) : null}

      {anomalies.map((index) => {
        if (!primary[index]) return null;
        const point = getPoint(primary[index], index, primary.length);
        return (
          <circle
            key={`anomaly-${index}`}
            cx={point.x}
            cy={point.y}
            r="4"
            fill="hsl(var(--destructive))"
          />
        );
      })}
    </svg>
  );
}

function appendPoint(values: number[], next: number): number[] {
  if (values.length === 0) return [next];
  return [...values.slice(1), Number(next.toFixed(2))];
}
