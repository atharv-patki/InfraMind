export type SubscriptionPlan = "starter" | "pro" | "enterprise";

export type PlanLimitMetric =
  | "servers"
  | "automation_rules"
  | "api_keys"
  | "workspace_invites_monthly"
  | "alerts_created_monthly"
  | "notification_tests_monthly"
  | "incident_exports_monthly";

export const PLAN_LIMITS: Record<SubscriptionPlan, Record<PlanLimitMetric, number>> = {
  starter: {
    servers: 5,
    automation_rules: 3,
    api_keys: 2,
    workspace_invites_monthly: 10,
    alerts_created_monthly: 50,
    notification_tests_monthly: 30,
    incident_exports_monthly: 20,
  },
  pro: {
    servers: 50,
    automation_rules: 30,
    api_keys: 20,
    workspace_invites_monthly: 250,
    alerts_created_monthly: 3000,
    notification_tests_monthly: 600,
    incident_exports_monthly: 500,
  },
  enterprise: {
    servers: 500,
    automation_rules: 200,
    api_keys: 100,
    workspace_invites_monthly: 5000,
    alerts_created_monthly: 50000,
    notification_tests_monthly: 10000,
    incident_exports_monthly: 10000,
  },
};

export function planRank(plan: SubscriptionPlan): number {
  if (plan === "enterprise") return 3;
  if (plan === "pro") return 2;
  return 1;
}

export function hasPlanAccess(
  currentPlan: SubscriptionPlan,
  minimumPlan: SubscriptionPlan
): boolean {
  return planRank(currentPlan) >= planRank(minimumPlan);
}
