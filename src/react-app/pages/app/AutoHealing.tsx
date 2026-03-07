import { useMemo, useState } from "react";
import { Play, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Switch } from "@/react-app/components/ui/switch";
import { Badge } from "@/react-app/components/ui/badge";

type RuleItem = {
  id: string;
  name: string;
  trigger: string;
  action: string;
  cooldownMinutes: number;
  enabled: boolean;
  lastRun: string;
  successRate: number;
};

const initialRules: RuleItem[] = [
  {
    id: "rule-1",
    name: "Restart API Service on High CPU",
    trigger: "CPU > 90% for 5 minutes on prod-api-*",
    action: "Restart api service and flush worker queue",
    cooldownMinutes: 15,
    enabled: true,
    lastRun: "3 hours ago",
    successRate: 97,
  },
  {
    id: "rule-2",
    name: "Scale Worker Pool on Queue Spike",
    trigger: "Queue depth > 2000 for 3 minutes",
    action: "Add 2 worker replicas and rebalance queue consumers",
    cooldownMinutes: 20,
    enabled: true,
    lastRun: "12 hours ago",
    successRate: 93,
  },
  {
    id: "rule-3",
    name: "Clear Temp Logs on Disk Pressure",
    trigger: "Disk utilization > 92% on /var",
    action: "Archive and prune logs older than 7 days",
    cooldownMinutes: 60,
    enabled: false,
    lastRun: "5 days ago",
    successRate: 88,
  },
];

export default function AutoHealingPage() {
  const [rules, setRules] = useState<RuleItem[]>(initialRules);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("");
  const [action, setAction] = useState("");
  const [cooldownMinutes, setCooldownMinutes] = useState("15");
  const [error, setError] = useState("");

  const summary = useMemo(() => {
    const enabled = rules.filter((rule) => rule.enabled).length;
    const disabled = rules.length - enabled;
    const averageSuccess =
      rules.length === 0
        ? 0
        : Math.round(rules.reduce((sum, rule) => sum + rule.successRate, 0) / rules.length);
    return { enabled, disabled, averageSuccess };
  }, [rules]);

  const addRule = () => {
    const trimmedName = name.trim();
    const trimmedTrigger = trigger.trim();
    const trimmedAction = action.trim();
    const parsedCooldown = Number(cooldownMinutes);

    if (!trimmedName || !trimmedTrigger || !trimmedAction) {
      setError("Name, trigger, and action are required.");
      return;
    }
    if (Number.isNaN(parsedCooldown) || parsedCooldown <= 0) {
      setError("Cooldown must be a positive number.");
      return;
    }

    const newRule: RuleItem = {
      id: `rule-${Date.now()}`,
      name: trimmedName,
      trigger: trimmedTrigger,
      action: trimmedAction,
      cooldownMinutes: parsedCooldown,
      enabled: true,
      lastRun: "Never",
      successRate: 90,
    };

    setRules((prev) => [newRule, ...prev]);
    setName("");
    setTrigger("");
    setAction("");
    setCooldownMinutes("15");
    setError("");
  };

  const setRuleEnabled = (id: string, enabled: boolean) => {
    setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, enabled } : rule)));
  };

  const runRule = (id: string) => {
    setRules((prev) =>
      prev.map((rule) =>
        rule.id === id
          ? {
              ...rule,
              lastRun: "Just now",
              successRate: clamp(rule.successRate + randomInt(-2, 2), 70, 99),
            }
          : rule
      )
    );
  };

  const removeRule = (id: string) => {
    setRules((prev) => prev.filter((rule) => rule.id !== id));
  };

  return (
    <div className="space-y-6">
      <section className="grid sm:grid-cols-3 gap-4">
        <MiniStat label="Enabled Rules" value={summary.enabled.toString()} tone="success" />
        <MiniStat label="Disabled Rules" value={summary.disabled.toString()} tone="warning" />
        <MiniStat label="Avg Success Rate" value={`${summary.averageSuccess}%`} tone="primary" />
      </section>

      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle>Create Auto-Healing Rule</CardTitle>
          <p className="text-sm text-muted-foreground">
            Define trigger conditions and automated remediation actions.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <Input
              placeholder="Rule name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Input
              placeholder="Cooldown (minutes)"
              type="number"
              value={cooldownMinutes}
              onChange={(event) => setCooldownMinutes(event.target.value)}
            />
          </div>
          <Input
            placeholder="Trigger condition (e.g., CPU > 90% for 5m)"
            value={trigger}
            onChange={(event) => setTrigger(event.target.value)}
          />
          <Input
            placeholder="Action to execute"
            value={action}
            onChange={(event) => setAction(event.target.value)}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button onClick={addRule}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Rule
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle>Automation Rules</CardTitle>
          <p className="text-sm text-muted-foreground">
            Toggle, run, and manage remediation workflows.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {rules.map((rule) => (
            <article
              key={rule.id}
              className="rounded-xl border border-border bg-secondary/30 p-4"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h3 className="font-medium">{rule.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{rule.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  {rule.enabled ? (
                    <Badge className="bg-success/15 text-success hover:bg-success/20">
                      Enabled
                    </Badge>
                  ) : (
                    <Badge variant="outline">Disabled</Badge>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Active</span>
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(checked) => setRuleEnabled(rule.id, checked)}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-card border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Trigger</p>
                  <p className="mt-1">{rule.trigger}</p>
                </div>
                <div className="rounded-lg bg-card border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Action</p>
                  <p className="mt-1">{rule.action}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  Cooldown: {rule.cooldownMinutes} min • Last run: {rule.lastRun} • Success rate:{" "}
                  {rule.successRate}%
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => runRule(rule.id)}>
                    <Play className="w-4 h-4 mr-1.5" />
                    Run Now
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => removeRule(rule.id)}
                    aria-label={`Delete ${rule.name}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "primary";
}) {
  const toneClass: Record<typeof tone, string> = {
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning",
    primary: "bg-primary/15 text-primary",
  };

  return (
    <Card>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <span className={`h-8 px-3 rounded-lg text-sm font-medium inline-flex items-center ${toneClass[tone]}`}>
          {label}
        </span>
      </CardContent>
    </Card>
  );
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
