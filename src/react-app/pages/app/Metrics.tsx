import { useEffect, useMemo, useState } from "react";
import { Activity, HardDrive, Network, RefreshCw, Server } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Button } from "@/react-app/components/ui/button";
import { Badge } from "@/react-app/components/ui/badge";

type MetricKey = "cpu" | "memory" | "disk" | "network";
type TimeRange = "1h" | "24h" | "7d";
type MetricSeries = Record<MetricKey, number[]>;

const rangeLabels: Record<TimeRange, string> = {
  "1h": "Last 1 hour",
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
};

const seriesLengthByRange: Record<TimeRange, number> = {
  "1h": 20,
  "24h": 24,
  "7d": 28,
};

const metricConfig: Array<{
  key: MetricKey;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  unit: string;
  color: string;
  min: number;
  max: number;
  warningAt?: number;
}> = [
  {
    key: "cpu",
    title: "CPU Usage",
    icon: Activity,
    unit: "%",
    color: "hsl(var(--chart-1))",
    min: 20,
    max: 92,
    warningAt: 80,
  },
  {
    key: "memory",
    title: "Memory Usage",
    icon: Server,
    unit: "%",
    color: "hsl(var(--chart-2))",
    min: 30,
    max: 95,
    warningAt: 85,
  },
  {
    key: "disk",
    title: "Disk Utilization",
    icon: HardDrive,
    unit: "%",
    color: "hsl(var(--chart-3))",
    min: 15,
    max: 89,
    warningAt: 85,
  },
  {
    key: "network",
    title: "Network Throughput",
    icon: Network,
    unit: "Mbps",
    color: "hsl(var(--chart-4))",
    min: 20,
    max: 180,
  },
];

export default function MetricsPage() {
  const [range, setRange] = useState<TimeRange>("24h");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [series, setSeries] = useState<MetricSeries>(() => createInitialSeries("24h"));

  useEffect(() => {
    setSeries(createInitialSeries(range));
  }, [range]);

  useEffect(() => {
    if (!autoRefresh) return;

    const intervalId = window.setInterval(() => {
      setSeries((prev) => ({
        cpu: pushNextPoint(prev.cpu, 35, 9, 20, 95),
        memory: pushNextPoint(prev.memory, 62, 6, 28, 98),
        disk: pushNextPoint(prev.disk, 56, 4, 20, 90),
        network: pushNextPoint(prev.network, 96, 18, 20, 190),
      }));
    }, 2800);

    return () => window.clearInterval(intervalId);
  }, [autoRefresh]);

  const latestRows = useMemo(() => {
    const length = series.cpu.length;
    const rowCount = Math.min(6, length);
    return Array.from({ length: rowCount }, (_, idx) => {
      const offset = rowCount - 1 - idx;
      const index = length - 1 - offset;
      return {
        time: formatRelativeSample(offset),
        cpu: `${Math.round(series.cpu[index])}%`,
        memory: `${Math.round(series.memory[index])}%`,
        disk: `${Math.round(series.disk[index])}%`,
        network: `${Math.round(series.network[index])} Mbps`,
      };
    });
  }, [series]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Metrics Stream</p>
            <p className="text-xs text-muted-foreground mt-1">{rangeLabels[range]}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["1h", "24h", "7d"] as TimeRange[]).map((option) => (
              <Button
                key={option}
                size="sm"
                variant={range === option ? "default" : "outline"}
                onClick={() => setRange(option)}
              >
                {option}
              </Button>
            ))}
            <Button
              size="sm"
              variant={autoRefresh ? "default" : "outline"}
              onClick={() => setAutoRefresh((value) => !value)}
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${autoRefresh ? "animate-spin" : ""}`} />
              {autoRefresh ? "Live" : "Paused"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="grid lg:grid-cols-2 gap-6">
        {metricConfig.map((metric) => {
          const values = series[metric.key];
          const current = values[values.length - 1];
          const average = values.reduce((sum, value) => sum + value, 0) / values.length;
          const peak = Math.max(...values);

          return (
            <Card key={metric.key}>
              <CardHeader className="border-b border-border/70">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                      <metric.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle>{metric.title}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {Math.round(current)}
                        {metric.unit} current
                      </p>
                    </div>
                  </div>
                  {metric.warningAt && current >= metric.warningAt ? (
                    <Badge variant="destructive">High</Badge>
                  ) : (
                    <Badge variant="outline">Normal</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Sparkline data={values} color={metric.color} min={metric.min} max={metric.max} />
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <MetricStat label="Current" value={`${Math.round(current)}${metric.unit}`} />
                  <MetricStat label="Average" value={`${Math.round(average)}${metric.unit}`} />
                  <MetricStat label="Peak" value={`${Math.round(peak)}${metric.unit}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle>Latest Samples</CardTitle>
          <p className="text-sm text-muted-foreground">
            Recent data points from the metrics stream.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Time</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">CPU</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Memory</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Disk</th>
                  <th className="text-left py-2 pl-3 font-medium text-muted-foreground">Network</th>
                </tr>
              </thead>
              <tbody>
                {latestRows.map((row) => (
                  <tr key={row.time} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 text-muted-foreground">{row.time}</td>
                    <td className="py-2 px-3">{row.cpu}</td>
                    <td className="py-2 px-3">{row.memory}</td>
                    <td className="py-2 px-3">{row.disk}</td>
                    <td className="py-2 pl-3">{row.network}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-semibold mt-1">{value}</p>
    </div>
  );
}

function Sparkline({
  data,
  color,
  min,
  max,
}: {
  data: number[];
  color: string;
  min: number;
  max: number;
}) {
  const width = 620;
  const height = 180;
  const padding = 14;
  const range = Math.max(max - min, 1);
  const safeMax = Math.max(max, ...data);
  const safeMin = Math.min(min, ...data);
  const safeRange = Math.max(safeMax - safeMin, range);

  const points = data
    .map((value, index) => {
      const x = padding + (index * (width - padding * 2)) / (data.length - 1);
      const y =
        height - padding - ((value - safeMin) / safeRange) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const area = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40">
      <polygon points={area} fill={color} opacity={0.13} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function createInitialSeries(range: TimeRange): MetricSeries {
  const length = seriesLengthByRange[range];
  return {
    cpu: generateSeries(length, 38, 8, 20, 95),
    memory: generateSeries(length, 63, 6, 28, 98),
    disk: generateSeries(length, 56, 4, 18, 90),
    network: generateSeries(length, 94, 22, 20, 190),
  };
}

function generateSeries(
  length: number,
  baseline: number,
  variance: number,
  min: number,
  max: number
): number[] {
  const values: number[] = [];
  let current = baseline;
  for (let i = 0; i < length; i += 1) {
    const drift = (Math.random() - 0.5) * variance * 1.8;
    current = clamp(current + drift, min, max);
    values.push(Number(current.toFixed(2)));
  }
  return values;
}

function pushNextPoint(
  values: number[],
  baseline: number,
  variance: number,
  min: number,
  max: number
): number[] {
  const last = values[values.length - 1] ?? baseline;
  const meanPull = (baseline - last) * 0.08;
  const noise = (Math.random() - 0.5) * variance;
  const next = clamp(last + meanPull + noise, min, max);
  return [...values.slice(1), Number(next.toFixed(2))];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatRelativeSample(offset: number): string {
  if (offset === 0) return "Now";
  if (offset === 1) return "1 sample ago";
  return `${offset} samples ago`;
}
