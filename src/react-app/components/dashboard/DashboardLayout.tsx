import { useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  BookOpen,
  Brain,
  ChevronRight,
  Clock4,
  LayoutDashboard,
  LineChart,
  Menu,
  LogOut,
  Settings,
  Server,
  WandSparkles,
  X,
} from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { Badge } from "@/react-app/components/ui/badge";
import { useAuth } from "@/react-app/context/AuthContext";
import { useAwsOps } from "@/react-app/context/AwsOpsContext";
import { GlobalOpsBanner } from "@/react-app/components/dashboard/GlobalOpsBanner";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { to: "/app/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/app/infrastructure", label: "Infrastructure", icon: Server },
  { to: "/app/metrics", label: "Metrics", icon: LineChart },
  { to: "/app/alerts", label: "Alerts", icon: Bell },
  { to: "/app/autohealing", label: "Auto-Healing", icon: WandSparkles },
  { to: "/app/aiinsights", label: "AI Insights", icon: Brain },
  { to: "/app/incidents", label: "Incidents", icon: Clock4 },
  { to: "/app/docs", label: "Docs", icon: BookOpen },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

const pageMeta: Record<string, { title: string; description: string }> = {
  "/app/overview": {
    title: "Infrastructure Overview",
    description: "Live health snapshot across compute, memory, and incidents.",
  },
  "/app/infrastructure": {
    title: "Infrastructure Inventory",
    description: "Track server health, region placement, and uptime.",
  },
  "/app/metrics": {
    title: "System Metrics",
    description: "Monitor CPU, memory, disk, and network behavior over time.",
  },
  "/app/alerts": {
    title: "Alert Management",
    description: "Review incident severity, status, and response progress.",
  },
  "/app/autohealing": {
    title: "Auto-Healing Rules",
    description: "Automate remediation actions for recurring infrastructure failures.",
  },
  "/app/aiinsights": {
    title: "AI Insights",
    description: "Analyze anomalies, forecasts, and AI-generated recommendations.",
  },
  "/app/incidents": {
    title: "Incident History",
    description: "Audit incident timelines, actions, and verification outcomes.",
  },
  "/app/docs": {
    title: "Platform Documentation",
    description: "Implementation guides, route references, and planned API contracts.",
  },
  "/app/settings": {
    title: "Workspace Settings",
    description: "Manage account details, security, notification preferences, and keys.",
  },
};

export default function DashboardLayout() {
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const { config } = useAwsOps();
  const displayName = user?.firstName ?? "User";

  const activePage = useMemo(() => {
    const match = Object.entries(pageMeta).find(([prefix]) =>
      pathname.startsWith(prefix)
    );
    return match?.[1] ?? pageMeta["/app/overview"];
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-72 flex-col border-r border-border bg-card">
          <SidebarContent />
        </aside>

        <div className="flex-1 lg:pl-72 min-w-0">
          <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
            <div className="h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="lg:hidden"
                  onClick={() => setMobileOpen(true)}
                  aria-label="Open sidebar"
                >
                  <Menu className="w-4 h-4" />
                </Button>
                <div className="min-w-0">
                  <h1 className="text-sm sm:text-base font-semibold truncate">
                    {activePage.title}
                  </h1>
                  <p className="text-xs text-muted-foreground truncate">
                    {activePage.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <Badge variant="secondary" className="inline-flex">
                  {displayName}
                </Badge>
                {config ? (
                  <Badge variant="outline" className="hidden sm:inline-flex">
                    {config.region}
                  </Badge>
                ) : null}
                <Badge variant="outline" className="hidden sm:inline-flex gap-1.5">
                  <span className="size-1.5 rounded-full bg-success" />
                  AWS Ops
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:inline-flex"
                  onClick={() => {
                    logout();
                  }}
                >
                  <LogOut className="w-4 h-4 mr-1.5" />
                  Sign Out
                </Button>
                <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                  <Link to="/app/docs">
                    <BookOpen className="w-4 h-4 mr-1.5" />
                    Docs
                  </Link>
                </Button>
              </div>
            </div>
          </header>

          <main className="p-4 sm:p-6 lg:p-8 space-y-4">
            <GlobalOpsBanner />
            <Outlet />
          </main>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/45"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-card border-r border-border">
            <div className="h-16 px-4 border-b border-border flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Activity className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold tracking-tight">InfraMind</span>
              </Link>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setMobileOpen(false)}
                aria-label="Close sidebar"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="h-16 px-5 border-b border-border flex items-center">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold leading-none">InfraMind AI</p>
            <p className="text-xs text-muted-foreground mt-1">Cloud Operations</p>
          </div>
        </Link>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        <div className="px-2 pb-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Dashboard
          </p>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`
              }
            >
              <span className="inline-flex items-center gap-2.5">
                <item.icon className="w-4 h-4" />
                {item.label}
              </span>
              <ChevronRight className="w-4 h-4 opacity-40 transition-opacity group-hover:opacity-80" />
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="p-4 border-t border-border">
        <div className="rounded-xl bg-secondary/70 p-3">
          <p className="text-sm font-medium">Need rollout help?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Review implementation docs and API contracts.
          </p>
          <Button asChild size="sm" variant="ghost" className="mt-2 px-0">
            <Link to="/app/docs">Open Documentation</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
