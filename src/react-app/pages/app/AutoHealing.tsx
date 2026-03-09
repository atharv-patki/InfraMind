import { useCallback, useEffect, useMemo, useState } from "react";
import { Play, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Switch } from "@/react-app/components/ui/switch";
import { Badge } from "@/react-app/components/ui/badge";
import { Checkbox } from "@/react-app/components/ui/checkbox";
import { DataStateCard } from "@/react-app/components/dashboard/DataStateCard";
import { ConfirmActionDialog } from "@/react-app/components/dashboard/ConfirmActionDialog";
import { PageSkeleton } from "@/react-app/components/dashboard/PageSkeleton";
import { useAwsOps } from "@/react-app/context/AwsOpsContext";
import { useToast } from "@/react-app/context/ToastContext";
import {
  createPlaybook,
  deletePlaybook,
  getPlaybooks,
  runPlaybook,
  updatePlaybookEnabled,
} from "@/react-app/lib/aws-api";
import type { RecoveryActionType, RecoveryPlaybook } from "@/react-app/lib/aws-contracts";

const recoveryActions: RecoveryActionType[] = ["restart", "scale", "redeploy", "failover"];

export default function AutoHealingPage() {
  const { config, isLoading: isConfigLoading } = useAwsOps();
  const { pushToast } = useToast();

  const [playbooks, setPlaybooks] = useState<RecoveryPlaybook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RecoveryPlaybook | null>(null);

  const [name, setName] = useState("");
  const [triggerCondition, setTriggerCondition] = useState("");
  const [selectedActions, setSelectedActions] = useState<RecoveryActionType[]>(["restart"]);
  const [cooldownSeconds, setCooldownSeconds] = useState("300");
  const [verificationWindowSeconds, setVerificationWindowSeconds] = useState("90");
  const [escalationTarget, setEscalationTarget] = useState("Platform SRE On-call");
  const [formError, setFormError] = useState("");

  const loadPlaybooks = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      const data = await getPlaybooks();
      setPlaybooks(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load playbooks.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!config) return;
    if (config.connectionStatus === "disconnected" || config.connectionStatus === "permission_denied") {
      return;
    }
    void loadPlaybooks();
  }, [config, loadPlaybooks]);

  const summary = useMemo(() => {
    const enabled = playbooks.filter((playbook) => playbook.enabled).length;
    const disabled = playbooks.length - enabled;
    const averageSuccess =
      playbooks.length === 0
        ? 0
        : Math.round(
            playbooks.reduce((sum, playbook) => sum + playbook.successRate, 0) / playbooks.length
          );
    return { enabled, disabled, averageSuccess };
  }, [playbooks]);

  const handleActionToggle = (action: RecoveryActionType, checked: boolean) => {
    setSelectedActions((prev) => {
      if (checked) {
        return prev.includes(action) ? prev : [...prev, action];
      }
      return prev.filter((item) => item !== action);
    });
  };

  const handleCreate = async () => {
    const parsedCooldown = Number(cooldownSeconds);
    const parsedVerification = Number(verificationWindowSeconds);

    if (!name.trim() || !triggerCondition.trim()) {
      setFormError("Playbook name and trigger condition are required.");
      return;
    }
    if (selectedActions.length === 0) {
      setFormError("Select at least one recovery action.");
      return;
    }
    if (!Number.isFinite(parsedCooldown) || parsedCooldown <= 0) {
      setFormError("Cooldown must be a positive number of seconds.");
      return;
    }
    if (!Number.isFinite(parsedVerification) || parsedVerification <= 0) {
      setFormError("Verification window must be a positive number of seconds.");
      return;
    }

    try {
      setIsSaving(true);
      setFormError("");
      const created = await createPlaybook({
        name,
        triggerCondition,
        actions: selectedActions,
        cooldownSeconds: parsedCooldown,
        verificationWindowSeconds: parsedVerification,
        escalationTarget,
      });
      setPlaybooks((prev) => [created, ...prev]);
      setName("");
      setTriggerCondition("");
      setSelectedActions(["restart"]);
      setCooldownSeconds("300");
      setVerificationWindowSeconds("90");
      setEscalationTarget("Platform SRE On-call");
      pushToast("Playbook created.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create playbook.";
      setFormError(message);
      pushToast(message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleEnabled = useCallback(
    async (playbook: RecoveryPlaybook, enabled: boolean) => {
      try {
        await updatePlaybookEnabled({ playbookId: playbook.id, enabled });
        setPlaybooks((prev) =>
          prev.map((item) => (item.id === playbook.id ? { ...item, enabled } : item))
        );
        pushToast(`${playbook.name} ${enabled ? "enabled" : "disabled"}.`, "success");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to update playbook.";
        setError(message);
        pushToast(message, "error");
      }
    },
    [pushToast]
  );

  const triggerRun = useCallback(
    async (playbook: RecoveryPlaybook) => {
      try {
        await runPlaybook(playbook.id);
        pushToast(`Playbook "${playbook.name}" started.`, "info");
        await loadPlaybooks();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to run playbook.";
        setError(message);
        pushToast(message, "error");
      }
    },
    [loadPlaybooks, pushToast]
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deletePlaybook(deleteTarget.id);
      setPlaybooks((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      pushToast(`Deleted playbook "${deleteTarget.name}".`, "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete playbook.";
      setError(message);
      pushToast(message, "error");
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, pushToast]);

  if (isConfigLoading || !config) {
    return (
      <DataStateCard
        state="loading"
        title="Loading playbook context"
        detail="Checking AWS integration before loading auto-healing."
      />
    );
  }

  if (config.connectionStatus === "disconnected") {
    return (
      <DataStateCard
        state="disconnected"
        title="AWS account is disconnected"
        detail="Connect AWS account to create auto-healing playbooks."
      />
    );
  }

  if (config.connectionStatus === "permission_denied") {
    return (
      <DataStateCard
        state="permission"
        title="Insufficient IAM permission"
        detail="Playbooks require execution permissions for target services."
      />
    );
  }

  if (isLoading) {
    return <PageSkeleton cards={3} rows={5} />;
  }

  if (error) {
    return (
      <DataStateCard
        state="error"
        title="Auto-healing unavailable"
        detail={error}
        onRetry={() => void loadPlaybooks()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Enabled Playbooks" value={`${summary.enabled}`} tone="success" />
        <StatCard label="Disabled Playbooks" value={`${summary.disabled}`} tone="warning" />
        <StatCard
          label="Average Success Rate"
          value={`${summary.averageSuccess}%`}
          tone="primary"
        />
      </section>

      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle>Recovery Playbook Builder</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure trigger condition, ordered action chain, cooldown, verification, and escalation.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Playbook name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Input
              placeholder="Escalation target (team or channel)"
              value={escalationTarget}
              onChange={(event) => setEscalationTarget(event.target.value)}
            />
          </div>

          <Input
            placeholder="Trigger condition (e.g. Error rate > 5% for 3m)"
            value={triggerCondition}
            onChange={(event) => setTriggerCondition(event.target.value)}
          />

          <div className="rounded-xl border border-border bg-secondary/30 p-4">
            <p className="text-sm font-medium">Action Chain</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Select one or more automated actions. They run in listed order.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {recoveryActions.map((action) => {
                const checked = selectedActions.includes(action);
                return (
                  <label
                    key={action}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => handleActionToggle(action, Boolean(value))}
                    />
                    <span className="capitalize">{action}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              type="number"
              min={30}
              placeholder="Cooldown (seconds)"
              value={cooldownSeconds}
              onChange={(event) => setCooldownSeconds(event.target.value)}
            />
            <Input
              type="number"
              min={30}
              placeholder="Verification window (seconds)"
              value={verificationWindowSeconds}
              onChange={(event) => setVerificationWindowSeconds(event.target.value)}
            />
          </div>

          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <Button onClick={() => void handleCreate()} disabled={isSaving}>
            <Plus className="mr-1.5 h-4 w-4" />
            {isSaving ? "Creating..." : "Create Playbook"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle>Playbook Operations</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Trigger manual runs, toggle execution, and manage escalation workflows.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {playbooks.length === 0 ? (
            <DataStateCard
              state="empty"
              title="No playbooks created"
              detail="Create your first recovery playbook above."
            />
          ) : (
            playbooks.map((playbook) => (
              <article
                key={playbook.id}
                className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-medium">{playbook.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{playbook.id}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      className={
                        playbook.enabled
                          ? "bg-success/15 text-success hover:bg-success/20"
                          : "bg-warning/20 text-warning hover:bg-warning/25"
                      }
                    >
                      {playbook.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Active</span>
                      <Switch
                        checked={playbook.enabled}
                        onCheckedChange={(checked) => void toggleEnabled(playbook, checked)}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-3 text-sm">
                  <p className="text-xs text-muted-foreground">Trigger Condition</p>
                  <p className="mt-1">{playbook.triggerCondition}</p>
                </div>

                <div className="rounded-lg border border-border bg-card p-3 text-sm">
                  <p className="text-xs text-muted-foreground">Action Chain</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {playbook.actions.map((action, index) => (
                      <div key={`${playbook.id}-${action}-${index}`} className="flex items-center gap-1.5">
                        <Badge variant="outline" className="capitalize">
                          {action}
                        </Badge>
                        {index < playbook.actions.length - 1 ? (
                          <span className="text-xs text-muted-foreground">-&gt;</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                  <p>Cooldown: {playbook.cooldownSeconds}s</p>
                  <p>Verification: {playbook.verificationWindowSeconds}s</p>
                  <p>Escalation: {playbook.escalationTarget}</p>
                  <p>Success Rate: {playbook.successRate}%</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => void triggerRun(playbook)}>
                    <Play className="mr-1.5 h-4 w-4" />
                    Run Now
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(playbook)}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Delete
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Last run: {playbook.lastRun}
                  </span>
                </div>
              </article>
            ))
          )}
        </CardContent>
      </Card>

      <ConfirmActionDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget ? `Delete "${deleteTarget.name}"?` : "Delete playbook"}
        description="This removes the playbook definition from the dashboard."
        confirmLabel="Delete"
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

function StatCard({
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
        <span
          className={`inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium ${toneClass[tone]}`}
        >
          {label}
        </span>
      </CardContent>
    </Card>
  );
}
