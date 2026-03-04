import { Link } from "react-router";
import { Button } from "@/react-app/components/ui/button";
import Navbar from "@/react-app/components/layout/Navbar";
import Footer from "@/react-app/components/layout/Footer";
import { 
  Activity, 
  Server, 
  Brain, 
  Bell, 
  Zap, 
  Shield,
  ArrowRight,
  CheckCircle2,
  BarChart3,
  Globe,
  Clock
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-50" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">AI-Powered Infrastructure Intelligence</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
              Monitor Your Cloud
              <span className="block text-gradient">With Intelligent Precision</span>
            </h1>
            
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              InfraMind AI combines real-time monitoring, anomaly detection, and predictive insights 
              to keep your infrastructure healthy and your team informed.
            </p>
            
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/signup">
                <Button size="lg" className="bg-primary hover:bg-primary/90 h-12 px-8 text-base glow">
                  Start Free Trial
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <Link to="/features">
                <Button size="lg" variant="outline" className="h-12 px-8 text-base">
                  See How It Works
                </Button>
              </Link>
            </div>

            <div className="mt-12 flex items-center justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>Free 14-day trial</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>No credit card required</span>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>Setup in minutes</span>
              </div>
            </div>
          </div>

          {/* Dashboard Preview */}
          <div className="mt-20 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none" />
            <div className="rounded-xl border border-border bg-card shadow-2xl overflow-hidden glow">
              <div className="p-4 border-b border-border flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-destructive/60" />
                <div className="w-3 h-3 rounded-full bg-warning/60" />
                <div className="w-3 h-3 rounded-full bg-success/60" />
                <span className="ml-4 text-xs text-muted-foreground font-mono">dashboard.inframind.ai</span>
              </div>
              <div className="p-6 bg-gradient-to-br from-card to-secondary/30">
                <DashboardPreview />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 border-y border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatItem value="99.99%" label="Uptime SLA" />
            <StatItem value="<50ms" label="Alert Latency" />
            <StatItem value="10K+" label="Servers Monitored" />
            <StatItem value="500+" label="Happy Teams" />
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Everything You Need to Monitor
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Comprehensive monitoring tools designed for modern cloud infrastructure.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Server className="w-5 h-5" />}
              title="Infrastructure Monitoring"
              description="Track CPU, memory, disk, and network across all your servers with real-time visibility."
            />
            <FeatureCard
              icon={<Brain className="w-5 h-5" />}
              title="AI Anomaly Detection"
              description="Machine learning algorithms detect unusual patterns before they become incidents."
            />
            <FeatureCard
              icon={<Bell className="w-5 h-5" />}
              title="Smart Alerting"
              description="Intelligent alerts with context-aware routing and automatic escalation policies."
            />
            <FeatureCard
              icon={<Zap className="w-5 h-5" />}
              title="Auto-Healing"
              description="Define automated remediation rules that execute when specific conditions are met."
            />
            <FeatureCard
              icon={<BarChart3 className="w-5 h-5" />}
              title="Predictive Insights"
              description="Forecast resource utilization and capacity needs before they impact performance."
            />
            <FeatureCard
              icon={<Shield className="w-5 h-5" />}
              title="Security Monitoring"
              description="Continuous security posture assessment and threat detection across your stack."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl" />
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Ready to Transform Your Monitoring?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            Join hundreds of teams using InfraMind AI to keep their infrastructure running smoothly.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup">
              <Button size="lg" className="bg-primary hover:bg-primary/90 h-12 px-8 text-base">
                Get Started Free
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="outline" className="h-12 px-8 text-base">
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl sm:text-4xl font-bold text-gradient">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="group p-6 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-300">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
        {icon}
      </div>
      <h3 className="mt-4 font-semibold text-lg">{title}</h3>
      <p className="mt-2 text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {/* Stat Cards */}
      <div className="p-4 rounded-lg bg-background border border-border">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">CPU Usage</span>
          <Activity className="w-3 h-3 text-primary" />
        </div>
        <div className="mt-2 text-2xl font-bold">42%</div>
        <div className="mt-1 text-xs text-success">↓ 3% from last hour</div>
      </div>
      <div className="p-4 rounded-lg bg-background border border-border">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Memory</span>
          <Server className="w-3 h-3 text-accent" />
        </div>
        <div className="mt-2 text-2xl font-bold">67%</div>
        <div className="mt-1 text-xs text-warning">↑ 5% from last hour</div>
      </div>
      <div className="p-4 rounded-lg bg-background border border-border">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Servers</span>
          <Globe className="w-3 h-3 text-chart-3" />
        </div>
        <div className="mt-2 text-2xl font-bold">24</div>
        <div className="mt-1 text-xs text-success">All healthy</div>
      </div>
      <div className="p-4 rounded-lg bg-background border border-border">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Response</span>
          <Clock className="w-3 h-3 text-chart-4" />
        </div>
        <div className="mt-2 text-2xl font-bold">45ms</div>
        <div className="mt-1 text-xs text-muted-foreground">avg latency</div>
      </div>
      
      {/* Chart placeholder */}
      <div className="col-span-3 p-4 rounded-lg bg-background border border-border">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium">System Performance</span>
          <span className="text-xs text-muted-foreground">Last 24 hours</span>
        </div>
        <div className="h-32 flex items-end gap-1">
          {[40, 55, 35, 60, 45, 70, 50, 65, 55, 75, 60, 80, 55, 70, 45, 60, 50, 65, 55, 70, 60, 75, 65, 80].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-gradient-to-t from-primary/60 to-primary"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
      
      {/* Alerts preview */}
      <div className="p-4 rounded-lg bg-background border border-border">
        <span className="text-sm font-medium">Active Alerts</span>
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-warning" />
            <span className="text-xs">High CPU</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success" />
            <span className="text-xs">Disk OK</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success" />
            <span className="text-xs">Network OK</span>
          </div>
        </div>
      </div>
    </div>
  );
}
