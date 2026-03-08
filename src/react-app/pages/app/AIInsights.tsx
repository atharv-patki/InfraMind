import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Brain,
  CircleAlert,
  Lightbulb,
  ShieldAlert,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Badge } from "@/react-app/components/ui/badge";
import { Button } from "@/react-app/components/ui/button";
import {
  getAIAnomalies,
  getAIPredictions,
  getAIRecommendations,
  updateAIRecommendation,
  type AIRecommendation as Recommendation,
  type AISystemAnomaly as Anomaly,
  type AISeverity as Severity,
} from "@/react-app/lib/api";

export default function AIInsightsPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [forecastPoints, setForecastPoints] = useState<number[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadAIData = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError("");
      const [nextAnomalies, nextPredictions, nextRecommendations] = await Promise.all([
        getAIAnomalies(),
        getAIPredictions(),
        getAIRecommendations(),
      ]);
      setAnomalies(nextAnomalies);
      setForecastPoints(nextPredictions);
      setRecommendations(nextRecommendations);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load AI insights.";
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAIData();
  }, [loadAIData]);

  const completed = useMemo(
    () => recommendations.filter((item) => item.done).length,
    [recommendations]
  );

  const highestRisk = useMemo(
    () => anomalies.reduce((max, item) => (item.confidence > max ? item.confidence : max), 0),
    [anomalies]
  );

  const toggleRecommendation = async (id: string) => {
    const target = recommendations.find((item) => item.id === id);
    if (!target) return;

    try {
      await updateAIRecommendation(id, !target.done);
      setRecommendations((prev) =>
        prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to update recommendation.";
      setLoadError(message);
    }
  };

  return (
    <div className="space-y-6">
      {loadError ? (
        <Card>
          <CardContent className="py-4 flex items-center justify-between gap-3">
            <p className="text-sm text-destructive">{loadError}</p>
            <Button size="sm" variant="outline" onClick={() => void loadAIData()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <InsightStat
          label="Anomalies Detected"
          value={`${anomalies.length}`}
          helper="Last 24h"
          icon={<CircleAlert className="w-4 h-4" />}
          tone="warning"
        />
        <InsightStat
          label="Highest Risk Score"
          value={`${highestRisk}%`}
          helper="Model confidence"
          icon={<ShieldAlert className="w-4 h-4" />}
          tone="critical"
        />
        <InsightStat
          label="Recommendations"
          value={`${recommendations.length}`}
          helper={`${completed} implemented`}
          icon={<Lightbulb className="w-4 h-4" />}
          tone="primary"
        />
        <InsightStat
          label="Forecast Window"
          value="30 days"
          helper="Capacity outlook"
          icon={<TrendingUp className="w-4 h-4" />}
          tone="success"
        />
      </section>

      <section className="grid xl:grid-cols-[1.3fr_1fr] gap-6">
        <Card>
          <CardHeader className="border-b border-border/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Anomaly Detection Summary</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Real-time model outputs with confidence levels and impact notes.
                </p>
              </div>
              <Badge className="bg-primary/15 text-primary hover:bg-primary/20">
                <Brain className="w-3.5 h-3.5 mr-1" />
                AI Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="rounded-xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
                Loading anomaly data...
              </div>
            ) : anomalies.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.metric}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.service} • {item.id}
                    </p>
                  </div>
                  <SeverityBadge severity={item.severity} />
                </div>
                <p className="text-sm text-muted-foreground">{item.summary}</p>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Confidence</span>
                    <span className="font-medium">{item.confidence}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-card border border-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${item.confidence}%` }}
                    />
                  </div>
                </div>
              </article>
            ))}
            {!isLoading && anomalies.length === 0 ? (
              <div className="rounded-xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
                No anomalies detected.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/70">
            <CardTitle>Capacity Forecast</CardTitle>
            <p className="text-sm text-muted-foreground">
              Predicted cluster utilization trajectory based on trend models.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ForecastChart points={forecastPoints} />
            <div className="rounded-xl border border-border bg-secondary/30 p-3 text-sm">
              <p className="font-medium">Forecast insight</p>
              <p className="text-muted-foreground mt-1">
                Compute capacity may exceed 90% within 12 days if current growth continues.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle>Suggested Actions</CardTitle>
          <p className="text-sm text-muted-foreground">
            AI-prioritized recommendations to reduce risk and improve performance.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="rounded-xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
              Loading recommendations...
            </div>
          ) : recommendations.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-border bg-secondary/30 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className={`font-medium ${item.done ? "line-through text-muted-foreground" : ""}`}>
                    {item.title}
                  </p>
                  <SeverityBadge severity={item.priority} />
                </div>
                <p className="text-sm text-muted-foreground mt-1">{item.impact}</p>
              </div>
              <Button
                size="sm"
                variant={item.done ? "outline" : "default"}
                onClick={() => toggleRecommendation(item.id)}
              >
                <Zap className="w-4 h-4 mr-1.5" />
                {item.done ? "Undo" : "Mark Implemented"}
              </Button>
            </article>
          ))}
          {!isLoading && recommendations.length === 0 ? (
            <div className="rounded-xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
              No recommendations available.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function InsightStat({
  label,
  value,
  helper,
  icon,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  tone: "primary" | "success" | "warning" | "critical";
}) {
  const toneClass: Record<typeof tone, string> = {
    primary: "bg-primary/15 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning",
    critical: "bg-destructive/15 text-destructive",
  };

  return (
    <Card>
      <CardContent className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        </div>
        <span className={`w-9 h-9 rounded-lg inline-flex items-center justify-center ${toneClass[tone]}`}>
          {icon}
        </span>
      </CardContent>
    </Card>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  if (severity === "High") {
    return <Badge variant="destructive">High</Badge>;
  }
  if (severity === "Medium") {
    return <Badge className="bg-warning/20 text-warning hover:bg-warning/25">Medium</Badge>;
  }
  return <Badge className="bg-primary/15 text-primary hover:bg-primary/20">Low</Badge>;
}

function ForecastChart({ points }: { points: number[] }) {
  if (points.length === 0) {
    return (
      <div className="h-44 rounded-xl border border-border bg-secondary/30 flex items-center justify-center text-sm text-muted-foreground">
        No forecast data
      </div>
    );
  }

  const width = 620;
  const height = 190;
  const padding = 14;
  const min = Math.min(...points) - 4;
  const max = Math.max(...points) + 2;
  const range = Math.max(max - min, 1);

  const polyline = points
    .map((value, index) => {
      const x = padding + (index * (width - padding * 2)) / (points.length - 1);
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const area = `${padding},${height - padding} ${polyline} ${width - padding},${height - padding}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44">
      <polygon points={area} fill="hsl(var(--chart-2))" opacity={0.16} />
      <polyline
        points={polyline}
        fill="none"
        stroke="hsl(var(--chart-2))"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1={padding}
        y1={height - padding - ((90 - min) / range) * (height - padding * 2)}
        x2={width - padding}
        y2={height - padding - ((90 - min) / range) * (height - padding * 2)}
        stroke="hsl(var(--destructive))"
        strokeDasharray="5 6"
        opacity={0.75}
      />
    </svg>
  );
}
