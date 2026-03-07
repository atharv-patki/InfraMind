import { Link } from "react-router";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Rocket,
  Server,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Badge } from "@/react-app/components/ui/badge";
import { Button } from "@/react-app/components/ui/button";

const modules = [
  {
    route: "/app/overview",
    name: "Overview",
    description: "Live summary of infrastructure health, usage trends, and active incidents.",
  },
  {
    route: "/app/metrics",
    name: "Metrics",
    description: "CPU, memory, disk, and network charts with real-time style updates.",
  },
  {
    route: "/app/infrastructure",
    name: "Infrastructure",
    description: "Server inventory with region, uptime, and status monitoring.",
  },
  {
    route: "/app/alerts",
    name: "Alerts",
    description: "Severity-based incident tracking and response status management.",
  },
  {
    route: "/app/autohealing",
    name: "Auto-Healing",
    description: "Rule-based automation for repetitive infrastructure incidents.",
  },
  {
    route: "/app/aiinsights",
    name: "AI Insights",
    description: "Anomaly detection summaries, predictive trends, and recommendations.",
  },
  {
    route: "/app/settings",
    name: "Settings",
    description: "User profile, security controls, preferences, and API key management.",
  },
];

const apiGroups = [
  {
    title: "Authentication",
    endpoints: [
      "POST /api/auth/register",
      "POST /api/auth/login",
      "POST /api/auth/logout",
      "GET /api/auth/me",
    ],
  },
  {
    title: "Metrics",
    endpoints: [
      "GET /api/metrics/cpu",
      "GET /api/metrics/memory",
      "GET /api/metrics/disk",
      "GET /api/metrics/network",
    ],
  },
  {
    title: "Infrastructure and Alerts",
    endpoints: [
      "GET /api/servers",
      "GET /api/alerts",
      "POST /api/alerts",
      "PUT /api/alerts/:id",
    ],
  },
  {
    title: "AI Services",
    endpoints: [
      "GET /api/ai/anomalies",
      "GET /api/ai/predictions",
      "GET /api/ai/recommendations",
    ],
  },
];

export default function AppDocsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-1">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5">
                <BookOpen className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-primary">In-App Docs</span>
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                InfraMind Dashboard Documentation
              </h2>
              <p className="mt-2 text-sm text-muted-foreground max-w-3xl">
                Product references for signed-in users. Use this page to navigate features,
                verify route scope, and track backend API contracts without leaving the app.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/app/overview">
                  Open Overview
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/app/settings">Workspace Settings</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle className="flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" />
            Dashboard Modules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {modules.map((module) => (
              <article key={module.route} className="rounded-xl border border-border bg-secondary/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{module.name}</p>
                  <Badge variant="outline" className="gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                    Ready
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{module.description}</p>
                <Link to={module.route} className="mt-3 inline-flex text-xs font-mono text-primary hover:underline">
                  {module.route}
                </Link>
              </article>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-primary" />
            Backend API Contract (Planned)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          {apiGroups.map((group) => (
            <article key={group.title} className="rounded-xl border border-border bg-secondary/30 p-4">
              <p className="font-medium">{group.title}</p>
              <ul className="mt-3 space-y-2">
                {group.endpoints.map((endpoint) => (
                  <li key={endpoint} className="rounded-md bg-card px-3 py-2 font-mono text-xs">
                    {endpoint}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Security and Access Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Keep dashboard routes protected under `/app/*` with session checks.</li>
            <li>Store auth tokens in secure, HTTP-only cookies.</li>
            <li>Rotate API keys periodically and revoke unused integrations.</li>
            <li>Track alert rule changes and automation actions with audit logs.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
