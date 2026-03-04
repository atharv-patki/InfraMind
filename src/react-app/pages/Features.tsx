import { Link } from "react-router";
import { Button } from "@/react-app/components/ui/button";
import Navbar from "@/react-app/components/layout/Navbar";
import Footer from "@/react-app/components/layout/Footer";
import {
  Brain,
  Bell,
  Zap,
  BarChart3,
  Shield,
  ArrowRight,
  Cpu,
  HardDrive,
  Network,
  Activity,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Eye,
  Clock,
  Globe,
  Lock,
  Layers,
  GitBranch,
  Terminal,
  Database
} from "lucide-react";

export default function Features() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              Powerful Features for
              <span className="block text-gradient">Modern Infrastructure</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              Everything you need to monitor, analyze, and optimize your cloud infrastructure 
              with AI-powered intelligence.
            </p>
          </div>
        </div>
      </section>

      {/* Infrastructure Monitoring */}
      <FeatureSection
        badge="Core Monitoring"
        title="Complete Infrastructure Visibility"
        description="Get real-time insights into every layer of your infrastructure with comprehensive metrics collection and visualization."
        features={[
          { icon: <Cpu className="w-5 h-5" />, title: "CPU Monitoring", description: "Track processor utilization, load averages, and per-core performance across all your servers." },
          { icon: <HardDrive className="w-5 h-5" />, title: "Memory & Disk", description: "Monitor RAM usage, swap activity, disk I/O, and storage capacity with trend analysis." },
          { icon: <Network className="w-5 h-5" />, title: "Network Traffic", description: "Analyze bandwidth usage, packet loss, latency, and connection states in real-time." },
          { icon: <Activity className="w-5 h-5" />, title: "Custom Metrics", description: "Collect and visualize any metric from your applications using our flexible agent." },
        ]}
        visual={<MetricsVisual />}
      />

      {/* AI Anomaly Detection */}
      <FeatureSection
        badge="AI-Powered"
        title="Intelligent Anomaly Detection"
        description="Machine learning algorithms continuously analyze your metrics to detect unusual patterns before they become incidents."
        features={[
          { icon: <Brain className="w-5 h-5" />, title: "Pattern Learning", description: "Our AI learns the normal behavior of your systems and adapts to seasonal variations." },
          { icon: <AlertTriangle className="w-5 h-5" />, title: "Proactive Alerts", description: "Get notified about anomalies before they impact your users or services." },
          { icon: <TrendingUp className="w-5 h-5" />, title: "Root Cause Analysis", description: "Automatically correlate anomalies across services to identify the source of issues." },
          { icon: <Eye className="w-5 h-5" />, title: "Visual Insights", description: "See exactly where and when anomalies occur with clear visualization overlays." },
        ]}
        visual={<AnomalyVisual />}
        reversed
      />

      {/* Smart Alerting */}
      <FeatureSection
        badge="Alerting"
        title="Smart Alert Management"
        description="Reduce alert fatigue with intelligent routing, deduplication, and context-aware notifications."
        features={[
          { icon: <Bell className="w-5 h-5" />, title: "Multi-Channel Alerts", description: "Send alerts via email, Slack, PagerDuty, webhooks, and more with custom routing rules." },
          { icon: <Clock className="w-5 h-5" />, title: "Alert Scheduling", description: "Configure quiet hours, escalation policies, and on-call rotations." },
          { icon: <Layers className="w-5 h-5" />, title: "Alert Grouping", description: "Automatically group related alerts to reduce noise and improve context." },
          { icon: <GitBranch className="w-5 h-5" />, title: "Escalation Chains", description: "Define multi-level escalation paths with automatic acknowledgment tracking." },
        ]}
        visual={<AlertsVisual />}
      />

      {/* Auto-Healing */}
      <FeatureSection
        badge="Automation"
        title="Automated Remediation"
        description="Define rules that automatically respond to incidents, reducing mean time to recovery."
        features={[
          { icon: <Zap className="w-5 h-5" />, title: "Trigger Actions", description: "Execute scripts, restart services, or scale resources when specific conditions are met." },
          { icon: <RefreshCw className="w-5 h-5" />, title: "Self-Healing Rules", description: "Create automated playbooks for common issues that resolve themselves." },
          { icon: <Terminal className="w-5 h-5" />, title: "Custom Scripts", description: "Run custom remediation scripts with full audit logging and approval workflows." },
          { icon: <Shield className="w-5 h-5" />, title: "Safe Execution", description: "Built-in safeguards prevent automation loops and require confirmation for critical actions." },
        ]}
        visual={<AutoHealingVisual />}
        reversed
      />

      {/* Predictive Insights */}
      <FeatureSection
        badge="Forecasting"
        title="Predictive Resource Planning"
        description="Use AI to forecast resource needs and optimize capacity before problems arise."
        features={[
          { icon: <BarChart3 className="w-5 h-5" />, title: "Capacity Forecasting", description: "Predict when you'll run out of disk space, memory, or compute capacity." },
          { icon: <TrendingUp className="w-5 h-5" />, title: "Cost Optimization", description: "Identify underutilized resources and get recommendations for right-sizing." },
          { icon: <Database className="w-5 h-5" />, title: "Growth Planning", description: "Model different growth scenarios to plan infrastructure investments." },
          { icon: <Clock className="w-5 h-5" />, title: "Trend Analysis", description: "Visualize long-term trends and seasonality in your infrastructure usage." },
        ]}
        visual={<PredictiveVisual />}
      />

      {/* Security Monitoring */}
      <FeatureSection
        badge="Security"
        title="Security & Compliance"
        description="Continuous security monitoring with threat detection and compliance reporting."
        features={[
          { icon: <Shield className="w-5 h-5" />, title: "Threat Detection", description: "Detect suspicious activity, unauthorized access attempts, and security anomalies." },
          { icon: <Lock className="w-5 h-5" />, title: "Access Control", description: "Role-based access control with audit logging for all user actions." },
          { icon: <Globe className="w-5 h-5" />, title: "Compliance Reports", description: "Generate SOC 2, HIPAA, and PCI-DSS compliance reports automatically." },
          { icon: <Eye className="w-5 h-5" />, title: "Vulnerability Scanning", description: "Continuous scanning for known vulnerabilities across your infrastructure." },
        ]}
        visual={<SecurityVisual />}
        reversed
      />

      {/* CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            See All Features in Action
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Start your free trial and explore every feature with your own infrastructure.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup">
              <Button size="lg" className="bg-primary hover:bg-primary/90 h-12 px-8 text-base">
                Start Free Trial
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

interface FeatureSectionProps {
  badge: string;
  title: string;
  description: string;
  features: Array<{ icon: React.ReactNode; title: string; description: string }>;
  visual: React.ReactNode;
  reversed?: boolean;
}

function FeatureSection({ badge, title, description, features, visual, reversed }: FeatureSectionProps) {
  return (
    <section className="py-20 border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`grid lg:grid-cols-2 gap-12 lg:gap-16 items-center ${reversed ? 'lg:flex-row-reverse' : ''}`}>
          <div className={reversed ? 'lg:order-2' : ''}>
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
              <span className="text-xs font-medium text-primary">{badge}</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">{description}</p>
            
            <div className="mt-8 grid sm:grid-cols-2 gap-6">
              {features.map((feature, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{feature.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className={reversed ? 'lg:order-1' : ''}>
            {visual}
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricsVisual() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <span className="font-medium">System Metrics</span>
        <span className="text-xs text-muted-foreground">Live</span>
      </div>
      <div className="space-y-4">
        <MetricBar label="CPU" value={42} color="bg-primary" />
        <MetricBar label="Memory" value={67} color="bg-accent" />
        <MetricBar label="Disk" value={34} color="bg-chart-3" />
        <MetricBar label="Network" value={58} color="bg-chart-4" />
      </div>
    </div>
  );
}

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function AnomalyVisual() {
  const data = [30, 32, 28, 35, 33, 31, 29, 34, 32, 68, 45, 35, 33, 30, 32];
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <span className="font-medium">Anomaly Detection</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning">1 Detected</span>
      </div>
      <div className="h-40 flex items-end gap-1">
        {data.map((h, i) => (
          <div
            key={i}
            className={`flex-1 rounded-t transition-all ${i === 9 ? 'bg-warning glow-accent' : 'bg-primary/60'}`}
            style={{ height: `${h * 1.5}%` }}
          />
        ))}
      </div>
      <div className="mt-4 p-3 rounded-lg bg-warning/10 border border-warning/20">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <span className="text-sm font-medium">Spike detected at 14:32</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">CPU usage jumped to 68% - unusual for this time</p>
      </div>
    </div>
  );
}

function AlertsVisual() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <span className="font-medium">Active Alerts</span>
        <span className="text-xs text-muted-foreground">3 total</span>
      </div>
      <div className="space-y-3">
        <AlertItem severity="critical" title="Database connection timeout" time="2m ago" />
        <AlertItem severity="warning" title="High memory usage on prod-web-03" time="15m ago" />
        <AlertItem severity="info" title="Deployment completed successfully" time="1h ago" />
      </div>
    </div>
  );
}

function AlertItem({ severity, title, time }: { severity: 'critical' | 'warning' | 'info'; title: string; time: string }) {
  const colors = {
    critical: 'bg-destructive',
    warning: 'bg-warning',
    info: 'bg-primary'
  };
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
      <div className={`w-2 h-2 rounded-full mt-1.5 ${colors[severity]}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground">{time}</p>
      </div>
    </div>
  );
}

function AutoHealingVisual() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <span className="font-medium">Automation Rules</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-success/20 text-success">Active</span>
      </div>
      <div className="space-y-3">
        <RuleItem 
          trigger="CPU > 90% for 5min" 
          action="Restart service" 
          lastRun="Yesterday" 
        />
        <RuleItem 
          trigger="Memory > 85%" 
          action="Clear cache" 
          lastRun="3 days ago" 
        />
        <RuleItem 
          trigger="Disk > 95%" 
          action="Archive old logs" 
          lastRun="1 week ago" 
        />
      </div>
    </div>
  );
}

function RuleItem({ trigger, action, lastRun }: { trigger: string; action: string; lastRun: string }) {
  return (
    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">If</span>
        <span className="font-mono text-xs px-2 py-0.5 rounded bg-card">{trigger}</span>
      </div>
      <div className="flex items-center gap-2 text-sm mt-1">
        <span className="text-muted-foreground">Then</span>
        <span className="font-medium text-primary">{action}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">Last triggered: {lastRun}</p>
    </div>
  );
}

function PredictiveVisual() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <span className="font-medium">Capacity Forecast</span>
        <span className="text-xs text-muted-foreground">Next 30 days</span>
      </div>
      <div className="space-y-4">
        <ForecastItem resource="Disk Space" current="340 GB" forecast="Will reach 90% in 12 days" status="warning" />
        <ForecastItem resource="Memory" current="67%" forecast="Stable - no action needed" status="healthy" />
        <ForecastItem resource="Compute" current="42%" forecast="Consider scaling down" status="optimize" />
      </div>
    </div>
  );
}

function ForecastItem({ resource, current, forecast, status }: { resource: string; current: string; forecast: string; status: 'warning' | 'healthy' | 'optimize' }) {
  const statusColors = {
    warning: 'text-warning',
    healthy: 'text-success',
    optimize: 'text-primary'
  };
  return (
    <div className="p-3 rounded-lg bg-secondary/50">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{resource}</span>
        <span className="font-mono text-sm">{current}</span>
      </div>
      <p className={`text-xs mt-1 ${statusColors[status]}`}>{forecast}</p>
    </div>
  );
}

function SecurityVisual() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <span className="font-medium">Security Overview</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-success/20 text-success">Secure</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SecurityStat label="Vulnerabilities" value="0" status="good" />
        <SecurityStat label="Failed Logins" value="3" status="neutral" />
        <SecurityStat label="Compliance" value="98%" status="good" />
        <SecurityStat label="Last Scan" value="2h ago" status="neutral" />
      </div>
      <div className="mt-4 p-3 rounded-lg bg-success/10 border border-success/20">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-success" />
          <span className="text-sm font-medium">All systems secure</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">No threats detected in the last 24 hours</p>
      </div>
    </div>
  );
}

function SecurityStat({ label, value, status }: { label: string; value: string; status: 'good' | 'neutral' }) {
  return (
    <div className="p-3 rounded-lg bg-secondary/50 text-center">
      <p className={`text-xl font-bold ${status === 'good' ? 'text-success' : ''}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
