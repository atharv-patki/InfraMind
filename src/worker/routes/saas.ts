import { Hono, type Context } from "hono";
import { z } from "zod";
import type { SubscriptionPlan } from "../lib/plan";
import {
  getBillingSubscriptionByUserId,
  getWorkspaceIdForUser,
  setUserPlan,
  upsertBillingSubscription,
} from "../repositories/billing-repository";
import {
  getDuplicateMembershipRows,
  getHighFanoutUsers,
  getMembershipsForUser,
  getOrphanSessionCount,
} from "../repositories/tenancy-repository";
import { processStripeWebhook } from "../services/billing-service";
import { evaluateTenantIsolation } from "../services/tenant-isolation-service";
import { getStoredQuotaAlerts, getUsageSnapshot } from "../services/usage-service";

type WorkerApp = Hono<{ Bindings: Env }>;
type WorkerContext = Context<{ Bindings: Env }>;

type AuthUserLike = {
  id: string;
  email: string;
  plan: SubscriptionPlan;
};

type WorkspacePermission = {
  workspaceId: string;
  role: string;
};

type WorkspaceRole = "owner" | "admin" | "engineer" | "viewer";

type SaasRouteDeps = {
  ensureSchema: (env: Env) => Promise<void>;
  requireAuthenticatedUser: (c: WorkerContext) => Promise<Response | AuthUserLike>;
  requireWorkspaceViewerRole: (env: Env, userId: string) => Promise<Response | WorkspacePermission>;
  requireWorkspaceRole: (
    env: Env,
    userId: string,
    allowedRoles: WorkspaceRole[]
  ) => Promise<Response | WorkspacePermission>;
  readBody: (c: WorkerContext) => Promise<Record<string, unknown> | null>;
  parseBodyWithSchema: <TSchema extends z.ZodTypeAny>(
    c: WorkerContext,
    body: Record<string, unknown> | null,
    schema: TSchema,
    fallback?: string
  ) => { data: z.infer<TSchema> } | { response: Response };
  appendAuditLog: (env: Env, input: {
    workspaceId: string;
    userId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
  }) => Promise<void>;
  dispatchNotification: (env: Env, input: {
    workspaceId: string;
    incidentId: string | null;
    type: "email" | "sms" | "slack" | "teams";
    target: string;
    source: "test" | "system";
    maxAttempts?: number;
  }) => Promise<unknown>;
  normalizePlan: (value: string) => SubscriptionPlan;
};

const billingSubscriptionUpdateSchema = z.object({
  plan: z.enum(["starter", "pro", "enterprise"]),
  status: z.enum(["trialing", "active", "past_due", "canceled"]),
  providerCustomerId: z.string().trim().max(120).optional(),
  providerSubscriptionId: z.string().trim().max(120).optional(),
  renewsAt: z.string().trim().optional(),
});

