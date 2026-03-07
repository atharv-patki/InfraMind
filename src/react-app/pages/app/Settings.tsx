import { useEffect, useMemo, useRef, useState } from "react";
import { KeyRound, Save, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Switch } from "@/react-app/components/ui/switch";
import { Badge } from "@/react-app/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/react-app/components/ui/tabs";
import { useAuth } from "@/react-app/context/AuthContext";

type ApiKey = {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed: string;
};

const selectClassName =
  "h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 w-full";

const initialApiKeys: ApiKey[] = [
  {
    id: "key-1",
    name: "Grafana Exporter",
    key: "im_live_8J9P-L2MR-4D9W-Q7C3",
    createdAt: "2026-02-10",
    lastUsed: "2 hours ago",
  },
  {
    id: "key-2",
    name: "CI Health Check",
    key: "im_live_3NXQ-R8TD-1A6K-P2V5",
    createdAt: "2026-01-22",
    lastUsed: "Yesterday",
  },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const hydratedUserIdRef = useRef<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("InfraMind Cloud Team");
  const [role, setRole] = useState("Platform Engineer");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [profileMessage, setProfileMessage] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  const [theme, setTheme] = useState("system");
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [slackAlerts, setSlackAlerts] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);
  const [preferencesMessage, setPreferencesMessage] = useState("");

  const [apiKeys, setApiKeys] = useState<ApiKey[]>(initialApiKeys);
  const [newKeyName, setNewKeyName] = useState("");
  const [keyMessage, setKeyMessage] = useState("");

  const activeKeysCount = useMemo(() => apiKeys.length, [apiKeys]);

  useEffect(() => {
    if (!user) return;
    if (hydratedUserIdRef.current === user.id) return;

    const fullName = [user.firstName, user.lastName]
      .filter((value) => value.trim().length > 0)
      .join(" ")
      .trim();

    setName(fullName);
    setEmail(user.email);
    hydratedUserIdRef.current = user.id;
  }, [user]);

  const saveProfile = () => {
    if (!name.trim() || !email.trim()) {
      setProfileMessage("Name and email are required.");
      return;
    }
    setProfileMessage("Profile updated successfully.");
  };

  const updatePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage("Fill all password fields.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage("New password and confirmation do not match.");
      return;
    }
    setPasswordMessage("Password updated successfully.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const savePreferences = () => {
    setPreferencesMessage("Preferences saved.");
  };

  const generateApiKey = () => {
    const label = newKeyName.trim();
    if (!label) {
      setKeyMessage("Enter a key label before generating.");
      return;
    }
    const newKey: ApiKey = {
      id: `key-${Date.now()}`,
      name: label,
      key: `im_live_${makeToken(4)}-${makeToken(4)}-${makeToken(4)}-${makeToken(4)}`,
      createdAt: new Date().toISOString().slice(0, 10),
      lastUsed: "Never",
    };
    setApiKeys((prev) => [newKey, ...prev]);
    setNewKeyName("");
    setKeyMessage("New API key generated.");
  };

  const revokeApiKey = (id: string) => {
    setApiKeys((prev) => prev.filter((key) => key.id !== id));
    setKeyMessage("API key revoked.");
  };

  return (
    <div className="space-y-6">
      <section className="grid sm:grid-cols-3 gap-4">
        <InfoCard label="Workspace Plan" value="Pro Trial" helper="14 days remaining" />
        <InfoCard label="Active API Keys" value={`${activeKeysCount}`} helper="Rotate every 90 days" />
        <InfoCard label="Default Timezone" value={timezone} helper="Used in alerts and reports" />
      </section>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="api">API Keys</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader className="border-b border-border/70">
              <CardTitle>Profile Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" />
                <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" />
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <Input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Company" />
                <Input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Role" />
              </div>
              <select
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                className={selectClassName}
              >
                <option value="Asia/Kolkata">Asia/Kolkata</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Asia/Singapore">Asia/Singapore</option>
              </select>
              {profileMessage ? <p className="text-sm text-muted-foreground">{profileMessage}</p> : null}
              <Button onClick={saveProfile}>
                <Save className="w-4 h-4 mr-1.5" />
                Save Profile
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader className="border-b border-border/70">
              <CardTitle>Security Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Current password"
              />
              <div className="grid md:grid-cols-2 gap-3">
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="New password"
                />
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm new password"
                />
              </div>
              {passwordMessage ? <p className="text-sm text-muted-foreground">{passwordMessage}</p> : null}
              <Button onClick={updatePassword}>Update Password</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <Card>
            <CardHeader className="border-b border-border/70">
              <CardTitle>Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-sm font-medium mb-2">Theme</p>
                <select value={theme} onChange={(event) => setTheme(event.target.value)} className={selectClassName}>
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <PreferenceToggle
                label="Email Alerts"
                description="Receive incident updates by email."
                checked={emailAlerts}
                onCheckedChange={setEmailAlerts}
              />
              <PreferenceToggle
                label="Slack Alerts"
                description="Send critical incidents to Slack channels."
                checked={slackAlerts}
                onCheckedChange={setSlackAlerts}
              />
              <PreferenceToggle
                label="Weekly Health Report"
                description="Send summarized monitoring reports every Monday."
                checked={weeklyReport}
                onCheckedChange={setWeeklyReport}
              />

              {preferencesMessage ? (
                <p className="text-sm text-muted-foreground">{preferencesMessage}</p>
              ) : null}
              <Button onClick={savePreferences}>Save Preferences</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api">
          <Card>
            <CardHeader className="border-b border-border/70">
              <CardTitle>API Keys</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Key label (e.g., Terraform integration)"
                  value={newKeyName}
                  onChange={(event) => setNewKeyName(event.target.value)}
                />
                <Button onClick={generateApiKey}>
                  <KeyRound className="w-4 h-4 mr-1.5" />
                  Generate Key
                </Button>
              </div>
              {keyMessage ? <p className="text-sm text-muted-foreground">{keyMessage}</p> : null}

              <div className="space-y-3">
                {apiKeys.map((key) => (
                  <article
                    key={key.id}
                    className="rounded-xl border border-border bg-secondary/30 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{key.name}</p>
                        <Badge variant="outline">Active</Badge>
                      </div>
                      <p className="font-mono text-xs text-primary mt-1">{key.key}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Created: {key.createdAt} • Last used: {key.lastUsed}
                      </p>
                    </div>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => revokeApiKey(key.id)}
                      aria-label={`Revoke ${key.name}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </article>
                ))}
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
        <p className="mt-1 text-2xl font-semibold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}

function PreferenceToggle({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function makeToken(length: number): string {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";
  for (let index = 0; index < length; index += 1) {
    token += characters[Math.floor(Math.random() * characters.length)];
  }
  return token;
}
