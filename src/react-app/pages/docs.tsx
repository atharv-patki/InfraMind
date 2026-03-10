import { Link } from "react-router";
import { Button } from "@/react-app/components/ui/button";
import Navbar from "@/react-app/components/layout/Navbar";
import Footer from "@/react-app/components/layout/Footer";
import {
  BookOpen,
  ArrowRight,
  Rocket,
  Layers,
  Server,
  ShieldCheck,
  CircleCheck,
  Clock3,
} from "lucide-react";

const sections = [
  { id: "quick-start", label: "Quick Start" },
  { id: "architecture", label: "Architecture" },
  { id: "modules", label: "Dashboard Modules" },
  { id: "api-reference", label: "API Reference" },
  { id: "deployment", label: "Deployment" },
  { id: "security", label: "Security Notes" },
];

const modules = [
  {
    route: "/app/overview",
    name: "Overview",
    description: "Live summary of infrastructure health, usage trends, and active incidents.",
    status: "Ready",
  },
  {
    route: "/app/metrics",
    name: "Metrics",
    description: "CPU, memory, disk, and network visualizations with simulated real-time updates.",
    status: "Ready",
  },
  {
    route: "/app/infrastructure",
    name: "Infrastructure",
    description: "Server inventory with status, region, and uptime details.",
    status: "Ready",
  },
  {
    route: "/app/alerts",
    name: "Alerts",
    description: "Severity-based alert list with status tracking and incident history.",
    status: "Ready",
  },
  {
    route: "/app/autohealing",
    name: "Auto-Healing",
    description: "Rule-based response automation for common infrastructure failures.",
    status: "Ready",
  },
  {
    route: "/app/aiinsights",
    name: "AI Insights",
    description: "Anomaly flags, forecasting, and operational recommendations.",
    status: "Ready",
  },
  {
    route: "/app/settings",
    name: "Settings",
    description: "Profile, credentials, theme preferences, and API key management.",
    status: "Ready",
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
    title: "Alerts and Automation",
    endpoints: [
      "GET /api/alerts",
      "POST /api/alerts",
      "GET /api/automation/rules",
      "POST /api/automation/rules",
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

export default function Docs() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="relative pt-32 pb-16 overflow-hidden border-b border-border">
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="absolute top-1/3 left-1/4 w-80 h-80 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-72 h-72 rounded-full bg-accent/15 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Documentation</span>
            </div>

            <h1 className="mt-6 text-4xl sm:text-5xl font-bold tracking-tight">
              InfraMind AI
              <span className="block text-gradient">Product Documentation</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              Everything required to understand the platform architecture, frontend scope,
              planned APIs, and deployment path for a production-grade cloud monitoring SaaS.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <a href="#quick-start">
                <Button size="lg" className="bg-primary hover:bg-primary/90 h-12 px-8 text-base">
                  Read Quick Start
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </a>
              <Link to="/signup">
                <Button size="lg" variant="outline" className="h-12 px-8 text-base">
                  Start Free Trial
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[240px_1fr] gap-10 lg:gap-14">
            <aside className="hidden lg:block">
              <div className="sticky top-24 rounded-xl border border-border bg-card p-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">On this page</p>
                <nav className="mt-4 space-y-1">
                  {sections.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>

            <main className="space-y-8">
              <DocSection
                id="quick-start"
                title="Quick Start"
                icon={<Rocket className="w-5 h-5 text-primary" />}
              >
                <p className="text-muted-foreground leading-relaxed">
                  InfraMind AI currently ships with a full marketing site and frontend application
                  shell. Backend integration endpoints are defined and can be wired progressively.
                </p>
                <div className="mt-5 grid sm:grid-cols-3 gap-4">
                  <StepCard
                    step="01"
                    title="Install dependencies"
                    command="npm install"
                  />
                  <StepCard
                    step="02"
                    title="Run local app"
                    command="npm run dev"
                  />
                  <StepCard
                    step="03"
                    title="Create production build"
                    command="npm run build"
                  />
                </div>
              </DocSection>

              <DocSection
                id="architecture"
                title="Architecture"
                icon={<Layers className="w-5 h-5 text-primary" />}
              >
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="rounded-xl border border-border bg-card p-5">
                    <h3 className="font-semibold">Current Frontend Stack</h3>
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                      <li>React + Vite application shell</li>
                      <li>Tailwind-based design system</li>
                      <li>React Router for public and app routes</li>
                      <li>Recharts for monitoring visualizations</li>
                    </ul>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-5">
                    <h3 className="font-semibold">Current API and Runtime Stack</h3>
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                      <li>Cloudflare Worker REST API with typed contracts</li>
                      <li>D1-backed local and staging data workflows</li>
                      <li>Session auth with protected app routes</li>
                      <li>SSE-based metric and alert streams</li>
                    </ul>
                  </div>
                </div>
              </DocSection>

              <DocSection
                id="modules"
                title="Dashboard Modules"
                icon={<Server className="w-5 h-5 text-primary" />}
              >
                <div className="grid sm:grid-cols-2 gap-4">
                  {modules.map((module) => (
                    <article key={module.route} className="rounded-xl border border-border bg-card p-5">
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-semibold">{module.name}</p>
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs text-success">
                          <CircleCheck className="w-3.5 h-3.5" />
                          {module.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                        {module.description}
                      </p>
                      <p className="mt-3 text-xs font-mono text-primary">{module.route}</p>
                    </article>
                  ))}
                </div>
              </DocSection>

              <DocSection
                id="api-reference"
                title="API Reference (Planned)"
                icon={<Clock3 className="w-5 h-5 text-primary" />}
              >
                <p className="text-muted-foreground leading-relaxed">
                  These endpoints are the contract used to connect the frontend with backend services.
                  Route names are finalized to reduce future refactors.
                </p>
                <div className="mt-5 grid md:grid-cols-2 gap-4">
                  {apiGroups.map((group) => (
                    <div key={group.title} className="rounded-xl border border-border bg-card p-5">
                      <h3 className="font-semibold">{group.title}</h3>
                      <ul className="mt-3 space-y-2">
                        {group.endpoints.map((endpoint) => (
                          <li
                            key={endpoint}
                            className="rounded-md bg-secondary/70 px-3 py-2 font-mono text-xs text-foreground"
                          >
                            {endpoint}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </DocSection>

              <DocSection
                id="deployment"
                title="Deployment Guide"
                icon={<Rocket className="w-5 h-5 text-primary" />}
              >
                <p className="text-muted-foreground leading-relaxed">
                  InfraMind AI can be deployed as a static frontend with API services behind it.
                  Use the commands below for build and deployment workflows.
                </p>
                <pre className="mt-4 overflow-x-auto rounded-xl border border-border bg-card p-4 text-sm">
                  <code className="font-mono">
                    npm run build{"\n"}
                    npm run preview{"\n"}
                    wrangler deploy
                  </code>
                </pre>
              </DocSection>

              <DocSection
                id="security"
                title="Security Notes"
                icon={<ShieldCheck className="w-5 h-5 text-primary" />}
              >
                <div className="rounded-xl border border-border bg-card p-5">
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    <li>Use HTTP-only cookies for JWT tokens to minimize XSS token exposure.</li>
                    <li>Protect private `/app/*` routes with auth middleware and route guards.</li>
                    <li>Store API keys encrypted at rest and scope keys per environment.</li>
                    <li>Enable audit logs for alert changes and auto-healing rule execution.</li>
                  </ul>
                </div>
              </DocSection>
            </main>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function DocSection({
  id,
  title,
  icon,
  children,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-border bg-card/40 p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          {icon}
        </div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function StepCard({
  step,
  title,
  command,
}: {
  step: string;
  title: string;
  command: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold tracking-wider text-primary">{step}</p>
      <p className="mt-1 text-sm font-medium">{title}</p>
      <p className="mt-3 rounded-md bg-secondary px-3 py-2 font-mono text-xs">{command}</p>
    </div>
  );
}
