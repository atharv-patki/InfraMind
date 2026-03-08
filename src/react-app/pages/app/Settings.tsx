import { useEffect, useMemo, useState } from "react";
import { Cloud, Link2Off, Loader2, Save, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Switch } from "@/react-app/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/react-app/components/ui/tabs";
import { Badge } from "@/react-app/components/ui/badge";
import { useAuth } from "@/react-app/context/AuthContext";
import { useTheme } from "@/react-app/context/ThemeContext";
import { useAwsOps } from "@/react-app/context/AwsOpsContext";
import { useToast } from "@/react-app/context/ToastContext";
import { DataStateCard } from "@/react-app/components/dashboard/DataStateCard";
import type { AwsEnvironment, OpsConnectionStatus } from "@/react-app/lib/aws-contracts";

const selectClassName =
  "h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 w-full";

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { config, isLoading, error, connect, disconnect, updateConfig, setConnectionStatus, refresh } =
    useAwsOps();
  const { pushToast } = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profileMessage, setProfileMessage] = useState("");

  const [accountId, setAccountId] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [environment, setEnvironment] = useState<AwsEnvironment>("prod");
  const [autoRecoveryEnabled, setAutoRecoveryEnabled] = useState(true);
  const [channels, setChannels] = useState({
    email: true,
    sms: false,
    slack: true,
    teams: false,
  });
  const [awsMessage, setAwsMessage] = useState("");
  const [isSavingAws, setIsSavingAws] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName([user.firstName, user.lastName].filter(Boolean).join(" "));
    setEmail(user.email);
  }, [user]);

  useEffect(() => {
    if (!config) return;
    setAccountId(config.accountId);
    setRegion(config.region);
    setEnvironment(config.environment);
    setAutoRecoveryEnabled(config.autoRecoveryEnabled);
    setChannels(config.alertChannels);
  }, [config]);

  const permissionSummary = useMemo(() => {
    if (!config) return { granted: 0, missing: 0, unknown: 0 };
    return config.iamPermissions.reduce(
      (acc, item) => {
        acc[item.status] += 1;
        return acc;
      },
      { granted: 0, missing: 0, unknown: 0 }
    );
  }, [config]);

  const saveAwsIntegration = async () => {
    if (!accountId.trim()) {
      setAwsMessage("Account ID is required.");
      return;
    }

    try {
      setIsSavingAws(true);
      await updateConfig({
        accountId: accountId.trim(),
        region: region.trim(),
        environment,
        autoRecoveryEnabled,
        alertChannels: channels,
      });
      setAwsMessage("AWS integration settings saved.");
      pushToast("AWS integration updated.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save AWS settings.";
      setAwsMessage(message);
      pushToast(message, "error");
    } finally {
      setIsSavingAws(false);
    }
  };

  const saveProfile = () => {
    if (!name.trim() || !email.trim()) {
      setProfileMessage("Name and email are required.");
      return;
    }
    setProfileMessage("Profile changes saved locally.");
    pushToast("Profile updated.", "success");
  };

  const simulateState = async (status: OpsConnectionStatus) => {
    await setConnectionStatus(status);
    pushToast(`Connection state changed to ${status}.`, "info");
  };

  if (isLoading || !config) {
    return (
      <DataStateCard
        state="loading"
        title="Loading settings"
        detail="Initializing AWS integration controls."
      />
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Card>
          <CardContent className="py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button size="sm" variant="outline" onClick={() => void refresh()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid sm:grid-cols-3 gap-4">
        <InfoCard label="AWS Account" value={config.accountId} helper={config.environment.toUpperCase()} />
        <InfoCard label="Region" value={config.region} helper="Active routing region" />
        <InfoCard label="Auto-Recovery" value={config.autoRecoveryEnabled ? "Enabled" : "Disabled"} helper="Recovery playbooks" />
      </section>

      <Tabs defaultValue="aws">
        <TabsList>
          <TabsTrigger value="aws">AWS Integration</TabsTrigger>
          <TabsTrigger value="iam">IAM Status</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>

        <TabsContent value="aws">
          <Card>
            <CardHeader className="border-b border-border/70">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>AWS Connection</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure account scope, alert channels, and auto-recovery behavior.
                  </p>
                </div>
                <Badge variant="outline">{config.connectionStatus}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid md:grid-cols-3 gap-3">
                <Input
                  placeholder="Account ID"
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                />
                <select
                  value={region}
                  onChange={(event) => setRegion(event.target.value)}
                  className={selectClassName}
                >
                  <option value="us-east-1">us-east-1</option>
                  <option value="us-west-2">us-west-2</option>
                  <option value="eu-west-1">eu-west-1</option>
                  <option value="ap-south-1">ap-south-1</option>
                </select>
                <select
                  value={environment}
                  onChange={(event) => setEnvironment(event.target.value as AwsEnvironment)}
                  className={selectClassName}
                >
                  <option value="dev">dev</option>
                  <option value="staging">staging</option>
                  <option value="prod">prod</option>
                </select>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <ChannelToggle
                  label="Email Alerts"
                  checked={channels.email}
                  onCheckedChange={(value) =>
                    setChannels((prev) => ({ ...prev, email: value }))
                  }
                />
                <ChannelToggle
                  label="SMS Alerts"
                  checked={channels.sms}
                  onCheckedChange={(value) => setChannels((prev) => ({ ...prev, sms: value }))}
                />
                <ChannelToggle
                  label="Slack Alerts"
                  checked={channels.slack}
                  onCheckedChange={(value) =>
                    setChannels((prev) => ({ ...prev, slack: value }))
                  }
                />
                <ChannelToggle
                  label="Teams Alerts"
                  checked={channels.teams}
                  onCheckedChange={(value) =>
                    setChannels((prev) => ({ ...prev, teams: value }))
                  }
                />
              </div>

              <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Enable Auto-Recovery</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Automatically execute recovery playbooks on qualifying incidents.
                  </p>
                </div>
                <Switch checked={autoRecoveryEnabled} onCheckedChange={setAutoRecoveryEnabled} />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => void connect()}>
                  <Cloud className="w-4 h-4 mr-1.5" />
                  Connect
                </Button>
                <Button variant="outline" onClick={() => void disconnect()}>
                  <Link2Off className="w-4 h-4 mr-1.5" />
                  Disconnect
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void simulateState("permission_denied")}
                >
                  Simulate Permission Denied
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void simulateState("partial_outage")}
                >
                  Simulate Partial Outage
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void simulateState("recovery_running")}
                >
                  Simulate Recovery Running
                </Button>
              </div>

              {awsMessage ? <p className="text-sm text-muted-foreground">{awsMessage}</p> : null}
              <Button onClick={() => void saveAwsIntegration()} disabled={isSavingAws}>
                {isSavingAws ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-1.5" />
                )}
                Save AWS Integration
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="iam">
          <Card>
            <CardHeader className="border-b border-border/70">
              <CardTitle>IAM Permission Status (Placeholder)</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Frontend placeholder checks to reflect backend IAM validation results.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge className="bg-success/15 text-success">Granted: {permissionSummary.granted}</Badge>
                <Badge className="bg-warning/20 text-warning">Unknown: {permissionSummary.unknown}</Badge>
                <Badge variant="destructive">Missing: {permissionSummary.missing}</Badge>
              </div>
              {config.iamPermissions.map((permission) => (
                <article
                  key={permission.name}
                  className="rounded-xl border border-border bg-secondary/30 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{permission.name}</p>
                    <Badge
                      variant={permission.status === "missing" ? "destructive" : "outline"}
                      className={
                        permission.status === "granted"
                          ? "bg-success/15 text-success"
                          : permission.status === "unknown"
                          ? "bg-warning/20 text-warning"
                          : undefined
                      }
                    >
                      {permission.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{permission.detail}</p>
                </article>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile">
          <Card>
            <CardHeader className="border-b border-border/70">
              <CardTitle>User Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                <Input value={name} onChange={(event) => setName(event.target.value)} />
                <Input value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              {profileMessage ? <p className="text-sm text-muted-foreground">{profileMessage}</p> : null}
              <Button onClick={saveProfile}>
                <ShieldCheck className="w-4 h-4 mr-1.5" />
                Save Profile
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader className="border-b border-border/70">
              <CardTitle>Appearance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Theme</p>
                <select
                  value={theme}
                  onChange={(event) => setTheme(event.target.value as "system" | "light" | "dark")}
                  className={selectClassName}
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <Card>
      <CardContent>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}

function ChannelToggle({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 flex items-center justify-between gap-3">
      <p className="text-sm font-medium">{label}</p>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
