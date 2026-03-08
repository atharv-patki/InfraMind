export type SubscriptionPlan = "starter" | "pro" | "enterprise";

const planOrder: Record<SubscriptionPlan, number> = {
  starter: 1,
  pro: 2,
  enterprise: 3,
};

export function normalizePlan(value: string | null | undefined): SubscriptionPlan {
  if (value === "pro" || value === "enterprise" || value === "starter") {
    return value;
  }
  return "pro";
}

export function hasPlanAccess(
  currentPlan: SubscriptionPlan,
  minimumPlan: SubscriptionPlan
): boolean {
  return planOrder[currentPlan] >= planOrder[minimumPlan];
}

export function getPlanLabel(plan: SubscriptionPlan): string {
  if (plan === "enterprise") return "Enterprise";
  if (plan === "pro") return "Pro";
  return "Starter";
}