async function dispatchQuotaAlerts(
  c: WorkerContext,
  deps: SaasRouteDeps,
  input: {
    user: AuthUserLike;
    workspaceId: string;
    alerts: Array<{
      metric: string;
      level: "warning" | "critical";
      thresholdPercent: number;
      usage: number;
      limit: number;
      percentUsed: number;
    }>;
  }
): Promise<void> {
  if (input.alerts.length === 0) return;

  const channelConfig = await c.env.DB.prepare(
    `
      SELECT channel_email, channel_sms, channel_slack, channel_teams
      FROM aws_connections
      WHERE user_id = ?1
      LIMIT 1
    `
  )
    .bind(input.user.id)
    .first<{
      channel_email: number;
      channel_sms: number;
      channel_slack: number;
      channel_teams: number;
    }>();

  if (!channelConfig) return;

  const smsTarget = c.env.QUOTA_ALERT_SMS_TARGET || "+15550001111";
  const slackTarget = c.env.QUOTA_ALERT_SLACK_WEBHOOK || "https://hooks.slack.com/services/quota-alerts";
  const teamsTarget = c.env.QUOTA_ALERT_TEAMS_WEBHOOK || "https://outlook.office.com/webhook/quota-alerts";

  for (const alert of input.alerts) {
    const summary = `[${alert.level.toUpperCase()}] ${alert.metric} usage ${alert.percentUsed}% (${alert.usage}/${alert.limit})`;

    const deliveries: Promise<unknown>[] = [];
    if (channelConfig.channel_email) {
      deliveries.push(
        deps.dispatchNotification(c.env, {
          workspaceId: input.workspaceId,
          incidentId: null,
          type: "email",
          target: input.user.email,
          source: "system",
          maxAttempts: 2,
        })
      );
    }
    if (channelConfig.channel_sms) {
      deliveries.push(
        deps.dispatchNotification(c.env, {
          workspaceId: input.workspaceId,
          incidentId: null,
          type: "sms",
          target: smsTarget,
          source: "system",
          maxAttempts: 2,
        })
      );
    }
    if (channelConfig.channel_slack) {
      deliveries.push(
        deps.dispatchNotification(c.env, {
          workspaceId: input.workspaceId,
          incidentId: null,
          type: "slack",
          target: `${slackTarget}?msg=${encodeURIComponent(summary)}`,
          source: "system",
          maxAttempts: 2,
        })
      );
    }
    if (channelConfig.channel_teams) {
      deliveries.push(
        deps.dispatchNotification(c.env, {
          workspaceId: input.workspaceId,
          incidentId: null,
          type: "teams",
          target: `${teamsTarget}?msg=${encodeURIComponent(summary)}`,
          source: "system",
          maxAttempts: 2,
        })
      );
    }

    await Promise.allSettled(deliveries);

    await deps.appendAuditLog(c.env, {
      workspaceId: input.workspaceId,
      userId: input.user.id,
      action: "quota.alert.triggered",
      entityType: "usage_quota",
      entityId: `${alert.metric}:${alert.thresholdPercent}`,
      metadata: {
        metric: alert.metric,
        level: alert.level,
        usage: alert.usage,
        limit: alert.limit,
        percentUsed: alert.percentUsed,
      },
    });
  }
}

