import type { SubscriptionPlan } from "../lib/plan";

export type BillingStatus = "trialing" | "active" | "past_due" | "canceled";

export type BillingSubscriptionRow = {
  user_id: string;
  plan: SubscriptionPlan;
  status: BillingStatus;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  renews_at: string | null;
  updated_at: string;
};

export async function getBillingSubscriptionByUserId(env: Env, userId: string) {
  return env.DB.prepare(
    `
      SELECT
        user_id,
        plan,
        status,
        provider_customer_id,
        provider_subscription_id,
        renews_at,
        updated_at
      FROM billing_subscriptions
      WHERE user_id = ?1
      LIMIT 1
    `
  )
    .bind(userId)
    .first<BillingSubscriptionRow>();
}

export async function upsertBillingSubscription(
  env: Env,
  input: {
    userId: string;
    plan: SubscriptionPlan;
    status: BillingStatus;
    providerCustomerId: string | null;
    providerSubscriptionId: string | null;
    renewsAt: string | null;
    updatedAt: string;
  }
): Promise<void> {
  await env.DB.prepare(
    `
      INSERT INTO billing_subscriptions (
        user_id,
        plan,
        status,
        provider_customer_id,
        provider_subscription_id,
        renews_at,
        updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      ON CONFLICT(user_id) DO UPDATE SET
        plan = excluded.plan,
        status = excluded.status,
        provider_customer_id = excluded.provider_customer_id,
        provider_subscription_id = excluded.provider_subscription_id,
        renews_at = excluded.renews_at,
        updated_at = excluded.updated_at
    `
  )
    .bind(
      input.userId,
      input.plan,
      input.status,
      input.providerCustomerId,
      input.providerSubscriptionId,
      input.renewsAt,
      input.updatedAt
    )
    .run();
}

export async function setUserPlan(env: Env, userId: string, plan: SubscriptionPlan): Promise<void> {
  await env.DB.prepare(
    `
      UPDATE users
      SET plan = ?1, updated_at = ?2
      WHERE id = ?3
    `
  )
    .bind(plan, new Date().toISOString(), userId)
    .run();
}

export async function getWorkspaceIdForUser(env: Env, userId: string): Promise<string | null> {
  const row = await env.DB.prepare(
    `
      SELECT workspace_id
      FROM memberships
      WHERE user_id = ?1 AND status = 'active'
      ORDER BY created_at ASC
      LIMIT 1
    `
  )
    .bind(userId)
    .first<{ workspace_id: string }>();
  return row?.workspace_id ?? null;
}
