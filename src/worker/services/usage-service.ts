import { PLAN_LIMITS, type PlanLimitMetric, type SubscriptionPlan } from "../lib/plan";
import {
  getQuotaAlertEvents,
  getResourceUsageCounts,
  getUsageCounters,
  upsertQuotaAlertEvent,
} from "../repositories/usage-repository";

export type UsageSnapshot = {
  period: string;
  plan: SubscriptionPlan;
  limits: Record<PlanLimitMetric, number>;
  usage: Record<PlanLimitMetric, number>;
  remaining: Record<PlanLimitMetric, number>;
  quotaAlerts: Array<{
    metric: PlanLimitMetric;
    level: "warning" | "critical";
    thresholdPercent: number;
    usage: number;
    limit: number;
    percentUsed: number;
  }>;
  newlyTriggeredQuotaAlerts: Array<{
    metric: PlanLimitMetric;
    level: "warning" | "critical";
    thresholdPercent: number;
    usage: number;
    limit: number;
    percentUsed: number;
  }>;
};

const WARNING_THRESHOLD_PERCENT = 80;
const CRITICAL_THRESHOLD_PERCENT = 95;

export function getCurrentUsagePeriod(date = new Date()): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
}

export function buildQuotaAlerts(input: {
  limits: Record<PlanLimitMetric, number>;
  usage: Record<PlanLimitMetric, number>;
}) {
  const alerts: Array<{
    metric: PlanLimitMetric;
    level: "warning" | "critical";
    thresholdPercent: number;
    usage: number;
    limit: number;
    percentUsed: number;
  }> = [];

  const metrics = Object.keys(input.limits) as PlanLimitMetric[];
  for (const metric of metrics) {
    const limit = input.limits[metric];
    if (limit <= 0) continue;

    const usageValue = input.usage[metric] ?? 0;
    const percentUsed = Math.round((usageValue / limit) * 100);

    if (percentUsed >= CRITICAL_THRESHOLD_PERCENT) {
      alerts.push({
        metric,
        level: "critical",
        thresholdPercent: CRITICAL_THRESHOLD_PERCENT,
        usage: usageValue,
        limit,
        percentUsed,
      });
      continue;
    }

    if (percentUsed >= WARNING_THRESHOLD_PERCENT) {
      alerts.push({
        metric,
        level: "warning",
        thresholdPercent: WARNING_THRESHOLD_PERCENT,
        usage: usageValue,
        limit,
        percentUsed,
      });
    }
  }

  return alerts.sort((a, b) => b.percentUsed - a.percentUsed);
}

export async function getUsageSnapshot(
  env: Env,
  input: {
    userId: string;
    plan: SubscriptionPlan;
  }
): Promise<UsageSnapshot> {
  const period = getCurrentUsagePeriod();
  const limits = PLAN_LIMITS[input.plan];

  const [resourceCounts, usageCounters] = await Promise.all([
    getResourceUsageCounts(env, input.userId),
    getUsageCounters(env, input.userId, period),
  ]);

  const usage: Record<PlanLimitMetric, number> = {
    servers: resourceCounts.servers,
    automation_rules: resourceCounts.automation_rules,
    api_keys: resourceCounts.api_keys,
    workspace_invites_monthly: usageCounters.get("workspace_invites_monthly") ?? 0,
    alerts_created_monthly: usageCounters.get("alerts_created_monthly") ?? 0,
    notification_tests_monthly: usageCounters.get("notification_tests_monthly") ?? 0,
    incident_exports_monthly: usageCounters.get("incident_exports_monthly") ?? 0,
  };

  const remaining: Record<PlanLimitMetric, number> = {
    servers: Math.max(0, limits.servers - usage.servers),
    automation_rules: Math.max(0, limits.automation_rules - usage.automation_rules),
    api_keys: Math.max(0, limits.api_keys - usage.api_keys),
    workspace_invites_monthly: Math.max(0, limits.workspace_invites_monthly - usage.workspace_invites_monthly),
    alerts_created_monthly: Math.max(0, limits.alerts_created_monthly - usage.alerts_created_monthly),
    notification_tests_monthly: Math.max(
      0,
      limits.notification_tests_monthly - usage.notification_tests_monthly
    ),
    incident_exports_monthly: Math.max(0, limits.incident_exports_monthly - usage.incident_exports_monthly),
  };

  const quotaAlerts = buildQuotaAlerts({ limits, usage });
  const newlyTriggeredQuotaAlerts: UsageSnapshot["newlyTriggeredQuotaAlerts"] = [];

  for (const alert of quotaAlerts) {
    const upsert = await upsertQuotaAlertEvent(env, {
      userId: input.userId,
      period,
      metric: alert.metric,
      thresholdPercent: alert.thresholdPercent,
      currentValue: alert.usage,
      limitValue: alert.limit,
    });
    if (upsert.created) {
      newlyTriggeredQuotaAlerts.push(alert);
    }
  }

  return {
    period,
    plan: input.plan,
    limits,
    usage,
    remaining,
    quotaAlerts,
    newlyTriggeredQuotaAlerts,
  };
}

export async function getStoredQuotaAlerts(env: Env, userId: string): Promise<UsageSnapshot["quotaAlerts"]> {
  const period = getCurrentUsagePeriod();
  const rows = await getQuotaAlertEvents(env, userId, period);
  return rows.map((row) => {
    const percentUsed = row.limit_value > 0 ? Math.round((row.current_value / row.limit_value) * 100) : 0;
    return {
      metric: row.metric,
      level: row.threshold_percent >= CRITICAL_THRESHOLD_PERCENT ? "critical" : "warning",
      thresholdPercent: row.threshold_percent,
      usage: row.current_value,
      limit: row.limit_value,
      percentUsed,
    };
  });
}