export function registerSaaSRoutes(app: WorkerApp, deps: SaasRouteDeps): void {
  app.get("/api/usage/me", async (c) => {
    const authUser = await deps.requireAuthenticatedUser(c);
    if (authUser instanceof Response) return authUser;

    await deps.ensureSchema(c.env);

    const permission = await deps.requireWorkspaceViewerRole(c.env, authUser.id);
    if (permission instanceof Response) return permission;

    const snapshot = await getUsageSnapshot(c.env, {
      userId: authUser.id,
      plan: authUser.plan,
    });

    await dispatchQuotaAlerts(c, deps, {
      user: authUser,
      workspaceId: permission.workspaceId,
      alerts: snapshot.newlyTriggeredQuotaAlerts,
    });

    return c.json(snapshot);
  });

  app.get("/api/usage/alerts", async (c) => {
    const authUser = await deps.requireAuthenticatedUser(c);
    if (authUser instanceof Response) return authUser;

    await deps.ensureSchema(c.env);

    const permission = await deps.requireWorkspaceViewerRole(c.env, authUser.id);
    if (permission instanceof Response) return permission;

    const alerts = await getStoredQuotaAlerts(c.env, authUser.id);
    return c.json({ alerts });
  });

  app.get("/api/billing/subscription", async (c) => {
    const authUser = await deps.requireAuthenticatedUser(c);
    if (authUser instanceof Response) return authUser;

    await deps.ensureSchema(c.env);

    const row = await getBillingSubscriptionByUserId(c.env, authUser.id);
    if (!row) {
      return c.json({
        subscription: {
          plan: authUser.plan,
          status: "trialing",
          providerCustomerId: null,
          providerSubscriptionId: null,
          renewsAt: null,
        },
        localOnly: true,
      });
    }

    return c.json({
      subscription: {
        plan: deps.normalizePlan(row.plan),
        status: row.status,
        providerCustomerId: row.provider_customer_id,
        providerSubscriptionId: row.provider_subscription_id,
        renewsAt: row.renews_at,
        updatedAt: row.updated_at,
      },
      localOnly: true,
    });
  });

  app.post("/api/billing/subscription", async (c) => {
    const authUser = await deps.requireAuthenticatedUser(c);
    if (authUser instanceof Response) return authUser;

    await deps.ensureSchema(c.env);

    const ownerCheck = await deps.requireWorkspaceRole(c.env, authUser.id, ["owner", "admin"]);
    if (ownerCheck instanceof Response) return ownerCheck;

    const body = await deps.readBody(c);
    const parsed = deps.parseBodyWithSchema(
      c,
      body,
      billingSubscriptionUpdateSchema,
      "Billing subscription payload is invalid."
    );
    if ("response" in parsed) return parsed.response;

    const now = new Date().toISOString();
    await upsertBillingSubscription(c.env, {
      userId: authUser.id,
      plan: parsed.data.plan,
      status: parsed.data.status,
      providerCustomerId: parsed.data.providerCustomerId ?? null,
      providerSubscriptionId: parsed.data.providerSubscriptionId ?? null,
      renewsAt: parsed.data.renewsAt ?? null,
      updatedAt: now,
    });

    await setUserPlan(c.env, authUser.id, parsed.data.plan);

    await deps.appendAuditLog(c.env, {
      workspaceId: ownerCheck.workspaceId,
      userId: authUser.id,
      action: "billing.subscription.updated",
      entityType: "billing_subscription",
      entityId: authUser.id,
      metadata: {
        plan: parsed.data.plan,
        status: parsed.data.status,
      },
    });

    return c.json({
      success: true,
      subscription: {
        plan: parsed.data.plan,
        status: parsed.data.status,
        providerCustomerId: parsed.data.providerCustomerId ?? null,
        providerSubscriptionId: parsed.data.providerSubscriptionId ?? null,
        renewsAt: parsed.data.renewsAt ?? null,
        updatedAt: now,
      },
      localOnly: true,
    });
  });

  app.post("/api/billing/webhooks/stripe", async (c) => {
    await deps.ensureSchema(c.env);

    const payloadText = await c.req.text();
    const result = await processStripeWebhook({
      payloadText,
      signatureHeader: c.req.header("stripe-signature") ?? null,
      webhookSecret: c.env.STRIPE_WEBHOOK_SECRET,
      allowInsecureBypass: String(c.env.BILLING_WEBHOOK_ALLOW_INSECURE || "").toLowerCase() === "true",
      normalizePlan: deps.normalizePlan,
    });

    if (!result.ok) {
      return c.json({ error: result.error ?? "Webhook rejected." }, result.status as 400 | 500);
    }

    if (!result.userId || !result.plan || !result.statusValue) {
      return c.json({ received: true, ignored: true, eventType: result.eventType ?? null });
    }

    const now = new Date().toISOString();
    await upsertBillingSubscription(c.env, {
      userId: result.userId,
      plan: result.plan,
      status: result.statusValue,
      providerCustomerId: result.providerCustomerId ?? null,
      providerSubscriptionId: result.providerSubscriptionId ?? null,
      renewsAt: result.renewsAt ?? null,
      updatedAt: now,
    });

    await setUserPlan(c.env, result.userId, result.plan);

    const workspaceId = await getWorkspaceIdForUser(c.env, result.userId);
    if (workspaceId) {
      await deps.appendAuditLog(c.env, {
        workspaceId,
        userId: result.userId,
        action: "billing.subscription.synced",
        entityType: "billing_subscription",
        entityId: result.userId,
        metadata: {
          provider: "stripe",
          eventType: result.eventType ?? "unknown",
          plan: result.plan,
          status: result.statusValue,
        },
      });
    }

    return c.json({
      received: true,
      synced: true,
      userId: result.userId,
      plan: result.plan,
      status: result.statusValue,
      eventType: result.eventType ?? null,
    });
  });

  app.get("/api/tenancy/validation", async (c) => {
    const authUser = await deps.requireAuthenticatedUser(c);
    if (authUser instanceof Response) return authUser;

    await deps.ensureSchema(c.env);

    const [memberships, duplicateMemberships, orphanSessionCount, highFanoutUsers] = await Promise.all([
      getMembershipsForUser(c.env, authUser.id),
      getDuplicateMembershipRows(c.env),
      getOrphanSessionCount(c.env),
      getHighFanoutUsers(c.env, 25),
    ]);

    const violations = evaluateTenantIsolation({
      duplicateMemberships,
      orphanSessionCount,
      highFanoutUsers,
      highFanoutThreshold: 25,
    });

    return c.json({
      healthy: violations.length === 0,
      membershipsChecked: memberships.length,
      violations,
    });
  });
}
