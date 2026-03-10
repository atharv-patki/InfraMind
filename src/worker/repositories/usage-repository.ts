import type { PlanLimitMetric } from "../lib/plan";

export type UsageCounterRow = {
  user_id: string;
  period: string;
  metric: PlanLimitMetric;
  value: number;
  updated_at: string;
};

export type ResourceUsageCounts = {
  servers: number;
  automation_rules: number;
  api_keys: number;
};

export async function getResourceUsageCounts(env: Env, userId: string): Promise<ResourceUsageCounts> {
  const [serverCountRow, ruleCountRow, apiKeyCountRow] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) as count FROM servers").first<{ count: number }>(),
    env.DB.prepare("SELECT COUNT(*) as count FROM automation_rules").first<{ count: number }>(),
    env.DB.prepare("SELECT COUNT(*) as count FROM api_keys WHERE user_id = ?1")
      .bind(userId)
      .first<{ count: number }>(),
  ]);

  return {
    servers: Number(serverCountRow?.count ?? 0),
    automation_rules: Number(ruleCountRow?.count ?? 0),
    api_keys: Number(apiKeyCountRow?.count ?? 0),
  };
}

export async function getUsageCounters(
  env: Env,
  userId: string,
  period: string
): Promise<Map<PlanLimitMetric, number>> {
  const rows = await env.DB.prepare(
    `
      SELECT user_id, period, metric, value, updated_at
      FROM usage_counters
      WHERE user_id = ?1 AND period = ?2
    `
  )
    .bind(userId, period)
    .all<UsageCounterRow>();

  const usageByMetric = new Map<PlanLimitMetric, number>();
  for (const row of (rows.results ?? []) as UsageCounterRow[]) {
    usageByMetric.set(row.metric, Number(row.value ?? 0));
  }

  return usageByMetric;
}

export async function upsertQuotaAlertEvent(
  env: Env,
  input: {
    userId: string;
    period: string;
    metric: PlanLimitMetric;
    thresholdPercent: number;
    currentValue: number;
    limitValue: number;
  }
): Promise<{ created: boolean }> {
  const id = `${input.userId}:${input.period}:${input.metric}:${input.thresholdPercent}`;
  const now = new Date().toISOString();
  const existing = await env.DB.prepare(
    `
      SELECT id
      FROM quota_alert_events
      WHERE id = ?1
      LIMIT 1
    `
  )
    .bind(id)
    .first<{ id: string }>();

  await env.DB.prepare(
    `
      INSERT INTO quota_alert_events (
        id,
        user_id,
        period,
        metric,
        threshold_percent,
        current_value,
        limit_value,
        created_at,
        updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
      ON CONFLICT(id) DO UPDATE SET
        current_value = excluded.current_value,
        limit_value = excluded.limit_value,
        updated_at = excluded.updated_at
    `
  )
    .bind(
      id,
      input.userId,
      input.period,
      input.metric,
      input.thresholdPercent,
      input.currentValue,
      input.limitValue,
      now,
      now
    )
    .run();

  return {
    created: !existing,
  };
}

export async function getQuotaAlertEvents(env: Env, userId: string, period: string) {
  const result = await env.DB.prepare(
    `
      SELECT
        id,
        user_id,
        period,
        metric,
        threshold_percent,
        current_value,
        limit_value,
        created_at,
        updated_at
      FROM quota_alert_events
      WHERE user_id = ?1 AND period = ?2
      ORDER BY updated_at DESC
    `
  )
    .bind(userId, period)
    .all<{
      id: string;
      user_id: string;
      period: string;
      metric: PlanLimitMetric;
      threshold_percent: number;
      current_value: number;
      limit_value: number;
      created_at: string;
      updated_at: string;
    }>();

  return (result.results ?? []) as Array<{
    id: string;
    user_id: string;
    period: string;
    metric: PlanLimitMetric;
    threshold_percent: number;
    current_value: number;
    limit_value: number;
    created_at: string;
    updated_at: string;
  }>;
}
