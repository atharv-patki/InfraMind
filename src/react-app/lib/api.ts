export type ServerStatus = "Healthy" | "Warning" | "Critical";
export type AlertSeverity = "Critical" | "Warning" | "Info";
export type AlertStatus = "Active" | "Resolved";
export type AISeverity = "High" | "Medium" | "Low";
export type ThemePreference = "system" | "light" | "dark";

export type ServerItem = {
  id: string;
  name: string;
  ip: string;
  region: string;
  uptime: string;
  cpu: number;
  memory: number;
  status: ServerStatus;
  lastHeartbeat: string;
  createdAt: string;
};

export type AlertItem = {
  id: string;
  title: string;
  source: string;
  severity: AlertSeverity;
  status: AlertStatus;
  createdAt: string;
};

export type AutomationRule = {
  id: string;
  name: string;
  trigger: string;
  action: string;
  cooldownMinutes: number;
  enabled: boolean;
  lastRun: string;
  successRate: number;
  createdAt: string;
};

export type AISystemAnomaly = {
  id: string;
  metric: string;
  service: string;
  confidence: number;
  severity: AISeverity;
  summary: string;
};

export type AIRecommendation = {
  id: string;
  title: string;
  impact: string;
  priority: AISeverity;
  done: boolean;
};

export type MetricKind = "cpu" | "memory" | "disk" | "network";
export type TimeRange = "1h" | "24h" | "7d";

export type MetricPoint = {
  timestamp: string;
  value: number;
};

export type MetricsSnapshot = {
  timestamp: string;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
};

export type UserProfile = {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  role: string;
  timezone: string;
  theme: ThemePreference;
  emailAlerts: boolean;
  slackAlerts: boolean;
  weeklyReport: boolean;
};

export type ApiKeyItem = {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed: string;
  active: boolean;
};

type ApiErrorResponse = {
  error?: string;
};

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorPayload = payload as ApiErrorResponse | null;
    throw new Error(errorPayload?.error ?? "Request failed.");
  }

  return payload as T;
}

export async function getServers(): Promise<ServerItem[]> {
  const data = await apiRequest<{ servers: ServerItem[] }>("/api/servers");
  return data.servers;
}

export async function createServer(payload: {
  name: string;
  ip: string;
  region: string;
}): Promise<ServerItem> {
  const data = await apiRequest<{ server: ServerItem }>("/api/servers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.server;
}

export async function deleteServer(id: string): Promise<void> {
  await apiRequest<{ success: true }>(`/api/servers/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function getAlerts(): Promise<AlertItem[]> {
  const data = await apiRequest<{ alerts: AlertItem[] }>("/api/alerts");
  return data.alerts;
}

export async function createAlert(payload: {
  title: string;
  source: string;
  severity: AlertSeverity;
}): Promise<AlertItem> {
  const data = await apiRequest<{ alert: AlertItem }>("/api/alerts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.alert;
}

export async function updateAlertStatus(id: string, status: AlertStatus): Promise<void> {
  await apiRequest<{ success: true }>(`/api/alerts/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export async function deleteAlert(id: string): Promise<void> {
  await apiRequest<{ success: true }>(`/api/alerts/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function getAutomationRules(): Promise<AutomationRule[]> {
  const data = await apiRequest<{ rules: AutomationRule[] }>("/api/automation/rules");
  return data.rules;
}

export async function createAutomationRule(payload: {
  name: string;
  trigger: string;
  action: string;
  cooldownMinutes: number;
}): Promise<AutomationRule> {
  const data = await apiRequest<{ rule: AutomationRule }>("/api/automation/rules", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.rule;
}

export async function updateAutomationRuleEnabled(id: string, enabled: boolean): Promise<void> {
  await apiRequest<{ success: true }>(`/api/automation/rules/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  });
}

export async function runAutomationRule(id: string): Promise<void> {
  await apiRequest<{ success: true }>(`/api/automation/rules/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ runNow: true }),
  });
}

export async function deleteAutomationRule(id: string): Promise<void> {
  await apiRequest<{ success: true }>(`/api/automation/rules/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function getMetricSeries(
  metric: MetricKind,
  range: TimeRange
): Promise<MetricPoint[]> {
  const data = await apiRequest<{ samples: MetricPoint[] }>(
    `/api/metrics/${metric}?range=${encodeURIComponent(range)}`
  );
  return data.samples;
}

export async function getMetricsSnapshot(): Promise<MetricsSnapshot> {
  return apiRequest<MetricsSnapshot>("/api/metrics/latest");
}

export function subscribeToMetricsStream(
  onMessage: (snapshot: MetricsSnapshot) => void,
  onError?: (error: Event) => void
): () => void {
  const source = new EventSource("/api/stream/metrics");

  const listener = (event: MessageEvent) => {
    try {
      const payload = JSON.parse(event.data) as MetricsSnapshot;
      onMessage(payload);
    } catch {
      // Ignore malformed stream payloads.
    }
  };

  source.addEventListener("metrics", listener);
  if (onError) {
    source.addEventListener("error", onError);
  }

  return () => {
    source.removeEventListener("metrics", listener);
    source.close();
  };
}

export async function getAIAnomalies(): Promise<AISystemAnomaly[]> {
  const data = await apiRequest<{ anomalies: AISystemAnomaly[] }>("/api/ai/anomalies");
  return data.anomalies;
}

export async function getAIPredictions(): Promise<number[]> {
  const data = await apiRequest<{ points: number[] }>("/api/ai/predictions");
  return data.points;
}

export async function getAIRecommendations(): Promise<AIRecommendation[]> {
  const data = await apiRequest<{ recommendations: AIRecommendation[] }>("/api/ai/recommendations");
  return data.recommendations;
}

export async function updateAIRecommendation(id: string, done: boolean): Promise<void> {
  await apiRequest<{ success: true }>(`/api/ai/recommendations/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ done }),
  });
}

export async function getUserProfile(): Promise<UserProfile> {
  const data = await apiRequest<{ profile: UserProfile }>("/api/user/profile");
  return data.profile;
}

export async function updateUserProfile(payload: Partial<UserProfile>): Promise<UserProfile> {
  const data = await apiRequest<{ profile: UserProfile }>("/api/user/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return data.profile;
}

export async function updateUserPassword(payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await apiRequest<{ success: true }>("/api/user/password", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getUserApiKeys(): Promise<ApiKeyItem[]> {
  const data = await apiRequest<{ keys: ApiKeyItem[] }>("/api/user/api-keys");
  return data.keys;
}

export async function createUserApiKey(name: string): Promise<ApiKeyItem> {
  const data = await apiRequest<{ key: ApiKeyItem }>("/api/user/api-keys", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return data.key;
}

export async function deleteUserApiKey(id: string): Promise<void> {
  await apiRequest<{ success: true }>(`/api/user/api-keys/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
