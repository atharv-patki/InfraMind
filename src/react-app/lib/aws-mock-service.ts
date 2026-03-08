import type {
  AlertIncident,
  AwsOpsConfig,
  AwsServiceType,
  IncidentAuditRecord,
  IncidentStatus,
  IncidentTimelineEvent,
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

type MockStore = {
  config: AwsOpsConfig;
  overview: OverviewData;
  resources: InfrastructureResource[];
  incidents: AlertIncident[];
  playbooks: RecoveryPlaybook[];
  audits: IncidentAuditRecord[];
};

export type MockServiceErrorCode =
  | "NOT_CONNECTED"
  | "PERMISSION_DENIED"
  | "NOT_FOUND"
  | "VALIDATION_FAILED";

export class MockServiceError extends Error {
  code: MockServiceErrorCode;

  constructor(code: MockServiceErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const delayMs = 180;

const mockStore: MockStore = createInitialStore();

export async function getOpsConfig(): Promise<AwsOpsConfig> {
  await delay(delayMs);
  return structuredClone(mockStore.config);
}

export async function updateOpsConfig(
  patch: Partial<Omit<AwsOpsConfig, "iamPermissions">>
): Promise<AwsOpsConfig> {
  await delay(delayMs);
  mockStore.config = {
    ...mockStore.config,
    ...patch,
  };
  return structuredClone(mockStore.config);
}

export async function connectAws(): Promise<AwsOpsConfig> {
  await delay(delayMs);
  mockStore.config.connectionStatus = "connected";
  return structuredClone(mockStore.config);
}

export async function disconnectAws(): Promise<AwsOpsConfig> {
  await delay(delayMs);
  mockStore.config.connectionStatus = "disconnected";
  return structuredClone(mockStore.config);
}

export async function getOverviewData(): Promise<OverviewData> {
  ensureConnected();
  await delay(delayMs);
  recalculateOverview();
  return structuredClone(mockStore.overview);
}

export async function getResources(
  service: AwsServiceType | "All"
): Promise<InfrastructureResource[]> {
  ensureConnected();
  await delay(delayMs);
  if (service === "All") {
    return structuredClone(mockStore.resources);
  }
  return structuredClone(mockStore.resources.filter((resource) => resource.type === service));
}

export async function runResourceQuickAction(payload: {
  resourceId: string;
  action: RecoveryActionType;
}): Promise<void> {
  ensureConnected();
  await delay(delayMs);

  const resource = mockStore.resources.find((item) => item.id === payload.resourceId);
  if (!resource) {
    throw new MockServiceError("NOT_FOUND", "Resource not found.");
  }

  resource.lastEvent = `${actionLabel(payload.action)} action executed`;
  if (payload.action === "restart" || payload.action === "redeploy") {
    resource.health = "Healthy";
    resource.cpuUtilization = clamp(resource.cpuUtilization - 12, 10, 95);
    resource.memoryUtilization = clamp(resource.memoryUtilization - 10, 10, 95);
  }
  if (payload.action === "scale") {
    resource.requestsPerMinute = clamp(resource.requestsPerMinute - 90, 20, 1600);
    resource.health = resource.health === "Critical" ? "Warning" : resource.health;
  }
}

export async function getAlerts(): Promise<AlertIncident[]> {
  ensureConnected();
  await delay(delayMs);
  return structuredClone(mockStore.incidents);
}

export async function updateAlertStatus(payload: {
  incidentId: string;
  status: IncidentStatus;
}): Promise<AlertIncident> {
  ensureConnected();
  await delay(delayMs);

  const incident = mockStore.incidents.find((item) => item.id === payload.incidentId);
  if (!incident) {
    throw new MockServiceError("NOT_FOUND", "Incident not found.");
  }

  incident.status = payload.status;
  incident.timeline.unshift(makeTimelineEvent(payload.status, `Status changed to ${payload.status}`));
  if (payload.status === "Resolved") {
    incident.recoveryAction = incident.recoveryAction ?? "restart";
  }
  recalculateOverview();
  return structuredClone(incident);
}

export async function acknowledgeIncident(incidentId: string): Promise<AlertIncident> {
  return updateAlertStatus({ incidentId, status: "Analyzing" });
}

export async function escalateIncident(incidentId: string): Promise<AlertIncident> {
  return updateAlertStatus({ incidentId, status: "Escalated" });
}

export async function getPlaybooks(): Promise<RecoveryPlaybook[]> {
  ensureConnected();
  await delay(delayMs);
  return structuredClone(mockStore.playbooks);
}

export async function createPlaybook(input: {
  name: string;
  triggerCondition: string;
  actions: RecoveryActionType[];
  cooldownSeconds: number;
  verificationWindowSeconds: number;
  escalationTarget: string;
}): Promise<RecoveryPlaybook> {
  ensureConnected();
  await delay(delayMs);
  if (!input.name.trim() || !input.triggerCondition.trim() || input.actions.length === 0) {
    throw new MockServiceError("VALIDATION_FAILED", "Playbook requires name, trigger, and at least one action.");
  }

  const record: RecoveryPlaybook = {
    id: `pb-${Date.now()}`,
    name: input.name.trim(),
    triggerCondition: input.triggerCondition.trim(),
    actions: input.actions,
    cooldownSeconds: Math.max(30, input.cooldownSeconds),
    verificationWindowSeconds: Math.max(30, input.verificationWindowSeconds),
    escalationTarget: input.escalationTarget.trim() || "On-call SRE",
    enabled: true,
    lastRun: "Never",
    successRate: 92,
  };

  mockStore.playbooks.unshift(record);
  return structuredClone(record);
}

export async function updatePlaybookEnabled(payload: {
  playbookId: string;
  enabled: boolean;
}): Promise<void> {
  ensureConnected();
  await delay(delayMs);
  const playbook = mockStore.playbooks.find((item) => item.id === payload.playbookId);
  if (!playbook) throw new MockServiceError("NOT_FOUND", "Playbook not found.");
  playbook.enabled = payload.enabled;
}

export async function deletePlaybook(playbookId: string): Promise<void> {
  ensureConnected();
  await delay(delayMs);
  const next = mockStore.playbooks.filter((item) => item.id !== playbookId);
  mockStore.playbooks = next;
}

export async function runPlaybook(playbookId: string): Promise<void> {
  ensureConnected();
  await delay(delayMs);
  const playbook = mockStore.playbooks.find((item) => item.id === playbookId);
  if (!playbook) throw new MockServiceError("NOT_FOUND", "Playbook not found.");
  playbook.lastRun = "Just now";
  playbook.successRate = clamp(playbook.successRate + randomInt(-2, 3), 70, 99);
  if (mockStore.config.autoRecoveryEnabled) {
    mockStore.config.connectionStatus = "recovery_running";
    setTimeout(() => {
      if (mockStore.config.connectionStatus === "recovery_running") {
        mockStore.config.connectionStatus = "connected";
      }
    }, 2500);
  }
}

export async function getIncidentAuditRecords(): Promise<IncidentAuditRecord[]> {
  ensureConnected();
  await delay(delayMs);
  return structuredClone(mockStore.audits);
}

export async function getIncidentAuditRecordById(
  recordId: string
): Promise<IncidentAuditRecord | null> {
  ensureConnected();
  await delay(delayMs);
  const record = mockStore.audits.find((item) => item.id === recordId);
  return record ? structuredClone(record) : null;
}

export async function appendIncidentNote(payload: {
  recordId: string;
  note: string;
}): Promise<IncidentAuditRecord> {
  ensureConnected();
  await delay(delayMs);
  const record = mockStore.audits.find((item) => item.id === payload.recordId);
  if (!record) throw new MockServiceError("NOT_FOUND", "Incident audit record not found.");
  record.humanNotes = payload.note.trim();
  record.updatedAt = new Date().toISOString();
  record.timeline.unshift(
    makeTimelineEvent("Analyzing", "Human note updated for post-incident review")
  );
  return structuredClone(record);
}

export async function exportIncidentReport(recordId: string): Promise<string> {
  ensureConnected();
  await delay(delayMs);
  const record = mockStore.audits.find((item) => item.id === recordId);
  if (!record) throw new MockServiceError("NOT_FOUND", "Incident audit record not found.");
  return [
    `Incident Report: ${record.incidentId}`,
    `Summary: ${record.summary}`,
    `Verification: ${record.verificationResult}`,
    `Updated At: ${record.updatedAt}`,
    `Actions: ${record.executedActions.join(", ")}`,
    `Notes: ${record.humanNotes || "N/A"}`,
  ].join("\n");
}

export async function getMetrics(payload: {
  range: MetricsRange;
  compareRange: MetricsCompareRange;
  filters: MetricsFilters;
}): Promise<{ primary: MetricsSeries; compare: MetricsSeries | null }> {
  ensureConnected();
  await delay(delayMs);

  const length = payload.range === "15m" ? 20 : payload.range === "1h" ? 24 : 36;
  const primary = createMetricsSeries(length);
  const compare = payload.compareRange === "none" ? null : createMetricsSeries(length);
  return { primary, compare };
}

export function subscribeMetricsSnapshots(
  callback: (snapshot: MetricsSnapshot) => void
): () => void {
  const timer = setInterval(() => {
    callback({
      at: new Date().toISOString(),
      cpu: randomInt(28, 95),
      memory: randomInt(24, 96),
      disk: randomInt(18, 93),
      network: randomInt(50, 1800),
      errorRate: Number((Math.random() * 8).toFixed(2)),
      responseTime: randomInt(80, 1300),
    });
  }, 2500);

  return () => clearInterval(timer);
}

function createInitialStore(): MockStore {
  return {
    config: {
      accountId: "123456789012",
      region: "us-east-1",
      environment: "prod",
      connectionStatus: "connected",
      autoRecoveryEnabled: true,
      alertChannels: {
        email: true,
        sms: false,
        slack: true,
        teams: false,
      },
      iamPermissions: [
        {
          name: "cloudwatch:GetMetricData",
          status: "granted",
          detail: "Required for metrics and alarm analysis.",
        },
        {
          name: "ec2:RebootInstances",
          status: "granted",
          detail: "Required for restart recovery playbooks.",
        },
        {
          name: "autoscaling:SetDesiredCapacity",
          status: "unknown",
          detail: "Used for emergency scale-out actions.",
        },
        {
          name: "ecs:UpdateService",
          status: "missing",
          detail: "Needed for ECS redeploy and restart task recovery.",
        },
      ],
    },
    overview: {
      serviceHealthScore: 92,
      activeIncidents: 3,
      recoveriesToday: 7,
      meanRecoveryTimeMinutes: 11,
      incidentTrend: [4, 5, 4, 6, 7, 4, 3, 5, 4, 6, 5, 3, 4, 3],
      regions: [
        { region: "us-east-1", healthScore: 95, activeIncidents: 1, recoveryRunning: 0 },
        { region: "eu-west-1", healthScore: 88, activeIncidents: 1, recoveryRunning: 1 },
        { region: "ap-south-1", healthScore: 91, activeIncidents: 1, recoveryRunning: 0 },
      ],
    },
    resources: [
      makeResource("EC2", "checkout-api-ec2-1", "us-east-1", "Warning"),
      makeResource("EC2", "jobs-worker-ec2-1", "eu-west-1", "Healthy"),
      makeResource("ECS", "payments-service", "us-east-1", "Critical"),
      makeResource("ECS", "cart-service", "ap-south-1", "Healthy"),
      makeResource("Lambda", "invoice-generator", "us-east-1", "Healthy"),
      makeResource("Lambda", "order-webhook", "eu-west-1", "Warning"),
      makeResource("RDS", "orders-db-primary", "us-east-1", "Warning"),
      makeResource("RDS", "analytics-db", "ap-south-1", "Healthy"),
      makeResource("ALB", "checkout-alb", "us-east-1", "Critical"),
      makeResource("ALB", "public-api-alb", "eu-west-1", "Healthy"),
    ],
    incidents: [
      makeIncident({
        id: "INC-9021",
        title: "Checkout API error rate crossed 6%",
        severity: "Critical",
        status: "Recovering",
        source: "checkout-api-ec2-1",
        service: "EC2",
        owner: "Arjun",
        team: "Platform SRE",
      }),
      makeIncident({
        id: "INC-9019",
        title: "ECS payments task unhealthy",
        severity: "High",
        status: "Analyzing",
        source: "payments-service",
        service: "ECS",
        owner: "Riya",
        team: "Payments Reliability",
      }),
      makeIncident({
        id: "INC-9012",
        title: "ALB latency p95 > 900ms",
        severity: "Medium",
        status: "Resolved",
        source: "checkout-alb",
        service: "ALB",
        owner: "Siddharth",
        team: "Network Ops",
      }),
    ],
    playbooks: [
      {
        id: "pb-1001",
        name: "Restart Unresponsive EC2 Service",
        triggerCondition: "Error rate > 5% for 3m and EC2 health check failing",
        actions: ["restart", "redeploy"],
        cooldownSeconds: 300,
        verificationWindowSeconds: 90,
        escalationTarget: "Platform SRE On-call",
        enabled: true,
        lastRun: "18 minutes ago",
        successRate: 96,
      },
      {
        id: "pb-1002",
        name: "Scale ECS on Traffic Surge",
        triggerCondition: "CPU > 80% and request rate spike > 2x baseline",
        actions: ["scale", "failover"],
        cooldownSeconds: 240,
        verificationWindowSeconds: 120,
        escalationTarget: "Traffic Engineering",
        enabled: true,
        lastRun: "3 hours ago",
        successRate: 92,
      },
    ],
    audits: [
      makeAuditRecord("AUD-7001", "INC-9021", "Checkout API recovery workflow executed."),
      makeAuditRecord("AUD-6999", "INC-9012", "Latency incident resolved after ALB target rebalance."),
    ],
  };
}

function recalculateOverview(): void {
  const active = mockStore.incidents.filter(
    (incident) => incident.status !== "Resolved"
  ).length;
  const recoveries = mockStore.incidents.filter(
    (incident) => incident.status === "Resolved"
  ).length;
  const recoveryRunning = mockStore.incidents.filter(
    (incident) => incident.status === "Recovering"
  ).length;
  mockStore.overview.activeIncidents = active;
  mockStore.overview.recoveriesToday = 6 + recoveries;
  mockStore.overview.meanRecoveryTimeMinutes = clamp(8 + recoveryRunning * 2, 6, 20);
  mockStore.overview.serviceHealthScore = clamp(98 - active * 3, 60, 99);
}

function ensureConnected(): void {
  if (mockStore.config.connectionStatus === "disconnected") {
    throw new MockServiceError("NOT_CONNECTED", "AWS account is not connected.");
  }
  if (mockStore.config.connectionStatus === "permission_denied") {
    throw new MockServiceError("PERMISSION_DENIED", "IAM permissions are insufficient.");
  }
}

function makeIncident(payload: {
  id: string;
  title: string;
  severity: AlertIncident["severity"];
  status: AlertIncident["status"];
  source: string;
  service: AwsServiceType;
  owner: string;
  team: string;
}): AlertIncident {
  return {
    ...payload,
    detectedAt: new Date().toISOString(),
    recoveryAction: payload.status === "Resolved" ? "scale" : "restart",
    timeline: [
      makeTimelineEvent(payload.status, `${payload.title}`),
      makeTimelineEvent("Detected", "CloudWatch alarm breach detected."),
    ],
  };
}

function makeAuditRecord(id: string, incidentId: string, summary: string): IncidentAuditRecord {
  return {
    id,
    incidentId,
    summary,
    verificationResult: Math.random() > 0.25 ? "passed" : "failed",
    executedActions: ["restart", "scale"],
    humanNotes: "Initial automated recovery completed; monitored for 20 minutes.",
    updatedAt: new Date().toISOString(),
    timeline: [
      makeTimelineEvent("Recovering", "Auto-recovery playbook triggered."),
      makeTimelineEvent("Analyzing", "Root cause identified from metrics and logs."),
      makeTimelineEvent("Detected", "Fault detected by CloudWatch alarm."),
    ],
  };
}

function makeTimelineEvent(state: IncidentStatus, detail: string): IncidentTimelineEvent {
  return {
    id: `ev-${Date.now()}-${Math.floor(Math.random() * 99999)}`,
    at: new Date().toISOString(),
    title: state,
    detail,
    state,
  };
}

function makeResource(
  type: AwsServiceType,
  name: string,
  region: string,
  health: InfrastructureResource["health"]
): InfrastructureResource {
  return {
    id: `${type}-${Math.floor(Math.random() * 9000 + 1000)}`,
    name,
    type,
    region,
    health,
    owner: "Infra Platform",
    team: type === "RDS" ? "Database Reliability" : "SRE Team",
    cpuUtilization: randomInt(20, 94),
    memoryUtilization: randomInt(18, 91),
    requestsPerMinute: randomInt(80, 1500),
    uptime: `${randomInt(2, 59)}d ${randomInt(0, 23)}h`,
    lastEvent: health === "Healthy" ? "No issues detected" : "Recovery action recommended",
  };
}

function createMetricsSeries(length: number): MetricsSeries {
  return {
    cpu: createWave(length, 42, 12, 12, 98),
    memory: createWave(length, 56, 10, 15, 98),
    disk: createWave(length, 50, 8, 10, 96),
    network: createWave(length, 840, 520, 120, 2200),
    errorRate: createWave(length, 2, 2.4, 0, 12),
    responseTime: createWave(length, 340, 260, 80, 1800),
    anomalies: buildAnomalyFlags(length),
  };
}

function createWave(
  length: number,
  center: number,
  variance: number,
  min: number,
  max: number
): number[] {
  const result: number[] = [];
  let current = center;
  for (let i = 0; i < length; i += 1) {
    const drift = (Math.random() - 0.5) * variance;
    current = clamp(current + drift, min, max);
    result.push(Number(current.toFixed(2)));
  }
  return result;
}

function buildAnomalyFlags(length: number): number[] {
  const flags = new Array(length).fill(0);
  const anomalyCount = Math.max(1, Math.floor(length / 12));
  for (let i = 0; i < anomalyCount; i += 1) {
    flags[randomInt(0, length - 1)] = 1;
  }
  return flags;
}

function actionLabel(action: RecoveryActionType): string {
  if (action === "restart") return "Restart";
  if (action === "scale") return "Scale";
  if (action === "redeploy") return "Redeploy";
  return "Failover";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
