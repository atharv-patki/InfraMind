export type AwsEnvironment = "dev" | "staging" | "prod";

export type AwsServiceType = "EC2" | "ECS" | "Lambda" | "RDS" | "ALB";

export type OpsConnectionStatus =
  | "disconnected"
  | "connected"
  | "permission_denied"
  | "partial_outage"
  | "recovery_running";

export type IncidentSeverity = "Critical" | "High" | "Medium" | "Low";

export type IncidentStatus =
  | "Detected"
  | "Analyzing"
  | "Recovering"
  | "Resolved"
  | "Escalated";

export type ResourceHealth = "Healthy" | "Warning" | "Critical";

export type RecoveryActionType = "restart" | "scale" | "redeploy" | "failover";

export type IamPermissionStatus = "granted" | "missing" | "unknown";

export type IamPermissionCheck = {
  name: string;
  status: IamPermissionStatus;
  detail: string;
};

export type AlertChannels = {
  email: boolean;
  sms: boolean;
  slack: boolean;
  teams: boolean;
};

export type AwsOpsConfig = {
  accountId: string;
  region: string;
  environment: AwsEnvironment;
  connectionStatus: OpsConnectionStatus;
  autoRecoveryEnabled: boolean;
  alertChannels: AlertChannels;
  iamPermissions: IamPermissionCheck[];
};

export type OverviewRegionHealth = {
  region: string;
  healthScore: number;
  activeIncidents: number;
  recoveryRunning: number;
};

export type OverviewData = {
  serviceHealthScore: number;
  activeIncidents: number;
  recoveriesToday: number;
  meanRecoveryTimeMinutes: number;
  incidentTrend: number[];
  regions: OverviewRegionHealth[];
};

export type InfrastructureResource = {
  id: string;
  name: string;
  type: AwsServiceType;
  region: string;
  health: ResourceHealth;
  owner: string;
  team: string;
  cpuUtilization: number;
  memoryUtilization: number;
  requestsPerMinute: number;
  uptime: string;
  lastEvent: string;
};

export type IncidentTimelineEvent = {
  id: string;
  at: string;
  title: string;
  detail: string;
  state: IncidentStatus;
};

export type AlertIncident = {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  source: string;
  service: AwsServiceType;
  owner: string;
  team: string;
  detectedAt: string;
  recoveryAction: RecoveryActionType | null;
  timeline: IncidentTimelineEvent[];
};

export type RecoveryPlaybook = {
  id: string;
  name: string;
  triggerCondition: string;
  actions: RecoveryActionType[];
  cooldownSeconds: number;
  verificationWindowSeconds: number;
  escalationTarget: string;
  enabled: boolean;
  lastRun: string;
  successRate: number;
};

export type IncidentAuditRecord = {
  id: string;
  incidentId: string;
  summary: string;
  verificationResult: "passed" | "failed";
  executedActions: RecoveryActionType[];
  humanNotes: string;
  updatedAt: string;
  timeline: IncidentTimelineEvent[];
};

export type MetricsRange = "15m" | "1h" | "24h";

export type MetricsCompareRange = "none" | "previous_period" | "previous_day";

export type MetricsFilters = {
  region: string;
  service: AwsServiceType | "All";
  resourceId: string;
};

export type MetricsSeries = {
  cpu: number[];
  memory: number[];
  disk: number[];
  network: number[];
  errorRate: number[];
  responseTime: number[];
  anomalies: number[];
};

export type MetricsSnapshot = {
  at: string;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  errorRate: number;
  responseTime: number;
};

export type AlertsStreamSnapshot = {
  at: string;
  activeAlerts: number;
  signal: "attention" | "normal";
};
