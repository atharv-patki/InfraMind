import type {
  AlertIncident,
  AlertsStreamSnapshot,
  AwsOpsConfig,
  AwsServiceType,
  IncidentAuditRecord,
  IncidentStatus,
  InfrastructureResource,
  MetricsCompareRange,
  MetricsFilters,
  MetricsRange,
  MetricsSeries,
  MetricsSnapshot,
  OverviewData,
  RecoveryActionType,
  RecoveryPlaybook,
} from "@/react-app/lib/aws-contracts";

type ApiErrorPayload = {
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

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? ((await response.json()) as unknown) : null;

  if (!response.ok) {
    const message = (payload as ApiErrorPayload | null)?.error ?? "Request failed.";
    throw new Error(message);
  }

  return payload as T;
}

export async function getOpsConfig(): Promise<AwsOpsConfig> {
  const data = await apiRequest<{ config: AwsOpsConfig }>("/api/aws/config");
  return data.config;
}

export async function updateOpsConfig(
  patch: Partial<Omit<AwsOpsConfig, "iamPermissions">>
): Promise<AwsOpsConfig> {
  const data = await apiRequest<{ config: AwsOpsConfig }>("/api/aws/config", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
  return data.config;
}

export async function connectAws(): Promise<AwsOpsConfig> {
  const data = await apiRequest<{ config: AwsOpsConfig }>("/api/aws/connect", {
    method: "POST",
  });
  return data.config;
}

export async function disconnectAws(): Promise<AwsOpsConfig> {
  const data = await apiRequest<{ config: AwsOpsConfig }>("/api/aws/disconnect", {
    method: "POST",
  });
  return data.config;
}

export async function getOverviewData(): Promise<OverviewData> {
  const data = await apiRequest<{ overview: OverviewData }>("/api/aws/overview");
  return data.overview;
}

export async function getResources(
  service: AwsServiceType | "All"
): Promise<InfrastructureResource[]> {
  const query = new URLSearchParams({ service }).toString();
  const data = await apiRequest<{ resources: InfrastructureResource[] }>(
    `/api/aws/resources?${query}`
  );
  return data.resources;
}

export async function runResourceQuickAction(payload: {
  resourceId: string;
  action: RecoveryActionType;
}): Promise<void> {
  await apiRequest<{ success: boolean }>(
    `/api/aws/resources/${encodeURIComponent(payload.resourceId)}/actions`,
    {
      method: "POST",
      body: JSON.stringify({ action: payload.action }),
    }
  );
}

export async function getAlerts(): Promise<AlertIncident[]> {
  const data = await apiRequest<{ incidents: AlertIncident[] }>("/api/aws/incidents");
  return data.incidents;
}

export async function updateAlertStatus(payload: {
  incidentId: string;
  status: IncidentStatus;
}): Promise<AlertIncident> {
  const data = await apiRequest<{ incident: AlertIncident }>(
    `/api/aws/incidents/${encodeURIComponent(payload.incidentId)}/status`,
    {
      method: "PUT",
      body: JSON.stringify({ status: payload.status }),
    }
  );
  return data.incident;
}

export async function acknowledgeIncident(incidentId: string): Promise<AlertIncident> {
  const data = await apiRequest<{ incident: AlertIncident }>(
    `/api/aws/incidents/${encodeURIComponent(incidentId)}/acknowledge`,
    {
      method: "POST",
    }
  );
  return data.incident;
}

export async function escalateIncident(incidentId: string): Promise<AlertIncident> {
  const data = await apiRequest<{ incident: AlertIncident }>(
    `/api/aws/incidents/${encodeURIComponent(incidentId)}/escalate`,
    {
      method: "POST",
    }
  );
  return data.incident;
}

export async function getPlaybooks(): Promise<RecoveryPlaybook[]> {
  const data = await apiRequest<{ playbooks: RecoveryPlaybook[] }>("/api/aws/playbooks");
  return data.playbooks;
}

export async function createPlaybook(input: {
  name: string;
  triggerCondition: string;
  actions: RecoveryActionType[];
  cooldownSeconds: number;
  verificationWindowSeconds: number;
  escalationTarget: string;
}): Promise<RecoveryPlaybook> {
  const data = await apiRequest<{ playbook: RecoveryPlaybook }>("/api/aws/playbooks", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.playbook;
}

export async function updatePlaybookEnabled(payload: {
  playbookId: string;
  enabled: boolean;
}): Promise<void> {
  await apiRequest<{ success: boolean }>(
    `/api/aws/playbooks/${encodeURIComponent(payload.playbookId)}/enabled`,
    {
      method: "PUT",
      body: JSON.stringify({ enabled: payload.enabled }),
    }
  );
}

export async function deletePlaybook(playbookId: string): Promise<void> {
  await apiRequest<{ success: boolean }>(
    `/api/aws/playbooks/${encodeURIComponent(playbookId)}`,
    {
      method: "DELETE",
    }
  );
}

export async function runPlaybook(playbookId: string): Promise<void> {
  await apiRequest<{ success: boolean }>(
    `/api/aws/playbooks/${encodeURIComponent(playbookId)}/run`,
    {
      method: "POST",
    }
  );
}

export async function getIncidentAuditRecords(): Promise<IncidentAuditRecord[]> {
  const data = await apiRequest<{ audits: IncidentAuditRecord[] }>("/api/aws/audits");
  return data.audits;
}

export async function getIncidentAuditRecordById(
  recordId: string
): Promise<IncidentAuditRecord | null> {
  const records = await getIncidentAuditRecords();
  return records.find((record) => record.id === recordId) ?? null;
}

export async function appendIncidentNote(payload: {
  recordId: string;
  note: string;
}): Promise<IncidentAuditRecord> {
  const data = await apiRequest<{ audit: IncidentAuditRecord }>(
    `/api/aws/audits/${encodeURIComponent(payload.recordId)}/note`,
    {
      method: "PUT",
      body: JSON.stringify({ note: payload.note }),
    }
  );
  return data.audit;
}

export async function exportIncidentReport(recordId: string): Promise<string> {
  const response = await fetch(`/api/aws/audits/${encodeURIComponent(recordId)}/export`, {
    credentials: "include",
  });
  if (!response.ok) {
    let errorMessage = "Unable to export report.";
    try {
      const data = (await response.json()) as ApiErrorPayload;
      errorMessage = data.error ?? errorMessage;
    } catch {
      // Ignore parse errors.
    }
    throw new Error(errorMessage);
  }
  return response.text();
}

export async function getMetrics(payload: {
  range: MetricsRange;
  compareRange: MetricsCompareRange;
  filters: MetricsFilters;
}): Promise<{ primary: MetricsSeries; compare: MetricsSeries | null }> {
  const query = new URLSearchParams({
    range: payload.range,
    compareRange: payload.compareRange,
    region: payload.filters.region,
    service: payload.filters.service,
    resourceId: payload.filters.resourceId,
  }).toString();

  const data = await apiRequest<{ primary: MetricsSeries; compare: MetricsSeries | null }>(
    `/api/aws/metrics?${query}`
  );
  return data;
}

export function subscribeMetricsSnapshots(
  callback: (snapshot: MetricsSnapshot) => void
): () => void {
  const source = new EventSource("/api/stream/metrics", { withCredentials: true });

  const listener = (event: MessageEvent<string>) => {
    try {
      const parsed = JSON.parse(event.data) as MetricsSnapshot;
      callback(parsed);
    } catch {
      // Ignore malformed payload.
    }
  };

  source.addEventListener("metrics", listener);
  return () => {
    source.removeEventListener("metrics", listener);
    source.close();
  };
}

export function subscribeAlertsSnapshots(
  callback: (snapshot: AlertsStreamSnapshot) => void
): () => void {
  const source = new EventSource("/api/stream/alerts", { withCredentials: true });

  const listener = (event: MessageEvent<string>) => {
    try {
      const parsed = JSON.parse(event.data) as AlertsStreamSnapshot;
      callback(parsed);
    } catch {
      // Ignore malformed payload.
    }
  };

  source.addEventListener("alerts", listener);
  return () => {
    source.removeEventListener("alerts", listener);
    source.close();
  };
}
