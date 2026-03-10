import { Hono, type Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import {
  PLAN_LIMITS,
  hasPlanAccess,
  type PlanLimitMetric,
  type SubscriptionPlan,
} from "./lib/plan";
import { applyDefaultSecurityHeaders, shouldSkipApiRequestLog } from "./middleware/http";
import {
  applyRateLimit,
  getClientIdentifier,
  resolveRateLimitBucket,
} from "./middleware/rate-limit";
import { registerMetaRoutes } from "./routes/meta";
import { registerSaaSRoutes } from "./routes/saas";
import { createUserAccount, getUserCredentialsByEmail } from "./services/auth-service";
import { enforceInviteAbusePolicy, enforceSignupAbusePolicy } from "./services/abuse-guard";
import { sendViaNotificationProvider } from "./services/notification-provider";

const app = new Hono<{ Bindings: Env }>();
const API_VERSION = "v1";

const SESSION_COOKIE_NAME = "inframind_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_HASH_ITERATIONS = 120_000;
const RESEND_API_URL = "https://api.resend.com/emails";
let welcomeEmailConfigWarned = false;

type HonoContext = Context<{ Bindings: Env }>;

type AuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  plan: SubscriptionPlan;
  createdAt: string;
  updatedAt: string;
};

type WorkspaceRole = "owner" | "admin" | "engineer" | "viewer";
type AuthTokenPurpose =
  | "password_reset"
  | "email_verification"
  | "workspace_invite";

type UserCredentialsRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  plan: SubscriptionPlan;
  email_verified?: number;
  password_hash: string;
  password_salt: string;
  created_at: string;
  updated_at: string;
};

type SessionUserRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  plan: SubscriptionPlan;
  emailVerified?: number;
  createdAt: string;
  updatedAt: string;
};

type WelcomeEmailStatus = "queued" | "disabled" | "failed";

type ServerRow = {
  id: string;
  name: string;
  ip: string;
  region: string;
  uptime: string;
  cpu: number;
  memory: number;
  status: "Healthy" | "Warning" | "Critical";
  last_heartbeat: string;
  created_at: string;
};

type AlertRow = {
  id: string;
  title: string;
  source: string;
  severity: "Critical" | "Warning" | "Info";
  status: "Active" | "Resolved";
  lifecycle_status?: AlertLifecycleStatus;
  owner?: string;
  team?: string;
  created_at: string;
};

type AlertLifecycleStatus =
  | "Detected"
  | "Analyzing"
  | "Recovering"
  | "Resolved"
  | "Escalated";

type DetectionRuleMetric =
  | "error_rate"
  | "response_time"
  | "cpu"
  | "memory"
  | "disk"
  | "network"
  | "active_alerts";

type DetectionRuleOperator = "gt" | "gte" | "lt" | "lte";

type DetectionRuleRow = {
  id: string;
  name: string;
  metric: DetectionRuleMetric;
  operator: DetectionRuleOperator;
  threshold: number;
  severity: "Critical" | "Warning" | "Info";
  cooldown_minutes: number;
  enabled: number;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
};

type PlaybookAction = "restart" | "scale" | "redeploy" | "failover";

type AutomationRuleRow = {
  id: string;
  name: string;
  trigger_condition: string;
  action: string;
  cooldown_minutes: number;
  enabled: number;
  last_run: string;
  success_rate: number;
  created_at: string;
};

type UserSettingsRow = {
  user_id: string;
  company: string;
  role: string;
  timezone: string;
  theme: "system" | "light" | "dark";
  email_alerts: number;
  slack_alerts: number;
  weekly_report: number;
  updated_at: string;
};

type ApiKeyRow = {
  id: string;
  user_id: string;
  name: string;
  key_value: string;
  created_at: string;
  last_used: string;
  is_active: number;
};

type AIRecommendationRow = {
  id: string;
  title: string;
  impact: string;
  priority: "High" | "Medium" | "Low";
  done: number;
};

type ServerResponseItem = {
  id: string;
  name: string;
  ip: string;
  region: string;
  uptime: string;
  cpu: number;
  memory: number;
  status: "Healthy" | "Warning" | "Critical";
  lastHeartbeat: string;
  createdAt: string;
};

type AlertResponseItem = {
  id: string;
  title: string;
  source: string;
  severity: "Critical" | "Warning" | "Info";
  status: "Active" | "Resolved";
  createdAt: string;
};

type RuleResponseItem = {
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

type AwsConnectionRow = {
  user_id: string;
  account_id: string;
  region: string;
  environment: "dev" | "staging" | "prod";
  role_arn: string;
  connection_status:
    | "disconnected"
    | "connected"
    | "permission_denied"
    | "partial_outage"
    | "recovery_running";
  auto_recovery_enabled: number;
  channel_email: number;
  channel_sms: number;
  channel_slack: number;
  channel_teams: number;
  updated_at: string;
};

type AuditNoteRow = {
  incident_id: string;
  note: string;
  updated_at: string;
};

type AuthTokenRow = {
  id: string;
  user_id: string;
  purpose: AuthTokenPurpose;
  token_hash: string;
  expires_at: string;
  consumed_at: string | null;
  metadata: string;
  created_at: string;
};

type WorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type NotificationDeliveryRow = {
  id: string;
  channel_type: "email" | "sms" | "slack" | "teams";
  target: string;
  status: "queued" | "sent" | "failed" | "dropped";
  provider_message_id: string | null;
  attempt_count: number;
  error_message: string | null;
  created_at: string;
};

type NotificationDeadLetterRow = {
  id: string;
  workspace_id: string;
  incident_id: string | null;
  channel_type: "email" | "sms" | "slack" | "teams";
  target: string;
  payload: string;
  reason: string;
  attempt_count: number;
  created_at: string;
};

const playbookExecutionLocks = new Map<string, number>();

const registerBodySchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  email: z.string().trim().email("Please provide a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
  plan: z.enum(["starter", "pro", "enterprise"]).optional(),
});

const loginBodySchema = z.object({
  email: z.string().trim().email("Please provide a valid email address."),
  password: z.string().min(1, "Password is required."),
});

const emailBodySchema = z.object({
  email: z.string().trim().email("Valid email is required."),
});

const tokenBodySchema = z.object({
  token: z.string().trim().min(1, "Token is required."),
});

const resetPasswordBodySchema = z.object({
  token: z.string().trim().min(1, "Token and new password are required."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
});

const workspaceInviteBodySchema = z.object({
  email: z.string().trim().email("Valid invite email is required."),
  role: z.enum(["owner", "admin", "engineer", "viewer"]).optional(),
});

const awsConfigUpdateSchema = z.object({
  accountId: z.string().trim().regex(/^\d{12}$/, "Account ID must be a 12-digit AWS account id.").optional(),
  region: z.string().trim().min(1, "Region cannot be empty.").max(64).optional(),
  environment: z.enum(["dev", "staging", "prod"]).optional(),
  roleArn: z
    .string()
    .trim()
    .regex(/^arn:aws:iam::\d{12}:role\/[A-Za-z0-9+=,.@_/-]{1,128}$/, "Role ARN format is invalid.")
    .optional(),
  connectionStatus: z
    .enum(["disconnected", "connected", "permission_denied", "partial_outage", "recovery_running"])
    .optional(),
  autoRecoveryEnabled: z.boolean().optional(),
  alertChannels: z
    .object({
      email: z.boolean().optional(),
      sms: z.boolean().optional(),
      slack: z.boolean().optional(),
      teams: z.boolean().optional(),
    })
    .optional(),
});

const notificationTestBodySchema = z.object({
  type: z.enum(["email", "sms", "slack", "teams"], {
    errorMap: () => ({ message: "Notification type and target are required." }),
  }),
  target: z.string().trim().min(1, "Notification type and target are required.").max(320),
});

const userProfileBodySchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().email("Please provide a valid email address.").optional(),
  company: z.string().trim().min(1).max(120).optional(),
  role: z.string().trim().min(1).max(80).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  emailAlerts: z.boolean().optional(),
  slackAlerts: z.boolean().optional(),
  weeklyReport: z.boolean().optional(),
});

const awsResourceActionSchema = z.object({
  action: z.enum(["restart", "scale", "redeploy", "failover"], {
    errorMap: () => ({ message: "Invalid resource action request." }),
  }),
});

const incidentStatusUpdateSchema = z.object({
  status: z.enum(["Detected", "Analyzing", "Recovering", "Resolved", "Escalated"], {
    errorMap: () => ({ message: "Invalid incident status update." }),
  }),
});

const incidentAssignmentSchema = z.object({
  owner: z.string().trim().min(1, "Owner is required.").max(120).optional(),
  team: z.string().trim().min(1, "Team is required.").max(120).optional(),
});

const detectionRuleCreateSchema = z.object({
  name: z.string().trim().min(1, "Rule name is required.").max(120),
  metric: z.enum(["error_rate", "response_time", "cpu", "memory", "disk", "network", "active_alerts"]),
  operator: z.enum(["gt", "gte", "lt", "lte"]),
  threshold: z.coerce.number().finite(),
  severity: z.enum(["Critical", "Warning", "Info"]).default("Warning"),
  cooldownMinutes: z.coerce.number().int().min(1).max(1_440).default(10),
});

const detectionRuleToggleSchema = z.object({
  enabled: z.boolean(),
});

const playbookCreateSchema = z.object({
  name: z.string().trim().min(1, "Playbook name is required.").max(120),
  triggerCondition: z.string().trim().min(1, "Trigger condition is required.").max(240),
  actions: z
    .array(z.enum(["restart", "scale", "redeploy", "failover"]))
    .min(1, "At least one action is required."),
  cooldownSeconds: z.coerce.number().int().min(60).max(86_400).default(300),
  verificationWindowSeconds: z.coerce.number().int().min(30).max(3_600).default(90),
  escalationTarget: z.string().trim().min(1).max(120).default("On-call SRE"),
});

const playbookEnabledSchema = z.object({
  enabled: z.boolean(),
});

const auditNoteUpdateSchema = z.object({
  note: z.string().trim().max(4_000).default(""),
});

const serverCreateSchema = z.object({
  name: z.string().trim().min(1, "Server name is required.").max(120),
  ip: z.string().trim().min(1, "Server IP is required.").max(64),
  region: z.string().trim().min(1).max(64).default("us-east-1"),
});

const alertCreateSchema = z.object({
  title: z.string().trim().min(1, "Alert title is required.").max(240),
  source: z.string().trim().min(1, "Alert source is required.").max(120),
  severity: z.enum(["Critical", "Warning", "Info"]),
  owner: z.string().trim().min(1).max(120).default("Platform SRE"),
  team: z.string().trim().min(1).max(120).default("Reliability"),
});

const alertUpdateSchema = z.object({
  status: z.enum(["Active", "Resolved"]),
});

const automationRuleCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  trigger: z.string().trim().min(1, "Trigger is required.").max(240),
  action: z.string().trim().min(1, "Action is required.").max(240),
  cooldownMinutes: z.coerce.number().int().min(1).max(1_440).default(15),
});

const automationRuleUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  runNow: z.boolean().optional(),
});

const aiRecommendationUpdateSchema = z.object({
  done: z.boolean(),
});

const userPasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password and new password are required."),
  newPassword: z.string().min(8, "New password must be at least 8 characters.").max(128),
});

const apiKeyCreateSchema = z.object({
  name: z.string().trim().min(1, "API key label is required.").max(120),
});

let schemaInitialized = false;

app.onError((error, c) => {
  console.error("Unhandled API error:", error);
  return c.json({ error: "Internal server error." }, 500);
});

app.use("*", async (c, next) => {
  await next();
  applyDefaultSecurityHeaders(c.res.headers, getRequestProtocol(c) === "https");
});

app.use("*", async (c, next) => {
  const startedAt = Date.now();
  await next();
  const durationMs = Date.now() - startedAt;
  const isApiRoute = c.req.path.startsWith("/api/");
  if (isApiRoute && !shouldSkipApiRequestLog(c.req.path)) {
    console.log(
      `${c.req.method} ${c.req.path} -> ${c.res.status} (${durationMs}ms)`
    );
  }
});

app.use("/api/*", async (c, next) => {
  const isStreamRoute =
    c.req.path === "/api/stream/metrics" ||
    c.req.path === "/api/stream/alerts" ||
    c.req.path === "/api/v1/stream/metrics" ||
    c.req.path === "/api/v1/stream/alerts";
  if (isStreamRoute) {
    await next();
    return;
  }

  const bucket = resolveRateLimitBucket(c.req.method, c.req.path);
  if (!bucket) {
    await next();
    return;
  }

  const clientId = getClientIdentifier(c);
  const result = applyRateLimit(bucket, clientId);

  c.header("X-RateLimit-Limit", String(result.limit));
  c.header("X-RateLimit-Remaining", String(result.remaining));
  c.header("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

  if (!result.allowed) {
    c.header("Retry-After", String(result.retryAfterSeconds));
    return c.json(
      {
        error:
          bucket === "auth"
            ? "Too many authentication attempts. Please try again shortly."
            : "Too many requests. Please retry in a moment.",
      },
      429
    );
  }

  await next();
});

registerMetaRoutes(app, API_VERSION);

app.post("/api/auth/register", async (c) => {
  try {
    await ensureSchema(c.env);

    const body = await readBody(c);
    const parsed = parseBodyWithSchema(c, body, registerBodySchema, "All fields are required.");
    if ("response" in parsed) return parsed.response;

    const firstName = parsed.data.firstName.trim();
    const lastName = parsed.data.lastName.trim();
    const email = normalizeEmail(parsed.data.email);
    const password = parsed.data.password;
    const plan = normalizePlan(parsed.data.plan ?? "pro");

    const abuseDecision = await enforceSignupAbusePolicy({
      env: c.env,
      email,
      ipAddress: getClientIdentifier(c),
    });
    if (abuseDecision) {
      return c.json(
        {
          error: abuseDecision.error,
          code: abuseDecision.code,
        },
        abuseDecision.status
      );
    }

    const existing = await getUserCredentialsByEmail(c.env, email);
    if (existing) {
      return c.json({ error: "An account with this email already exists." }, 409);
    }

    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    const salt = generateRandomToken(16);
    const passwordHash = await hashPassword(password, salt);

    await createUserAccount(c.env, {
      id: userId,
      firstName,
      lastName,
      email,
      plan,
      passwordHash,
      passwordSalt: salt,
      nowIso: now,
    });

    await ensureDefaultWorkspaceForUser(c.env, userId, `${firstName} ${lastName}`.trim());

    let welcomeEmailStatus: WelcomeEmailStatus = getWelcomeEmailStatus(c.env);
    if (welcomeEmailStatus === "queued") {
      try {
        await sendWelcomeEmail({
          env: c.env,
          firstName,
          lastName,
          recipientEmail: email,
          requestUrl: c.req.url,
        });
      } catch (error) {
        welcomeEmailStatus = "failed";
        console.error("Welcome email failed:", error);
      }
    } else if (!welcomeEmailConfigWarned) {
      welcomeEmailConfigWarned = true;
      console.warn(
        "Welcome email is disabled: RESEND_API_KEY is not configured for the current runtime."
      );
    }

    return c.json(
      {
        user: {
          id: userId,
          firstName,
          lastName,
          email,
          plan,
          createdAt: now,
          updatedAt: now,
        } satisfies AuthUser,
        message: getWelcomeEmailMessage(welcomeEmailStatus),
        welcomeEmailStatus,
      },
      201
    );
  } catch (error) {
    console.error("Register failed:", error);
    return c.json({ error: "Unable to create account right now." }, 500);
  }
});

app.post("/api/auth/login", async (c) => {
  try {
    await ensureSchema(c.env);

    const body = await readBody(c);
    const parsed = parseBodyWithSchema(c, body, loginBodySchema, "Email and password are required.");
    if ("response" in parsed) return parsed.response;

    const email = normalizeEmail(parsed.data.email);
    const password = parsed.data.password;

    const user = await getUserCredentialsByEmail(c.env, email);

    if (!user) {
      return c.json({ error: "Invalid email or password." }, 401);
    }

    const expectedHash = await hashPassword(password, user.password_salt);
    if (!safeCompare(user.password_hash, expectedHash)) {
      return c.json({ error: "Invalid email or password." }, 401);
    }

    await createSession(c, user.id);

    return c.json({
      user: toAuthUser(user),
    });
  } catch (error) {
    console.error("Login failed:", error);
    return c.json({ error: "Unable to sign in right now." }, 500);
  }
});

app.get("/api/auth/me", async (c) => {
  try {
    await ensureSchema(c.env);

    const user = await getUserFromSession(c);
    if (!user) {
      return c.json({ error: "Not authenticated." }, 401);
    }

    return c.json({ user });
  } catch (error) {
    console.error("Auth me failed:", error);
    return c.json({ error: "Unable to verify session." }, 500);
  }
});

app.post("/api/auth/logout", async (c) => {
  try {
    await ensureSchema(c.env);

    const token = getCookie(c, SESSION_COOKIE_NAME);
    if (typeof token === "string") {
      await c.env.DB.prepare("DELETE FROM sessions WHERE token = ?1").bind(token).run();
    }

    clearSessionCookie(c);
    return c.json({ success: true });
  } catch (error) {
    console.error("Logout failed:", error);
    return c.json({ error: "Unable to logout right now." }, 500);
  }
});

app.post("/api/auth/request-password-reset", async (c) => {
  await ensureSchema(c.env);

  const body = await readBody(c);
  const parsed = parseBodyWithSchema(c, body, emailBodySchema, "Valid email is required.");
  if ("response" in parsed) return parsed.response;
  const email = normalizeEmail(parsed.data.email);

  const user = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?1 LIMIT 1")
    .bind(email)
    .first<{ id: string }>();
  if (user) {
    const created = await createAuthToken(c.env, user.id, "password_reset", 60 * 30, {
      email,
    });
    return c.json({
      success: true,
      message: "Password reset token created.",
      resetToken: created.token,
      expiresAt: created.expiresAt,
    });
  }

  return c.json({
    success: true,
    message: "If this email exists, a reset token has been created.",
  });
});

app.post("/api/auth/reset-password", async (c) => {
  await ensureSchema(c.env);

  const body = await readBody(c);
  const parsed = parseBodyWithSchema(
    c,
    body,
    resetPasswordBodySchema,
    "Token and new password are required."
  );
  if ("response" in parsed) return parsed.response;
  const token = parsed.data.token;
  const password = parsed.data.password;

  const authToken = await consumeAuthToken(c.env, token, "password_reset");
  if (!authToken) {
    return c.json({ error: "Reset token is invalid or expired." }, 400);
  }

  const salt = generateRandomToken(16);
  const passwordHash = await hashPassword(password, salt);
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `
      UPDATE users
      SET password_hash = ?1, password_salt = ?2, updated_at = ?3
      WHERE id = ?4
    `
  )
    .bind(passwordHash, salt, now, authToken.user_id)
    .run();

  await c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?1")
    .bind(authToken.user_id)
    .run();

  return c.json({ success: true, message: "Password updated successfully." });
});

app.post("/api/auth/request-email-verification", async (c) => {
  await ensureSchema(c.env);
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;

  const created = await createAuthToken(c.env, authUser.id, "email_verification", 60 * 60 * 24, {
    email: authUser.email,
  });

  return c.json({
    success: true,
    message: "Verification token created.",
    verificationToken: created.token,
    expiresAt: created.expiresAt,
  });
});

app.post("/api/auth/verify-email", async (c) => {
  await ensureSchema(c.env);

  const body = await readBody(c);
  const parsed = parseBodyWithSchema(c, body, tokenBodySchema, "Verification token is required.");
  if ("response" in parsed) return parsed.response;
  const token = parsed.data.token;

  const authToken = await consumeAuthToken(c.env, token, "email_verification");
  if (!authToken) {
    return c.json({ error: "Verification token is invalid or expired." }, 400);
  }

  await c.env.DB.prepare("UPDATE users SET email_verified = 1, updated_at = ?1 WHERE id = ?2")
    .bind(new Date().toISOString(), authToken.user_id)
    .run();

  return c.json({ success: true, message: "Email verified successfully." });
});

app.get("/api/workspaces/me", async (c) => {
  await ensureSchema(c.env);
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;

  const membership = await ensureDefaultWorkspaceForUser(c.env, authUser.id);
  const workspace = await c.env.DB.prepare(
    "SELECT id, name, slug, created_by, created_at, updated_at FROM workspaces WHERE id = ?1 LIMIT 1"
  )
    .bind(membership.workspaceId)
    .first<WorkspaceRow>();

  return c.json({
    workspace: workspace
      ? {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          role: membership.role,
        }
      : null,
  });
});

app.post("/api/workspaces/invitations", async (c) => {
  await ensureSchema(c.env);
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;

  const operator = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin"]);
  if (operator instanceof Response) return operator;

  const body = await readBody(c);
  const parsed = parseBodyWithSchema(c, body, workspaceInviteBodySchema, "Valid invite email is required.");
  if ("response" in parsed) return parsed.response;

  const planLimit = await requirePlanLimit(
    c,
    authUser,
    "workspace_invites_monthly",
    "Workspace invitations"
  );
  if (planLimit) return planLimit;

  const inviteeEmail = normalizeEmail(parsed.data.email);
  const role = normalizeWorkspaceRole(parsed.data.role ?? "viewer") ?? "viewer";

  const inviteAbuseDecision = await enforceInviteAbusePolicy({
    env: c.env,
    email: inviteeEmail,
    ipAddress: getClientIdentifier(c),
    workspaceId: operator.workspaceId,
  });
  if (inviteAbuseDecision) {
    return c.json(
      {
        error: inviteAbuseDecision.error,
        code: inviteAbuseDecision.code,
      },
      inviteAbuseDecision.status
    );
  }

  const created = await createAuthToken(c.env, authUser.id, "workspace_invite", 60 * 60 * 24 * 7, {
    workspaceId: operator.workspaceId,
    role,
    email: inviteeEmail,
    invitedBy: authUser.id,
  });
  const workspace = await c.env.DB.prepare(
    "SELECT id, name, slug, created_by, created_at, updated_at FROM workspaces WHERE id = ?1 LIMIT 1"
  )
    .bind(operator.workspaceId)
    .first<WorkspaceRow>();

  const appBaseUrl = normalizeBaseUrl(c.env.APP_BASE_URL) ?? getOriginFromUrl(c.req.url);
  const invitationUrl = appBaseUrl
    ? `${appBaseUrl}/invite/${encodeURIComponent(created.token)}`
    : `/invite/${encodeURIComponent(created.token)}`;

  const invitationEmailStatus = getWelcomeEmailStatus(c.env);
  if (invitationEmailStatus === "queued") {
    c.executionCtx.waitUntil(
      sendWorkspaceInvitationEmail({
        env: c.env,
        requestUrl: c.req.url,
        inviterName: `${authUser.firstName} ${authUser.lastName}`.trim(),
        inviteeEmail,
        workspaceName: workspace?.name ?? "InfraMind Workspace",
        role,
        invitationToken: created.token,
      }).catch((error) => {
        console.error("Workspace invitation email failed:", error);
      })
    );
  }

  await incrementUsageCounter(c.env, authUser.id, "workspace_invites_monthly");

  return c.json({
    success: true,
    invitationToken: created.token,
    invitationUrl,
    expiresAt: created.expiresAt,
    invitationEmailStatus,
  });
});

app.post("/api/workspaces/invitations/:token/accept", async (c) => {
  await ensureSchema(c.env);
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;

  const token = c.req.param("token")?.trim();
  if (!token) {
    return c.json({ error: "Invitation token is required." }, 400);
  }

  const authToken = await consumeAuthToken(c.env, token, "workspace_invite");
  if (!authToken) {
    return c.json({ error: "Invitation token is invalid or expired." }, 400);
  }

  const metadata = parseJsonRecord(authToken.metadata);
  const workspaceId = typeof metadata.workspaceId === "string" ? metadata.workspaceId : "";
  const role = normalizeWorkspaceRole(typeof metadata.role === "string" ? metadata.role : "") ?? "viewer";
  const invitedEmail = normalizeEmail(typeof metadata.email === "string" ? metadata.email : "");

  if (!workspaceId || !invitedEmail) {
    return c.json({ error: "Invitation token metadata is invalid." }, 400);
  }
  if (invitedEmail !== normalizeEmail(authUser.email)) {
    return c.json({ error: "This invitation was issued for a different email." }, 403);
  }

  await upsertMembership(c.env, workspaceId, authUser.id, role, "active");

  const workspace = await c.env.DB.prepare(
    "SELECT id, name, slug, created_by, created_at, updated_at FROM workspaces WHERE id = ?1 LIMIT 1"
  )
    .bind(workspaceId)
    .first<WorkspaceRow>();

  return c.json({
    success: true,
    workspace: workspace
      ? {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          role,
        }
      : null,
  });
});

app.get("/api/aws/config", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceViewerRole(c.env, authUser.id);
  if (permission instanceof Response) return permission;
  await ensureAwsConnection(c.env, authUser.id);

  const config = await getAwsConfigForUser(c.env, authUser.id);
  return c.json({ config });
});

app.put("/api/aws/config", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin"]);
  if (permission instanceof Response) return permission;
  await ensureAwsConnection(c.env, authUser.id);

  const body = await readBody(c);
  const parsed = parseBodyWithSchema(c, body, awsConfigUpdateSchema, "Invalid AWS configuration payload.");
  if ("response" in parsed) return parsed.response;

  const accountId = parsed.data.accountId?.trim() ?? "";
  const region = parsed.data.region?.trim() ?? "";
  const environmentInput = parsed.data.environment ?? "";
  const roleArn = parsed.data.roleArn?.trim() ?? "";
  const connectionStatusInput = parsed.data.connectionStatus ?? "";
  const autoRecoveryEnabled =
    typeof parsed.data.autoRecoveryEnabled === "boolean"
      ? (parsed.data.autoRecoveryEnabled ? 1 : 0)
      : null;

  const emailChannel =
    typeof parsed.data.alertChannels?.email === "boolean"
      ? (parsed.data.alertChannels.email ? 1 : 0)
      : null;
  const smsChannel =
    typeof parsed.data.alertChannels?.sms === "boolean"
      ? (parsed.data.alertChannels.sms ? 1 : 0)
      : null;
  const slackChannel =
    typeof parsed.data.alertChannels?.slack === "boolean"
      ? (parsed.data.alertChannels.slack ? 1 : 0)
      : null;
  const teamsChannel =
    typeof parsed.data.alertChannels?.teams === "boolean"
      ? (parsed.data.alertChannels.teams ? 1 : 0)
      : null;

  await c.env.DB.prepare(
    `
      UPDATE aws_connections
      SET
        account_id = COALESCE(NULLIF(?1, ''), account_id),
        region = COALESCE(NULLIF(?2, ''), region),
        environment = CASE
          WHEN ?3 IN ('dev','staging','prod') THEN ?3
          ELSE environment
        END,
        role_arn = COALESCE(NULLIF(?4, ''), role_arn),
        connection_status = CASE
          WHEN ?5 IN ('disconnected','connected','permission_denied','partial_outage','recovery_running') THEN ?5
          ELSE connection_status
        END,
        auto_recovery_enabled = COALESCE(?6, auto_recovery_enabled),
        channel_email = COALESCE(?7, channel_email),
        channel_sms = COALESCE(?8, channel_sms),
        channel_slack = COALESCE(?9, channel_slack),
        channel_teams = COALESCE(?10, channel_teams),
        updated_at = ?11
      WHERE user_id = ?12
    `
  )
    .bind(
      accountId,
      region,
      environmentInput,
      roleArn,
      connectionStatusInput,
      autoRecoveryEnabled,
      emailChannel,
      smsChannel,
      slackChannel,
      teamsChannel,
      new Date().toISOString(),
      authUser.id
    )
    .run();

  const config = await getAwsConfigForUser(c.env, authUser.id);
  return c.json({ config });
});

app.post("/api/aws/connect", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin"]);
  if (permission instanceof Response) return permission;
  await ensureAwsConnection(c.env, authUser.id);

  await c.env.DB.prepare(
    `
      UPDATE aws_connections
      SET connection_status = 'connected', updated_at = ?1
      WHERE user_id = ?2
    `
  )
    .bind(new Date().toISOString(), authUser.id)
    .run();

  const config = await getAwsConfigForUser(c.env, authUser.id);
  return c.json({ config });
});

app.post("/api/aws/disconnect", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin"]);
  if (permission instanceof Response) return permission;
  await ensureAwsConnection(c.env, authUser.id);

  await c.env.DB.prepare(
    `
      UPDATE aws_connections
      SET connection_status = 'disconnected', updated_at = ?1
      WHERE user_id = ?2
    `
  )
    .bind(new Date().toISOString(), authUser.id)
    .run();

  const config = await getAwsConfigForUser(c.env, authUser.id);
  return c.json({ config });
});

app.get("/api/aws/overview", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceViewerRole(c.env, authUser.id);
  if (permission instanceof Response) return permission;
  await runIncidentLifecyclePolicy(c.env);

  const servers = await c.env.DB.prepare(
    `SELECT id, name, ip, region, uptime, cpu, memory, status, last_heartbeat, created_at FROM servers`
  ).all<ServerRow>();

  const alerts = await c.env.DB.prepare(
    `SELECT id, title, source, severity, status, lifecycle_status, owner, team, created_at FROM alerts ORDER BY created_at DESC`
  ).all<AlertRow>();

  const allAlerts = (alerts.results ?? []) as AlertRow[];
  const activeIncidents = allAlerts.filter((item) => item.status !== "Resolved").length;
  const recoveriesToday =
    allAlerts.filter((item: AlertRow) => item.status === "Resolved").length + 4;
  const recovering = allAlerts.filter(
    (item: AlertRow) => resolveLifecycleStatus(item) === "Recovering"
  ).length;
  const regions = buildOverviewRegions(servers.results ?? [], allAlerts);

  return c.json({
    overview: {
      serviceHealthScore: clampNumber(98 - activeIncidents * 3, 60, 99),
      activeIncidents,
      recoveriesToday,
      meanRecoveryTimeMinutes: clampNumber(8 + recovering * 2, 6, 26),
      incidentTrend: [4, 5, 4, 6, 7, 4, 3, 5, 4, 6, 5, 3, 4, 3],
      regions,
    },
  });
});

app.get("/api/aws/resources", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceViewerRole(c.env, authUser.id);
  if (permission instanceof Response) return permission;

  const serviceFilter = c.req.query("service") ?? "All";

  const servers = await c.env.DB.prepare(
    `
      SELECT id, name, ip, region, uptime, cpu, memory, status, last_heartbeat, created_at
      FROM servers
      ORDER BY created_at DESC
    `
  ).all<ServerRow>();

  const resources = (servers.results ?? []).map((server: ServerRow) =>
    mapServerToInfrastructureResource(server)
  );

  return c.json({
    resources:
      serviceFilter === "All"
        ? resources
        : resources.filter((item: ReturnType<typeof mapServerToInfrastructureResource>) => item.type === serviceFilter),
  });
});

app.post("/api/aws/resources/:id/actions", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin", "engineer"]);
  if (permission instanceof Response) return permission;

  const resourceId = c.req.param("id");
  const body = await readBody(c);
  const parsed = parseBodyWithSchema(c, body, awsResourceActionSchema, "Invalid resource action request.");
  if ("response" in parsed) return parsed.response;
  const action = parsed.data.action;
  if (!resourceId) return c.json({ error: "Invalid resource action request." }, 400);

  const server = await c.env.DB.prepare(
    `SELECT id, cpu, memory, status FROM servers WHERE id = ?1 LIMIT 1`
  )
    .bind(resourceId)
    .first<{ id: string; cpu: number; memory: number; status: string }>();
  if (!server) {
    return c.json({ error: "Resource not found." }, 404);
  }

  let nextCpu = server.cpu;
  let nextMemory = server.memory;
  let nextStatus = server.status;

  if (action === "restart" || action === "redeploy") {
    nextCpu = clampNumber(server.cpu - 12, 10, 95);
    nextMemory = clampNumber(server.memory - 10, 10, 95);
    nextStatus = "Healthy";
  } else if (action === "scale") {
    nextCpu = clampNumber(server.cpu - 8, 10, 95);
    nextMemory = clampNumber(server.memory - 6, 10, 95);
    nextStatus = server.status === "Critical" ? "Warning" : server.status;
  }

  await c.env.DB.prepare(
    `
      UPDATE servers
      SET cpu = ?1, memory = ?2, status = ?3, last_heartbeat = ?4
      WHERE id = ?5
    `
  )
    .bind(nextCpu, nextMemory, nextStatus, "just now", resourceId)
    .run();

  await appendAuditLog(c.env, {
    workspaceId: permission.workspaceId,
    userId: authUser.id,
    action: "resource.quick_action",
    entityType: "resource",
    entityId: resourceId,
    metadata: { action, nextCpu, nextMemory, nextStatus },
  });

  return c.json({ success: true });
});

app.get("/api/aws/incidents", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceViewerRole(c.env, authUser.id);
  if (permission instanceof Response) return permission;
  await runIncidentLifecyclePolicy(c.env);

  const alerts = await c.env.DB.prepare(
    `
      SELECT id, title, source, severity, status, lifecycle_status, owner, team, created_at
      FROM alerts
      ORDER BY created_at DESC
    `
  ).all<AlertRow>();

  const incidents = (alerts.results ?? []).map((alert: AlertRow) =>
    mapAlertToIncident(alert)
  );

  return c.json({ incidents });
});

app.put("/api/aws/incidents/:id/status", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin", "engineer"]);
  if (permission instanceof Response) return permission;

  const id = c.req.param("id");
  const body = await readBody(c);
  const parsed = parseBodyWithSchema(
    c,
    body,
    incidentStatusUpdateSchema,
    "Invalid incident status update."
  );
  if ("response" in parsed) return parsed.response;
  const status = parsed.data.status;
  if (!id) return c.json({ error: "Invalid incident status update." }, 400);

  await updateIncidentLifecycleStatus(c.env, id, status, {
    actorId: authUser.id,
    workspaceId: permission.workspaceId,
    reason: "manual_status_update",
  });
  const alert = await getAlertById(c.env, id);
  if (!alert) {
    return c.json({ error: "Incident not found." }, 404);
  }
  return c.json({ incident: mapAlertToIncident(alert) });
});

app.put("/api/aws/incidents/:id/assignment", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin", "engineer"]);
  if (permission instanceof Response) return permission;

  const id = c.req.param("id");
  if (!id) return c.json({ error: "Incident id is required." }, 400);
  const body = await readBody(c);
  const parsed = parseBodyWithSchema(
    c,
    body,
    incidentAssignmentSchema,
    "Owner or team is required."
  );
  if ("response" in parsed) return parsed.response;
  const owner = parsed.data.owner?.trim();
  const team = parsed.data.team?.trim();
  if (!owner && !team) {
    return c.json({ error: "Owner or team is required." }, 400);
  }

  await c.env.DB.prepare(
    `
      UPDATE alerts
      SET
        owner = COALESCE(?1, owner),
        team = COALESCE(?2, team)
      WHERE id = ?3
    `
  )
    .bind(owner ?? null, team ?? null, id)
    .run();

  await appendAuditLog(c.env, {
    workspaceId: permission.workspaceId,
    userId: authUser.id,
    action: "incident.assignment.updated",
    entityType: "incident",
    entityId: id,
    metadata: {
      owner: owner ?? null,
      team: team ?? null,
    },
  });

  const alert = await getAlertById(c.env, id);
  if (!alert) return c.json({ error: "Incident not found." }, 404);
  return c.json({ incident: mapAlertToIncident(alert) });
});

app.post("/api/aws/incidents/:id/acknowledge", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin", "engineer"]);
  if (permission instanceof Response) return permission;
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Incident id is required." }, 400);
  await updateIncidentLifecycleStatus(c.env, id, "Analyzing", {
    actorId: authUser.id,
    workspaceId: permission.workspaceId,
    reason: "incident_acknowledged",
  });
  const alert = await getAlertById(c.env, id);
  if (!alert) return c.json({ error: "Incident not found." }, 404);
  return c.json({ incident: mapAlertToIncident(alert) });
});

app.post("/api/aws/incidents/:id/escalate", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin", "engineer"]);
  if (permission instanceof Response) return permission;
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Incident id is required." }, 400);
  await updateIncidentLifecycleStatus(c.env, id, "Escalated", {
    actorId: authUser.id,
    workspaceId: permission.workspaceId,
    reason: "incident_escalated",
  });
  const alert = await getAlertById(c.env, id);
  if (!alert) return c.json({ error: "Incident not found." }, 404);
  return c.json({ incident: mapAlertToIncident(alert) });
});

app.get("/api/aws/playbooks", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  const planCheck = requirePlanAccess(c, authUser, "pro", "Auto-healing playbooks");
  if (planCheck) return planCheck;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceViewerRole(c.env, authUser.id);
  if (permission instanceof Response) return permission;

  const rows = await c.env.DB.prepare(
    `
      SELECT
        id,
        name,
        trigger_condition,
        action_text,
        cooldown_minutes,
        verification_window_seconds,
        escalation_target,
        enabled,
        last_run,
        success_rate
      FROM automation_rules
      ORDER BY created_at DESC
    `
  ).all<{
    id: string;
    name: string;
    trigger_condition: string;
    action_text: string;
    cooldown_minutes: number;
    verification_window_seconds: number;
    escalation_target: string;
    enabled: number;
    last_run: string;
    success_rate: number;
  }>();

  return c.json({
    playbooks: ((rows.results ?? []) as Array<{
      id: string;
      name: string;
      trigger_condition: string;
      action_text: string;
      cooldown_minutes: number;
      verification_window_seconds: number;
      escalation_target: string;
      enabled: number;
      last_run: string;
      success_rate: number;
    }>).map((row) => ({
      id: row.id,
      name: row.name,
      triggerCondition: row.trigger_condition,
      actions: parsePlaybookActions(row.action_text),
      cooldownSeconds: row.cooldown_minutes * 60,
      verificationWindowSeconds: row.verification_window_seconds,
      escalationTarget: row.escalation_target,
      enabled: Boolean(row.enabled),
      lastRun: row.last_run,
      successRate: row.success_rate,
    })),
  });
});

app.post("/api/aws/playbooks", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  const planCheck = requirePlanAccess(c, authUser, "pro", "Auto-healing playbooks");
  if (planCheck) return planCheck;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin", "engineer"]);
  if (permission instanceof Response) return permission;

  const body = await readBody(c);
  const parsed = parseBodyWithSchema(
    c,
    body,
    playbookCreateSchema,
    "Playbook requires name, trigger, and at least one action."
  );
  if ("response" in parsed) return parsed.response;
  const name = parsed.data.name;
  const triggerCondition = parsed.data.triggerCondition;
  const actions = parsed.data.actions;
  const cooldownSeconds = parsed.data.cooldownSeconds;
  const verificationWindowSeconds = parsed.data.verificationWindowSeconds;
  const escalationTarget = parsed.data.escalationTarget;

  const planLimit = await requirePlanLimit(
    c,
    authUser,
    "automation_rules",
    "Automation rules",
    async () => {
      const row = await c.env.DB.prepare("SELECT COUNT(*) as count FROM automation_rules")
        .first<{ count: number }>();
      return Number(row?.count ?? 0);
    }
  );
  if (planLimit) return planLimit;

  const id = `pb-${Date.now()}`;
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `
      INSERT INTO automation_rules (
        id, name, trigger_condition, action_text, cooldown_minutes, verification_window_seconds,
        escalation_target, enabled, last_run, success_rate, created_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
    `
  )
    .bind(
      id,
      name,
      triggerCondition,
      actions.join(","),
      Math.max(1, Math.round(cooldownSeconds / 60)),
      Math.max(30, verificationWindowSeconds),
      escalationTarget,
      1,
      "Never",
      92,
      now
    )
    .run();

  await appendAuditLog(c.env, {
    workspaceId: permission.workspaceId,
    userId: authUser.id,
    action: "playbook.created",
    entityType: "playbook",
    entityId: id,
    metadata: {
      name,
      triggerCondition,
      actions,
      cooldownSeconds: Math.max(60, Math.round(cooldownSeconds)),
      verificationWindowSeconds: Math.max(30, verificationWindowSeconds),
      escalationTarget,
    },
  });

  return c.json(
    {
      playbook: {
        id,
        name,
        triggerCondition,
        actions,
        cooldownSeconds: Math.max(60, Math.round(cooldownSeconds)),
        verificationWindowSeconds: Math.max(30, verificationWindowSeconds),
        escalationTarget,
        enabled: true,
        lastRun: "Never",
        successRate: 92,
      },
    },
    201
  );
});

app.put("/api/aws/playbooks/:id/enabled", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  const planCheck = requirePlanAccess(c, authUser, "pro", "Auto-healing playbooks");
  if (planCheck) return planCheck;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin"]);
  if (permission instanceof Response) return permission;
  const id = c.req.param("id");
  const body = await readBody(c);
  const parsed = parseBodyWithSchema(c, body, playbookEnabledSchema, "Enabled state is required.");
  if ("response" in parsed) return parsed.response;
  const enabled = parsed.data.enabled;
  if (!id) return c.json({ error: "Playbook id is required." }, 400);
  await c.env.DB.prepare("UPDATE automation_rules SET enabled = ?1 WHERE id = ?2")
    .bind(enabled ? 1 : 0, id)
    .run();
  await appendAuditLog(c.env, {
    workspaceId: permission.workspaceId,
    userId: authUser.id,
    action: "playbook.toggled",
    entityType: "playbook",
    entityId: id,
    metadata: { enabled },
  });
  return c.json({ success: true });
});

app.post("/api/aws/playbooks/:id/run", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  const planCheck = requirePlanAccess(c, authUser, "pro", "Auto-healing playbooks");
  if (planCheck) return planCheck;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin", "engineer"]);
  if (permission instanceof Response) return permission;
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Playbook id is required." }, 400);
  const execution = await runPlaybookExecution(c.env, {
    playbookId: id,
    incidentId: null,
    runType: "manual",
    actorUserId: authUser.id,
    workspaceId: permission.workspaceId,
  });
  if (!execution.success && execution.code === "PLAYBOOK_NOT_FOUND") {
    return c.json({ error: "Playbook not found." }, 404);
  }
  if (!execution.success && execution.code === "PLAYBOOK_DISABLED") {
    return c.json({ error: "Playbook is disabled." }, 409);
  }
  if (!execution.success && execution.code === "PLAYBOOK_ALREADY_RUNNING") {
    return c.json({ error: "Playbook is already running. Please wait for completion." }, 409);
  }

  await appendAuditLog(c.env, {
    workspaceId: permission.workspaceId,
    userId: authUser.id,
    action: "playbook.run",
    entityType: "playbook",
    entityId: id,
    metadata: {
      runType: "manual",
      executionId: execution.executionId ?? null,
      status: execution.status,
      verificationResult: execution.verificationResult ?? null,
      retryCount: execution.retryCount ?? 0,
    },
  });
  return c.json({
    success: execution.success,
    execution: {
      id: execution.executionId,
      status: execution.status,
      verificationResult: execution.verificationResult,
      retryCount: execution.retryCount,
      message: execution.message,
    },
  });
});

app.delete("/api/aws/playbooks/:id", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  const planCheck = requirePlanAccess(c, authUser, "pro", "Auto-healing playbooks");
  if (planCheck) return planCheck;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin"]);
  if (permission instanceof Response) return permission;
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Playbook id is required." }, 400);
  await c.env.DB.prepare("DELETE FROM automation_rules WHERE id = ?1").bind(id).run();
  await appendAuditLog(c.env, {
    workspaceId: permission.workspaceId,
    userId: authUser.id,
    action: "playbook.deleted",
    entityType: "playbook",
    entityId: id,
    metadata: {},
  });
  return c.json({ success: true });
});

app.get("/api/aws/audits", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  const planCheck = requirePlanAccess(c, authUser, "pro", "Incident audit history");
  if (planCheck) return planCheck;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceViewerRole(c.env, authUser.id);
  if (permission instanceof Response) return permission;

  const alerts = await c.env.DB.prepare(
    `
      SELECT id, title, source, severity, status, lifecycle_status, owner, team, created_at
      FROM alerts
      ORDER BY created_at DESC
    `
  ).all<AlertRow>();
  const notes = await c.env.DB.prepare(
    `SELECT incident_id, note, updated_at FROM incident_audit_notes`
  ).all<AuditNoteRow>();
  const noteEntries = ((notes.results ?? []) as AuditNoteRow[]).map(
    (item: AuditNoteRow): [string, AuditNoteRow] => [item.incident_id, item]
  );
  const noteByIncidentId = new Map<string, AuditNoteRow>(noteEntries);

  const audits = ((alerts.results ?? []) as AlertRow[]).map((alert: AlertRow) => {
    const note = noteByIncidentId.get(alert.id);
    return mapAlertToAuditRecord(alert, note);
  });

  return c.json({ audits });
});

app.put("/api/aws/audits/:id/note", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  const planCheck = requirePlanAccess(c, authUser, "pro", "Incident audit history");
  if (planCheck) return planCheck;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin", "engineer"]);
  if (permission instanceof Response) return permission;

  const id = c.req.param("id");
  if (!id) return c.json({ error: "Audit id is required." }, 400);
  const incidentId = extractIncidentIdFromAuditId(id);
  if (!incidentId) return c.json({ error: "Invalid audit id." }, 400);

  const body = await readBody(c);
  const parsed = parseBodyWithSchema(c, body, auditNoteUpdateSchema, "Invalid incident note payload.");
  if ("response" in parsed) return parsed.response;
  const note = parsed.data.note;
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `
      INSERT INTO incident_audit_notes (incident_id, note, updated_at)
      VALUES (?1, ?2, ?3)
      ON CONFLICT(incident_id) DO UPDATE SET note = excluded.note, updated_at = excluded.updated_at
    `
  )
    .bind(incidentId, note, now)
    .run();

  await appendAuditLog(c.env, {
    workspaceId: permission.workspaceId,
    userId: authUser.id,
    action: "incident.note.updated",
    entityType: "incident",
    entityId: incidentId,
    metadata: { noteLength: note.length },
  });

  const alert = await getAlertById(c.env, incidentId);
  if (!alert) return c.json({ error: "Incident not found for this audit." }, 404);
  return c.json({
    audit: mapAlertToAuditRecord(alert, {
      incident_id: incidentId,
      note,
      updated_at: now,
    }),
  });
});

app.get("/api/aws/audits/:id/export", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  const planCheck = requirePlanAccess(c, authUser, "pro", "Incident audit export");
  if (planCheck) return planCheck;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceViewerRole(c.env, authUser.id);
  if (permission instanceof Response) return permission;

  const planLimit = await requirePlanLimit(
    c,
    authUser,
    "incident_exports_monthly",
    "Incident exports"
  );
  if (planLimit) return planLimit;

  const id = c.req.param("id");
  if (!id) return c.json({ error: "Audit id is required." }, 400);
  const incidentId = extractIncidentIdFromAuditId(id);
  if (!incidentId) return c.json({ error: "Invalid audit id." }, 400);

  const alert = await getAlertById(c.env, incidentId);
  if (!alert) return c.json({ error: "Incident not found for this audit." }, 404);

  const note = await c.env.DB.prepare(
    `SELECT incident_id, note, updated_at FROM incident_audit_notes WHERE incident_id = ?1 LIMIT 1`
  )
    .bind(incidentId)
    .first<AuditNoteRow>();

  const format = resolveIncidentExportFormat(c.req.query("format"));
  const report = buildIncidentExportReportPayload(alert, note?.note ?? "");
  const rendered = renderIncidentExportReport(report, format);
  await incrementUsageCounter(c.env, authUser.id, "incident_exports_monthly");
  return new Response(rendered.body, {
    headers: {
      "Content-Type": rendered.contentType,
      "Content-Disposition": `attachment; filename="${incidentId}-audit-report.${rendered.extension}"`,
    },
  });
});

app.post("/api/notifications/test", async (c) => {
  await ensureSchema(c.env);
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin"]);
  if (permission instanceof Response) return permission;

  const body = await readBody(c);
  const parsed = parseBodyWithSchema(
    c,
    body,
    notificationTestBodySchema,
    "Notification type and target are required."
  );
  if ("response" in parsed) return parsed.response;

  const planLimit = await requirePlanLimit(
    c,
    authUser,
    "notification_tests_monthly",
    "Notification tests"
  );
  if (planLimit) return planLimit;

  const dispatch = await dispatchNotification(c.env, {
    workspaceId: permission.workspaceId,
    incidentId: null,
    type: parsed.data.type,
    target: parsed.data.target,
    source: "test",
  });

  await appendAuditLog(c.env, {
    workspaceId: permission.workspaceId,
    userId: authUser.id,
    action: "notification.test.sent",
    entityType: "notification_delivery",
    entityId: dispatch.id,
    metadata: { type: parsed.data.type, target: parsed.data.target, status: dispatch.status },
  });
  await incrementUsageCounter(c.env, authUser.id, "notification_tests_monthly");

  return c.json({
    success: true,
    delivery: {
      id: dispatch.id,
      type: dispatch.type,
      target: dispatch.target,
      status: dispatch.status,
      createdAt: dispatch.createdAt,
    },
  });
});

app.get("/api/notifications/deliveries", async (c) => {
  await ensureSchema(c.env);
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin", "engineer", "viewer"]);
  if (permission instanceof Response) return permission;

  const statusFilter = c.req.query("status")?.trim().toLowerCase() ?? "";
  const page = parsePositiveInt(c.req.query("page"), 1);
  const limit = parseBoundedInt(c.req.query("limit"), 20, 1, 200);

  const rows = await c.env.DB.prepare(
    `
      SELECT
        id,
        channel_type,
        target,
        status,
        provider_message_id,
        attempt_count,
        error_message,
        created_at
      FROM notification_deliveries
      WHERE workspace_id = ?1
      ORDER BY created_at DESC
    `
  )
    .bind(permission.workspaceId)
    .all<NotificationDeliveryRow>();

  const allItems = (rows.results ?? []) as NotificationDeliveryRow[];
  const filtered = allItems.filter((item: NotificationDeliveryRow) => {
    if (!statusFilter) return true;
    return item.status.toLowerCase() === statusFilter;
  });
  const { items, meta } = paginateList(filtered, page, limit);

  return c.json({
    deliveries: items.map((item: NotificationDeliveryRow) => ({
      id: item.id,
      type: item.channel_type,
      target: item.target,
      status: item.status,
      providerMessageId: item.provider_message_id,
      attemptCount: item.attempt_count,
      errorMessage: item.error_message,
      createdAt: item.created_at,
    })),
    meta: {
      ...meta,
      filters: { status: statusFilter || null },
    },
  });
});

app.get("/api/notifications/dead-letters", async (c) => {
  await ensureSchema(c.env);
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin"]);
  if (permission instanceof Response) return permission;

  const page = parsePositiveInt(c.req.query("page"), 1);
  const limit = parseBoundedInt(c.req.query("limit"), 20, 1, 100);

  const rows = await c.env.DB.prepare(
    `
      SELECT
        id,
        workspace_id,
        incident_id,
        channel_type,
        target,
        payload,
        reason,
        attempt_count,
        created_at
      FROM notification_dead_letters
      WHERE workspace_id = ?1
      ORDER BY created_at DESC
    `
  )
    .bind(permission.workspaceId)
    .all<NotificationDeadLetterRow>();

  const allItems = (rows.results ?? []) as NotificationDeadLetterRow[];
  const { items, meta } = paginateList(allItems, page, limit);

  return c.json({
    deadLetters: items.map((item: NotificationDeadLetterRow) => ({
      id: item.id,
      incidentId: item.incident_id,
      type: item.channel_type,
      target: item.target,
      payload: parseJsonRecord(item.payload),
      reason: item.reason,
      attemptCount: item.attempt_count,
      createdAt: item.created_at,
    })),
    meta,
  });
});

app.get("/api/aws/metrics", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  const permission = await requireWorkspaceViewerRole(c.env, authUser.id);
  if (permission instanceof Response) return permission;

  const range = (c.req.query("range") ?? "1h") as "15m" | "1h" | "24h";
  const compareRange = (c.req.query("compareRange") ?? "none") as
    | "none"
    | "previous_period"
    | "previous_day";
  const filters = {
    region: c.req.query("region") ?? "All",
    service: c.req.query("service") ?? "All",
    resourceId: c.req.query("resourceId") ?? "All",
  };

  const primary = generateMetricsBundle(range);
  const compare = compareRange === "none" ? null : generateMetricsBundle(range);
  return c.json({ primary, compare, filters, range, compareRange });
});

app.get("/api/servers", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  const permission = await requireWorkspaceViewerRole(c.env, authUser.id);
  if (permission instanceof Response) return permission;

  await ensureSchema(c.env);
  const servers = await c.env.DB.prepare(
    `
      SELECT
        id,
        name,
        ip,
        region,
        uptime,
        cpu,
        memory,
        status,
        last_heartbeat,
        created_at
      FROM servers
      ORDER BY created_at DESC
    `
  ).all<ServerRow>();

  const allServers = (servers.results ?? []).map((server: ServerRow) => ({
    id: server.id,
    name: server.name,
    ip: server.ip,
    region: server.region,
    uptime: server.uptime,
    cpu: server.cpu,
    memory: server.memory,
    status: server.status,
    lastHeartbeat: server.last_heartbeat,
    createdAt: server.created_at,
  }));

  const search = c.req.query("search")?.trim().toLowerCase() ?? "";
  const statusFilter = c.req.query("status")?.trim();
  const regionFilter = c.req.query("region")?.trim();
  const sortBy = normalizeServerSortField(c.req.query("sortBy"));
  const sortDir = normalizeSortDirection(c.req.query("sortDir"));
  const page = parsePositiveInt(c.req.query("page"), 1);
  const limit = parseBoundedInt(c.req.query("limit"), 20, 1, 200);

  const filtered = allServers.filter((server: ServerResponseItem) => {
    const matchesSearch =
      !search ||
      server.id.toLowerCase().includes(search) ||
      server.name.toLowerCase().includes(search) ||
      server.ip.toLowerCase().includes(search) ||
      server.region.toLowerCase().includes(search);
    const matchesStatus = !statusFilter || server.status === statusFilter;
    const matchesRegion = !regionFilter || server.region === regionFilter;
    return matchesSearch && matchesStatus && matchesRegion;
  });

  const sorted = filtered.sort((left: ServerResponseItem, right: ServerResponseItem) =>
    compareValues(
      getServerSortValue(left, sortBy),
      getServerSortValue(right, sortBy),
      sortDir
    )
  );

  const { items, meta } = paginateList(sorted, page, limit);

  return c.json({
    servers: items,
    items,
    meta: {
      ...meta,
      sortBy,
      sortDir,
      filters: {
        search,
        status: statusFilter ?? null,
        region: regionFilter ?? null,
      },
    },
  });
});

app.post("/api/servers", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;

  await ensureSchema(c.env);
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin", "engineer"]);
  if (permission instanceof Response) return permission;

  const body = await readBody(c);
  const parsed = parseBodyWithSchema(c, body, serverCreateSchema, "Server name and IP are required.");
  if ("response" in parsed) return parsed.response;
  const name = parsed.data.name;
  const ip = parsed.data.ip;
  const region = parsed.data.region;

  const planLimit = await requirePlanLimit(
    c,
    authUser,
    "servers",
    "Servers",
    async () => {
      const row = await c.env.DB.prepare("SELECT COUNT(*) as count FROM servers")
        .first<{ count: number }>();
      return Number(row?.count ?? 0);
    }
  );
  if (planLimit) return planLimit;

  const id = `srv-${Date.now()}`;
  const cpu = randomInt(22, 92);
  const memory = randomInt(28, 94);
  const status =
    cpu >= 90 || memory >= 92
      ? "Critical"
      : cpu >= 78 || memory >= 82
      ? "Warning"
      : "Healthy";
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `
      INSERT INTO servers (
        id, name, ip, region, uptime, cpu, memory, status, last_heartbeat, created_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
    `
  )
    .bind(id, name, ip, region, "0d 00h", cpu, memory, status, "just now", now)
    .run();

  return c.json(
    {
      server: {
        id,
        name,
        ip,
        region,
        uptime: "0d 00h",
        cpu,
        memory,
        status,
        lastHeartbeat: "just now",
        createdAt: now,
      },
    },
    201
  );
});

app.delete("/api/servers/:id", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;

  await ensureSchema(c.env);
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin"]);
  if (permission instanceof Response) return permission;
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Server id is required." }, 400);

  await c.env.DB.prepare("DELETE FROM servers WHERE id = ?1").bind(id).run();
  return c.json({ success: true });
});

app.get("/api/alerts", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  const permission = await requireWorkspaceViewerRole(c.env, authUser.id);
  if (permission instanceof Response) return permission;

  await ensureSchema(c.env);
  const alerts = await c.env.DB.prepare(
    `
      SELECT id, title, source, severity, status, lifecycle_status, owner, team, created_at
      FROM alerts
      ORDER BY created_at DESC
    `
  ).all<AlertRow>();

  const allAlerts = (alerts.results ?? []).map((alert: AlertRow) => ({
    id: alert.id,
    title: alert.title,
    source: alert.source,
    severity: alert.severity,
    status: alert.status,
    createdAt: alert.created_at,
  }));

  const search = c.req.query("search")?.trim().toLowerCase() ?? "";
  const severityFilter = c.req.query("severity")?.trim();
  const statusFilter = c.req.query("status")?.trim();
  const sortBy = normalizeAlertSortField(c.req.query("sortBy"));
  const sortDir = normalizeSortDirection(c.req.query("sortDir"));
  const page = parsePositiveInt(c.req.query("page"), 1);
  const limit = parseBoundedInt(c.req.query("limit"), 20, 1, 200);

  const filtered = allAlerts.filter((alert: AlertResponseItem) => {
    const matchesSearch =
      !search ||
      alert.id.toLowerCase().includes(search) ||
      alert.title.toLowerCase().includes(search) ||
      alert.source.toLowerCase().includes(search);
    const matchesSeverity = !severityFilter || alert.severity === severityFilter;
    const matchesStatus = !statusFilter || alert.status === statusFilter;
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const sorted = filtered.sort((left: AlertResponseItem, right: AlertResponseItem) =>
    compareValues(
      getAlertSortValue(left, sortBy),
      getAlertSortValue(right, sortBy),
      sortDir
    )
  );

  const { items, meta } = paginateList(sorted, page, limit);

  return c.json({
    alerts: items,
    items,
    meta: {
      ...meta,
      sortBy,
      sortDir,
      filters: {
        search,
        severity: severityFilter ?? null,
        status: statusFilter ?? null,
      },
    },
  });
});

app.post("/api/alerts", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;

  await ensureSchema(c.env);
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin", "engineer"]);
  if (permission instanceof Response) return permission;

  const body = await readBody(c);
  const parsed = parseBodyWithSchema(
    c,
    body,
    alertCreateSchema,
    "Alert title and source are required."
  );
  if ("response" in parsed) return parsed.response;
  const title = parsed.data.title;
  const source = parsed.data.source;
  const severity = parsed.data.severity;
  const owner = parsed.data.owner;
  const team = parsed.data.team;

  const planLimit = await requirePlanLimit(
    c,
    authUser,
    "alerts_created_monthly",
    "Alerts created"
  );
  if (planLimit) return planLimit;

  const id = `ALT-${randomInt(1000, 9999)}`;
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `
      INSERT INTO alerts (id, title, source, severity, status, owner, team, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    `
  )
    .bind(id, title, source, severity, "Active", owner, team, now)
    .run();
  await incrementUsageCounter(c.env, authUser.id, "alerts_created_monthly");

  return c.json(
    {
      alert: {
        id,
        title,
        source,
        severity,
        status: "Active",
        owner,
        team,
        createdAt: now,
      },
    },
    201
  );
});

app.put("/api/alerts/:id", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;

  await ensureSchema(c.env);
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin", "engineer"]);
  if (permission instanceof Response) return permission;
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Alert id is required." }, 400);

  const body = await readBody(c);
  const parsed = parseBodyWithSchema(c, body, alertUpdateSchema, "Status must be Active or Resolved.");
  if ("response" in parsed) return parsed.response;
  const status = parsed.data.status;

  await c.env.DB.prepare(
    `
      UPDATE alerts
      SET
        status = ?1,
        lifecycle_status = CASE
          WHEN ?1 = 'Resolved' THEN 'Resolved'
          ELSE lifecycle_status
        END
      WHERE id = ?2
    `
  )
    .bind(status, id)
    .run();

  return c.json({ success: true });
});

app.delete("/api/alerts/:id", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;

  await ensureSchema(c.env);
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin"]);
  if (permission instanceof Response) return permission;
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Alert id is required." }, 400);

  await c.env.DB.prepare("DELETE FROM alerts WHERE id = ?1").bind(id).run();
  return c.json({ success: true });
});

app.get("/api/automation/rules", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  const planCheck = requirePlanAccess(c, authUser, "pro", "Automation rules");
  if (planCheck) return planCheck;
  const permission = await requireWorkspaceViewerRole(c.env, authUser.id);
  if (permission instanceof Response) return permission;

  await ensureSchema(c.env);
  const rules = await c.env.DB.prepare(
    `
      SELECT
        id,
        name,
        trigger_condition,
        action_text as action,
        cooldown_minutes,
        enabled,
        last_run,
        success_rate,
        created_at
      FROM automation_rules
      ORDER BY created_at DESC
    `
  ).all<AutomationRuleRow>();

  const allRules = (rules.results ?? []).map((rule: AutomationRuleRow) => ({
    id: rule.id,
    name: rule.name,
    trigger: rule.trigger_condition,
    action: rule.action,
    cooldownMinutes: rule.cooldown_minutes,
    enabled: Boolean(rule.enabled),
    lastRun: rule.last_run,
    successRate: rule.success_rate,
    createdAt: rule.created_at,
  }));

  const search = c.req.query("search")?.trim().toLowerCase() ?? "";
  const enabledFilter = c.req.query("enabled");
  const normalizedEnabledFilter =
    enabledFilter === "true" || enabledFilter === "false" ? enabledFilter : null;
  const sortBy = normalizeRuleSortField(c.req.query("sortBy"));
  const sortDir = normalizeSortDirection(c.req.query("sortDir"));
  const page = parsePositiveInt(c.req.query("page"), 1);
  const limit = parseBoundedInt(c.req.query("limit"), 20, 1, 200);

  const filtered = allRules.filter((rule: RuleResponseItem) => {
    const matchesSearch =
      !search ||
      rule.id.toLowerCase().includes(search) ||
      rule.name.toLowerCase().includes(search) ||
      rule.trigger.toLowerCase().includes(search) ||
      rule.action.toLowerCase().includes(search);
    const matchesEnabled =
      !normalizedEnabledFilter ||
      rule.enabled === (normalizedEnabledFilter === "true");
    return matchesSearch && matchesEnabled;
  });

  const sorted = filtered.sort((left: RuleResponseItem, right: RuleResponseItem) =>
    compareValues(
      getRuleSortValue(left, sortBy),
      getRuleSortValue(right, sortBy),
      sortDir
    )
  );

  const { items, meta } = paginateList(sorted, page, limit);

  return c.json({
    rules: items,
    items,
    meta: {
      ...meta,
      sortBy,
      sortDir,
      filters: {
        search,
        enabled: normalizedEnabledFilter,
      },
    },
  });
});

app.post("/api/automation/rules", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  const planCheck = requirePlanAccess(c, authUser, "pro", "Automation rules");
  if (planCheck) return planCheck;

  await ensureSchema(c.env);
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin", "engineer"]);
  if (permission instanceof Response) return permission;
  const body = await readBody(c);
  const parsed = parseBodyWithSchema(
    c,
    body,
    automationRuleCreateSchema,
    "Name, trigger, and action are required."
  );
  if ("response" in parsed) return parsed.response;

  const name = parsed.data.name;
  const trigger = parsed.data.trigger;
  const action = parsed.data.action;
  const cooldownMinutes = parsed.data.cooldownMinutes;

  const planLimit = await requirePlanLimit(
    c,
    authUser,
    "automation_rules",
    "Automation rules",
    async () => {
      const row = await c.env.DB.prepare("SELECT COUNT(*) as count FROM automation_rules")
        .first<{ count: number }>();
      return Number(row?.count ?? 0);
    }
  );
  if (planLimit) return planLimit;

  const id = `rule-${Date.now()}`;
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `
      INSERT INTO automation_rules (
        id, name, trigger_condition, action_text, cooldown_minutes, enabled, last_run, success_rate, created_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    `
  )
    .bind(id, name, trigger, action, cooldownMinutes, 1, "Never", 90, now)
    .run();

  return c.json(
    {
      rule: {
        id,
        name,
        trigger,
        action,
        cooldownMinutes,
        enabled: true,
        lastRun: "Never",
        successRate: 90,
        createdAt: now,
      },
    },
    201
  );
});

app.put("/api/automation/rules/:id", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  const planCheck = requirePlanAccess(c, authUser, "pro", "Automation rules");
  if (planCheck) return planCheck;

  await ensureSchema(c.env);
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin", "engineer"]);
  if (permission instanceof Response) return permission;
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Rule id is required." }, 400);

  const body = await readBody(c);
  const parsed = parseBodyWithSchema(c, body, automationRuleUpdateSchema, "Invalid rule update payload.");
  if ("response" in parsed) return parsed.response;
  const enabled = parsed.data.enabled;
  const runNow = parsed.data.runNow ?? false;
  if (!runNow && typeof enabled !== "boolean") {
    return c.json({ error: "Provide either runNow=true or enabled=true/false." }, 400);
  }

  let executionResult: PlaybookExecutionRunResult | null = null;
  if (runNow) {
    executionResult = await runPlaybookExecution(c.env, {
      playbookId: id,
      incidentId: null,
      runType: "manual",
      actorUserId: authUser.id,
      workspaceId: permission.workspaceId,
    });
    if (!executionResult.success && executionResult.code === "PLAYBOOK_NOT_FOUND") {
      return c.json({ error: "Rule not found." }, 404);
    }
    if (!executionResult.success && executionResult.code === "PLAYBOOK_DISABLED") {
      return c.json({ error: "Rule is disabled." }, 409);
    }
    if (!executionResult.success && executionResult.code === "PLAYBOOK_ALREADY_RUNNING") {
      return c.json({ error: "Rule is already running. Please wait for completion." }, 409);
    }
  } else {
    await c.env.DB.prepare("UPDATE automation_rules SET enabled = ?1 WHERE id = ?2")
      .bind(enabled ? 1 : 0, id)
      .run();
  }

  if (runNow && executionResult) {
    return c.json({
      success: executionResult.success,
      execution: {
        id: executionResult.executionId,
        status: executionResult.status,
        verificationResult: executionResult.verificationResult,
        retryCount: executionResult.retryCount,
        message: executionResult.message,
      },
    });
  }

  return c.json({ success: true });
});

app.delete("/api/automation/rules/:id", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  const planCheck = requirePlanAccess(c, authUser, "pro", "Automation rules");
  if (planCheck) return planCheck;

  await ensureSchema(c.env);
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin"]);
  if (permission instanceof Response) return permission;
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Rule id is required." }, 400);
  await c.env.DB.prepare("DELETE FROM automation_rules WHERE id = ?1").bind(id).run();
  return c.json({ success: true });
});

app.get("/api/incidents/rules", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceViewerRole(c.env, authUser.id);
  if (permission instanceof Response) return permission;

  const rows = await c.env.DB.prepare(
    `
      SELECT
        id, name, metric, operator, threshold, severity, cooldown_minutes,
        enabled, last_triggered_at, created_at, updated_at
      FROM incident_detection_rules
      ORDER BY created_at DESC
    `
  ).all<DetectionRuleRow>();

  return c.json({
    rules: ((rows.results ?? []) as DetectionRuleRow[]).map((rule: DetectionRuleRow) => ({
      id: rule.id,
      name: rule.name,
      metric: rule.metric,
      operator: rule.operator,
      threshold: rule.threshold,
      severity: rule.severity,
      cooldownMinutes: rule.cooldown_minutes,
      enabled: Boolean(rule.enabled),
      lastTriggeredAt: rule.last_triggered_at,
      createdAt: rule.created_at,
      updatedAt: rule.updated_at,
    })),
  });
});

app.post("/api/incidents/rules", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin", "engineer"]);
  if (permission instanceof Response) return permission;

  const body = await readBody(c);
  const parsed = parseBodyWithSchema(
    c,
    body,
    detectionRuleCreateSchema,
    "Invalid detection rule payload."
  );
  if ("response" in parsed) return parsed.response;

  const now = new Date().toISOString();
  const id = `dr-${Date.now()}-${randomInt(1000, 9999)}`;
  await c.env.DB.prepare(
    `
      INSERT INTO incident_detection_rules (
        id, name, metric, operator, threshold, severity, cooldown_minutes,
        enabled, last_triggered_at, created_at, updated_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
    `
  )
    .bind(
      id,
      parsed.data.name,
      parsed.data.metric,
      parsed.data.operator,
      parsed.data.threshold,
      parsed.data.severity,
      parsed.data.cooldownMinutes,
      1,
      null,
      now,
      now
    )
    .run();

  await appendAuditLog(c.env, {
    workspaceId: permission.workspaceId,
    userId: authUser.id,
    action: "incident.detection_rule.created",
    entityType: "detection_rule",
    entityId: id,
    metadata: {
      metric: parsed.data.metric,
      operator: parsed.data.operator,
      threshold: parsed.data.threshold,
      severity: parsed.data.severity,
    },
  });

  return c.json(
    {
      rule: {
        id,
        name: parsed.data.name,
        metric: parsed.data.metric,
        operator: parsed.data.operator,
        threshold: parsed.data.threshold,
        severity: parsed.data.severity,
        cooldownMinutes: parsed.data.cooldownMinutes,
        enabled: true,
        lastTriggeredAt: null,
        createdAt: now,
        updatedAt: now,
      },
    },
    201
  );
});

app.put("/api/incidents/rules/:id/enabled", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin"]);
  if (permission instanceof Response) return permission;

  const id = c.req.param("id");
  if (!id) return c.json({ error: "Detection rule id is required." }, 400);
  const body = await readBody(c);
  const parsed = parseBodyWithSchema(c, body, detectionRuleToggleSchema, "Enabled state is required.");
  if ("response" in parsed) return parsed.response;

  await c.env.DB.prepare(
    "UPDATE incident_detection_rules SET enabled = ?1, updated_at = ?2 WHERE id = ?3"
  )
    .bind(parsed.data.enabled ? 1 : 0, new Date().toISOString(), id)
    .run();

  await appendAuditLog(c.env, {
    workspaceId: permission.workspaceId,
    userId: authUser.id,
    action: "incident.detection_rule.toggled",
    entityType: "detection_rule",
    entityId: id,
    metadata: { enabled: parsed.data.enabled },
  });

  return c.json({ success: true });
});

app.delete("/api/incidents/rules/:id", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin"]);
  if (permission instanceof Response) return permission;

  const id = c.req.param("id");
  if (!id) return c.json({ error: "Detection rule id is required." }, 400);

  await c.env.DB.prepare("DELETE FROM incident_detection_rules WHERE id = ?1").bind(id).run();
  await appendAuditLog(c.env, {
    workspaceId: permission.workspaceId,
    userId: authUser.id,
    action: "incident.detection_rule.deleted",
    entityType: "detection_rule",
    entityId: id,
    metadata: {},
  });

  return c.json({ success: true });
});

app.get("/api/incidents", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceViewerRole(c.env, authUser.id);
  if (permission instanceof Response) return permission;
  await runIncidentLifecyclePolicy(c.env);

  const alerts = await c.env.DB.prepare(
    `
      SELECT id, title, source, severity, status, lifecycle_status, owner, team, created_at
      FROM alerts
      ORDER BY created_at DESC
    `
  ).all<AlertRow>();

  const incidents = (alerts.results ?? []).map((alert: AlertRow) => ({
    id: alert.id,
    title: alert.title,
    source: alert.source,
    severity: alert.severity,
    status: resolveLifecycleStatus(alert),
    owner: alert.owner ?? "Platform SRE",
    team: alert.team ?? "Reliability",
    detectedAt: alert.created_at,
  }));

  const search = c.req.query("search")?.trim().toLowerCase() ?? "";
  const severityFilter = c.req.query("severity")?.trim();
  const statusFilter = c.req.query("status")?.trim();
  const sortBy =
    c.req.query("sortBy") === "title" || c.req.query("sortBy") === "severity"
      ? c.req.query("sortBy")
      : "detectedAt";
  const sortDir = normalizeSortDirection(c.req.query("sortDir"));
  const page = parsePositiveInt(c.req.query("page"), 1);
  const limit = parseBoundedInt(c.req.query("limit"), 20, 1, 200);

  const filtered = incidents.filter((incident: {
    id: string;
    title: string;
    source: string;
    severity: string;
    status: string;
    owner: string;
    team: string;
    detectedAt: string;
  }) => {
    const matchesSearch =
      !search ||
      incident.id.toLowerCase().includes(search) ||
      incident.title.toLowerCase().includes(search) ||
      incident.source.toLowerCase().includes(search);
    const matchesSeverity = !severityFilter || incident.severity === severityFilter;
    const matchesStatus = !statusFilter || incident.status === statusFilter;
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const sorted = filtered.sort(
    (
      left: {
        id: string;
        title: string;
        source: string;
        severity: string;
        status: string;
        owner: string;
        team: string;
        detectedAt: string;
      },
      right: {
        id: string;
        title: string;
        source: string;
        severity: string;
        status: string;
        owner: string;
        team: string;
        detectedAt: string;
      }
    ) =>
      compareValues(
        left[sortBy as "title" | "severity" | "detectedAt"],
        right[sortBy as "title" | "severity" | "detectedAt"],
        sortDir
      )
  );
  const { items, meta } = paginateList(sorted, page, limit);

  return c.json({
    incidents: items,
    items,
    meta: {
      ...meta,
      sortBy,
      sortDir,
      filters: {
        search,
        severity: severityFilter ?? null,
        status: statusFilter ?? null,
      },
    },
  });
});

app.get("/api/incidents/:id", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceViewerRole(c.env, authUser.id);
  if (permission instanceof Response) return permission;

  const id = c.req.param("id");
  const alert = await c.env.DB.prepare(
    `
      SELECT id, title, source, severity, status, lifecycle_status, owner, team, created_at
      FROM alerts
      WHERE id = ?1
      LIMIT 1
    `
  )
    .bind(id)
    .first<AlertRow>();

  if (!alert) {
    return c.json({ error: "Incident not found." }, 404);
  }

  return c.json({
    incident: {
      id: alert.id,
      title: alert.title,
      source: alert.source,
      severity: alert.severity,
      status: resolveLifecycleStatus(alert),
      owner: alert.owner ?? "Platform SRE",
      team: alert.team ?? "Reliability",
      detectedAt: alert.created_at,
      timeline: buildIncidentTimelineWithStatus(alert, resolveLifecycleStatus(alert)),
    },
  });
});

app.get("/api/incidents/:id/export", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  const planCheck = requirePlanAccess(c, authUser, "pro", "Incident export");
  if (planCheck) return planCheck;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceViewerRole(c.env, authUser.id);
  if (permission instanceof Response) return permission;

  const planLimit = await requirePlanLimit(
    c,
    authUser,
    "incident_exports_monthly",
    "Incident exports"
  );
  if (planLimit) return planLimit;

  const id = c.req.param("id");
  const alert = await c.env.DB.prepare(
    `
      SELECT id, title, source, severity, status, lifecycle_status, owner, team, created_at
      FROM alerts
      WHERE id = ?1
      LIMIT 1
    `
  )
    .bind(id)
    .first<AlertRow>();

  if (!alert) {
    return c.json({ error: "Incident not found." }, 404);
  }

  const format = resolveIncidentExportFormat(c.req.query("format"));
  const report = buildIncidentExportReportPayload(alert, "");
  const rendered = renderIncidentExportReport(report, format);
  await incrementUsageCounter(c.env, authUser.id, "incident_exports_monthly");

  return new Response(rendered.body, {
    headers: {
      "Content-Type": rendered.contentType,
      "Content-Disposition": `attachment; filename="${alert.id}-incident-report.${rendered.extension}"`,
    },
  });
});

app.get("/api/incidents/audit", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  const planCheck = requirePlanAccess(c, authUser, "pro", "Incident audit history");
  if (planCheck) return planCheck;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceViewerRole(c.env, authUser.id);
  if (permission instanceof Response) return permission;

  const alerts = await c.env.DB.prepare(
    `
      SELECT id, title, source, severity, status, lifecycle_status, owner, team, created_at
      FROM alerts
      ORDER BY created_at DESC
    `
  ).all<AlertRow>();

  const audits = (alerts.results ?? []).map((alert: AlertRow) => ({
    id: `AUD-${alert.id}`,
    incidentId: alert.id,
    summary: `${alert.title} (${alert.source})`,
    verificationResult: computeAuditResult(alert.id),
    executedActions: ["restart", "scale"],
    humanNotes:
      "Auto-recovery run completed. Follow-up monitoring window set for 20 minutes.",
    updatedAt: alert.created_at,
  }));

  return c.json({ audits });
});

app.get("/api/ai/anomalies", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  const planCheck = requirePlanAccess(c, authUser, "pro", "AI insights");
  if (planCheck) return planCheck;
  const permission = await requireWorkspaceViewerRole(c.env, authUser.id);
  if (permission instanceof Response) return permission;

  return c.json({
    anomalies: [
      {
        id: "an-11",
        metric: "CPU saturation spike",
        service: "prod-api-02",
        confidence: 93,
        severity: "High",
        summary: "CPU patterns deviated from weekday baseline for 14 minutes.",
      },
      {
        id: "an-08",
        metric: "Write latency drift",
        service: "db-primary-01",
        confidence: 87,
        severity: "Medium",
        summary: "Sustained latency increase detected during peak batch workloads.",
      },
      {
        id: "an-06",
        metric: "Ingress traffic variance",
        service: "edge-gateway-03",
        confidence: 79,
        severity: "Low",
        summary: "Traffic volume above expected seasonal envelope.",
      },
    ],
  });
});

app.get("/api/ai/predictions", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  const planCheck = requirePlanAccess(c, authUser, "pro", "AI insights");
  if (planCheck) return planCheck;
  const permission = await requireWorkspaceViewerRole(c.env, authUser.id);
  if (permission instanceof Response) return permission;

  return c.json({
    points: [62, 64, 63, 66, 68, 69, 71, 72, 75, 78, 81, 84, 86, 89, 92],
  });
});

app.get("/api/ai/recommendations", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  const planCheck = requirePlanAccess(c, authUser, "pro", "AI insights");
  if (planCheck) return planCheck;
  const permission = await requireWorkspaceViewerRole(c.env, authUser.id);
  if (permission instanceof Response) return permission;

  await ensureSchema(c.env);
  const recommendations = await c.env.DB.prepare(
    `
      SELECT id, title, impact, priority, done
      FROM ai_recommendations
      ORDER BY id ASC
    `
  ).all<AIRecommendationRow>();

  return c.json({
    recommendations: (recommendations.results ?? []).map((item: AIRecommendationRow) => ({
      id: item.id,
      title: item.title,
      impact: item.impact,
      priority: item.priority,
      done: Boolean(item.done),
    })),
  });
});

app.put("/api/ai/recommendations/:id", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  const planCheck = requirePlanAccess(c, authUser, "pro", "AI insights");
  if (planCheck) return planCheck;
  const permission = await requireWorkspaceRole(c.env, authUser.id, ["owner", "admin", "engineer"]);
  if (permission instanceof Response) return permission;

  await ensureSchema(c.env);
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Recommendation id is required." }, 400);
  const body = await readBody(c);
  const parsed = parseBodyWithSchema(c, body, aiRecommendationUpdateSchema, "Invalid recommendation payload.");
  if ("response" in parsed) return parsed.response;
  const done = parsed.data.done;

  await c.env.DB.prepare("UPDATE ai_recommendations SET done = ?1 WHERE id = ?2")
    .bind(done ? 1 : 0, id)
    .run();

  return c.json({ success: true });
});

app.get("/api/metrics/:metric", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  const permission = await requireWorkspaceViewerRole(c.env, authUser.id);
  if (permission instanceof Response) return permission;

  const metric = c.req.param("metric");
  if (metric === "query") {
    const range = (c.req.query("range") ?? "24h") as "15m" | "1h" | "24h";
    const compareRange = (c.req.query("compareRange") ?? "none") as
      | "none"
      | "previous_period"
      | "previous_day";
    const region = c.req.query("region") ?? "All";
    const service = c.req.query("service") ?? "All";
    const resourceId = c.req.query("resourceId") ?? "All";

    const primary = generateMetricsBundle(range);
    const compare = compareRange === "none" ? null : generateMetricsBundle(range);

    return c.json({
      filters: {
        region,
        service,
        resourceId,
      },
      range,
      compareRange,
      primary,
      compare,
    });
  }

  const range = (c.req.query("range") ?? "24h") as "1h" | "24h" | "7d";

  if (!["cpu", "memory", "disk", "network"].includes(metric)) {
    return c.json({ error: "Invalid metric requested." }, 400);
  }

  return c.json({
    metric,
    range,
    samples: generateMetricSeries(metric as "cpu" | "memory" | "disk" | "network", range),
  });
});

app.get("/api/metrics/latest", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  const permission = await requireWorkspaceViewerRole(c.env, authUser.id);
  if (permission instanceof Response) return permission;
  return c.json(buildLatestMetricsSample());
});

app.get("/api/stream/metrics", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  const permission = await requireWorkspaceViewerRole(c.env, authUser.id);
  if (permission instanceof Response) return permission;

  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const push = () => {
        if (closed) return;
        const payload = JSON.stringify(buildLatestMetricsSample());
        controller.enqueue(encoder.encode(`event: metrics\ndata: ${payload}\n\n`));
      };

      push();
      interval = setInterval(push, 3000);
    },
    cancel() {
      closed = true;
      if (interval) clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});

app.get("/api/stream/alerts", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  await ensureSchema(c.env);
  const permission = await requireWorkspaceViewerRole(c.env, authUser.id);
  if (permission instanceof Response) return permission;

  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const push = async () => {
        if (closed) return;
        const countRow = await c.env.DB.prepare(
          "SELECT COUNT(*) as count FROM alerts WHERE status = 'Active'"
        ).first<{ count: number }>();

        const payload = JSON.stringify({
          at: new Date().toISOString(),
          activeAlerts: Number(countRow?.count ?? 0),
          signal: Number(countRow?.count ?? 0) > 0 ? "attention" : "normal",
        });
        controller.enqueue(encoder.encode(`event: alerts\ndata: ${payload}\n\n`));
      };

      void push();
      interval = setInterval(() => {
        void push();
      }, 5000);
    },
    cancel() {
      closed = true;
      if (interval) clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});

app.get("/api/user/profile", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  await ensureSchema(c.env);
  await ensureUserSettings(c.env, authUser.id);

  const settings = await c.env.DB.prepare(
    `
      SELECT
        user_id,
        company,
        role,
        timezone,
        theme,
        email_alerts,
        slack_alerts,
        weekly_report,
        updated_at
      FROM user_settings
      WHERE user_id = ?1
      LIMIT 1
    `
  )
    .bind(authUser.id)
    .first<UserSettingsRow>();

  return c.json({
    profile: {
      firstName: authUser.firstName,
      lastName: authUser.lastName,
      email: authUser.email,
      company: settings?.company ?? "InfraMind Cloud Team",
      role: settings?.role ?? "Platform Engineer",
      timezone: settings?.timezone ?? "Asia/Kolkata",
      theme: settings?.theme ?? "system",
      emailAlerts: Boolean(settings?.email_alerts ?? 1),
      slackAlerts: Boolean(settings?.slack_alerts ?? 1),
      weeklyReport: Boolean(settings?.weekly_report ?? 0),
    },
  });
});

app.put("/api/user/profile", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  await ensureSchema(c.env);
  await ensureUserSettings(c.env, authUser.id);

  const body = await readBody(c);
  const parsed = parseBodyWithSchema(c, body, userProfileBodySchema, "Invalid profile payload.");
  if ("response" in parsed) return parsed.response;

  const firstName = parsed.data.firstName ?? authUser.firstName;
  const lastName = parsed.data.lastName ?? authUser.lastName;
  const email = parsed.data.email ? normalizeEmail(parsed.data.email) : authUser.email;
  const company = parsed.data.company ?? "InfraMind Cloud Team";
  const role = parsed.data.role ?? "Platform Engineer";
  const timezone = parsed.data.timezone ?? "Asia/Kolkata";
  const theme = parsed.data.theme ?? "system";
  const emailAlerts = parsed.data.emailAlerts ?? true;
  const slackAlerts = parsed.data.slackAlerts ?? true;
  const weeklyReport = parsed.data.weeklyReport ?? false;

  if (email !== authUser.email) {
    const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?1 LIMIT 1")
      .bind(email)
      .first<{ id: string }>();
    if (existing && existing.id !== authUser.id) {
      return c.json({ error: "Email is already in use by another account." }, 409);
    }
  }

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `
      UPDATE users
      SET first_name = ?1, last_name = ?2, email = ?3, updated_at = ?4
      WHERE id = ?5
    `
  )
    .bind(firstName, lastName, email, now, authUser.id)
    .run();

  await c.env.DB.prepare(
    `
      UPDATE user_settings
      SET
        company = ?1,
        role = ?2,
        timezone = ?3,
        theme = ?4,
        email_alerts = ?5,
        slack_alerts = ?6,
        weekly_report = ?7,
        updated_at = ?8
      WHERE user_id = ?9
    `
  )
    .bind(
      company,
      role,
      timezone,
      theme,
      emailAlerts ? 1 : 0,
      slackAlerts ? 1 : 0,
      weeklyReport ? 1 : 0,
      now,
      authUser.id
    )
    .run();

  return c.json({
    profile: {
      firstName,
      lastName,
      email,
      company,
      role,
      timezone,
      theme,
      emailAlerts,
      slackAlerts,
      weeklyReport,
    },
  });
});

app.put("/api/user/password", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  await ensureSchema(c.env);

  const body = await readBody(c);
  const parsed = parseBodyWithSchema(
    c,
    body,
    userPasswordSchema,
    "Current password and new password are required."
  );
  if ("response" in parsed) return parsed.response;
  const currentPassword = parsed.data.currentPassword;
  const newPassword = parsed.data.newPassword;

  const user = await c.env.DB.prepare(
    `
      SELECT id, password_hash, password_salt
      FROM users
      WHERE id = ?1
      LIMIT 1
    `
  )
    .bind(authUser.id)
    .first<{ id: string; password_hash: string; password_salt: string }>();

  if (!user) {
    return c.json({ error: "User not found." }, 404);
  }

  const currentHash = await hashPassword(currentPassword, user.password_salt);
  if (!safeCompare(currentHash, user.password_hash)) {
    return c.json({ error: "Current password is incorrect." }, 401);
  }

  const newSalt = generateRandomToken(16);
  const newHash = await hashPassword(newPassword, newSalt);
  await c.env.DB.prepare(
    `
      UPDATE users
      SET password_hash = ?1, password_salt = ?2, updated_at = ?3
      WHERE id = ?4
    `
  )
    .bind(newHash, newSalt, new Date().toISOString(), authUser.id)
    .run();

  return c.json({ success: true });
});

app.get("/api/user/api-keys", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  await ensureSchema(c.env);

  const keys = await c.env.DB.prepare(
    `
      SELECT id, user_id, name, key_value, created_at, last_used, is_active
      FROM api_keys
      WHERE user_id = ?1
      ORDER BY created_at DESC
    `
  )
    .bind(authUser.id)
    .all<ApiKeyRow>();

  return c.json({
    keys: (keys.results ?? []).map((key: ApiKeyRow) => ({
      id: key.id,
      name: key.name,
      key: key.key_value,
      createdAt: key.created_at,
      lastUsed: key.last_used,
      active: Boolean(key.is_active),
    })),
  });
});

app.post("/api/user/api-keys", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  await ensureSchema(c.env);

  const body = await readBody(c);
  const parsed = parseBodyWithSchema(c, body, apiKeyCreateSchema, "API key label is required.");
  if ("response" in parsed) return parsed.response;
  const name = parsed.data.name;

  const planLimit = await requirePlanLimit(
    c,
    authUser,
    "api_keys",
    "API keys",
    async () => {
      const row = await c.env.DB.prepare(
        "SELECT COUNT(*) as count FROM api_keys WHERE user_id = ?1"
      )
        .bind(authUser.id)
        .first<{ count: number }>();
      return Number(row?.count ?? 0);
    }
  );
  if (planLimit) return planLimit;

  const id = `key-${Date.now()}`;
  const keyValue = `im_live_${makeReadableToken(4)}-${makeReadableToken(4)}-${makeReadableToken(4)}-${makeReadableToken(4)}`;
  const now = new Date().toISOString().slice(0, 10);

  await c.env.DB.prepare(
    `
      INSERT INTO api_keys (
        id, user_id, name, key_value, created_at, last_used, is_active
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
    `
  )
    .bind(id, authUser.id, name, keyValue, now, "Never", 1)
    .run();

  return c.json(
    {
      key: {
        id,
        name,
        key: keyValue,
        createdAt: now,
        lastUsed: "Never",
        active: true,
      },
    },
    201
  );
});

app.delete("/api/user/api-keys/:id", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;
  await ensureSchema(c.env);

  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: "API key id is required." }, 400);
  }

  await c.env.DB.prepare("DELETE FROM api_keys WHERE id = ?1 AND user_id = ?2")
    .bind(id, authUser.id)
    .run();
  return c.json({ success: true });
});

registerSaaSRoutes(app, {
  ensureSchema,
  requireAuthenticatedUser,
  requireWorkspaceViewerRole,
  requireWorkspaceRole,
  readBody,
  parseBodyWithSchema,
  appendAuditLog,
  dispatchNotification,
  normalizePlan,
});

// Legacy aliases to preserve compatibility with old frontend code.
app.get("/api/users/me", async (c) => {
  await ensureSchema(c.env);
  const user = await getUserFromSession(c);
  if (!user) {
    return c.json({ error: "Not authenticated." }, 401);
  }
  return c.json({ user });
});

app.get("/api/logout", async (c) => {
  await ensureSchema(c.env);
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (typeof token === "string") {
    await c.env.DB.prepare("DELETE FROM sessions WHERE token = ?1").bind(token).run();
  }
  clearSessionCookie(c);
  return c.json({ success: true });
});

app.get("/api/oauth/google/redirect_url", async (c) => {
  return c.json(
    { error: "Google OAuth is not enabled in this build. Use email/password auth." },
    410
  );
});

app.post("/api/sessions", async (c) => {
  return c.json(
    { error: "OAuth session exchange is disabled. Use email/password auth." },
    410
  );
});

async function ensureSchema(env: Env): Promise<void> {
  if (schemaInitialized) return;

  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)"
  ).run();

  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"
  ).run();

  await runMigrationOnce(env, "2026_03_add_users_plan", () => ensureUsersPlanColumn(env));
  await runMigrationOnce(env, "2026_03_add_users_email_verified", () =>
    ensureUsersEmailVerifiedColumn(env)
  );

  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)"
  ).run();

  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)"
  ).run();

  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS servers (id TEXT PRIMARY KEY, name TEXT NOT NULL, ip TEXT NOT NULL, region TEXT NOT NULL, uptime TEXT NOT NULL, cpu INTEGER NOT NULL, memory INTEGER NOT NULL, status TEXT NOT NULL, last_heartbeat TEXT NOT NULL, created_at TEXT NOT NULL)"
  ).run();
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS alerts (id TEXT PRIMARY KEY, title TEXT NOT NULL, source TEXT NOT NULL, severity TEXT NOT NULL, status TEXT NOT NULL, lifecycle_status TEXT NOT NULL DEFAULT 'Detected', owner TEXT NOT NULL DEFAULT 'Platform SRE', team TEXT NOT NULL DEFAULT 'Reliability', created_at TEXT NOT NULL)"
  ).run();
  await runMigrationOnce(env, "2026_03_add_alerts_lifecycle_status", () =>
    ensureAlertsLifecycleColumn(env)
  );
  await runMigrationOnce(env, "2026_03_add_alerts_owner_team", () =>
    ensureAlertsOwnershipColumns(env)
  );

  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS incident_detection_rules (id TEXT PRIMARY KEY, name TEXT NOT NULL, metric TEXT NOT NULL, operator TEXT NOT NULL, threshold REAL NOT NULL, severity TEXT NOT NULL, cooldown_minutes INTEGER NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, last_triggered_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"
  ).run();
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS automation_rules (id TEXT PRIMARY KEY, name TEXT NOT NULL, trigger_condition TEXT NOT NULL, action_text TEXT NOT NULL, cooldown_minutes INTEGER NOT NULL, enabled INTEGER NOT NULL, last_run TEXT NOT NULL, success_rate INTEGER NOT NULL, created_at TEXT NOT NULL)"
  ).run();
  await runMigrationOnce(env, "2026_03_add_automation_rule_columns", () =>
    ensureAutomationRuleExtraColumns(env)
  );
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS user_settings (user_id TEXT PRIMARY KEY, company TEXT NOT NULL, role TEXT NOT NULL, timezone TEXT NOT NULL, theme TEXT NOT NULL, email_alerts INTEGER NOT NULL, slack_alerts INTEGER NOT NULL, weekly_report INTEGER NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)"
  ).run();
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS api_keys (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, key_value TEXT NOT NULL, created_at TEXT NOT NULL, last_used TEXT NOT NULL, is_active INTEGER NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)"
  ).run();
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS ai_recommendations (id TEXT PRIMARY KEY, title TEXT NOT NULL, impact TEXT NOT NULL, priority TEXT NOT NULL, done INTEGER NOT NULL)"
  ).run();
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS aws_connections (user_id TEXT PRIMARY KEY, account_id TEXT NOT NULL, region TEXT NOT NULL, environment TEXT NOT NULL, role_arn TEXT NOT NULL DEFAULT '', connection_status TEXT NOT NULL, auto_recovery_enabled INTEGER NOT NULL, channel_email INTEGER NOT NULL, channel_sms INTEGER NOT NULL, channel_slack INTEGER NOT NULL, channel_teams INTEGER NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)"
  ).run();
  await runMigrationOnce(env, "2026_03_add_aws_role_arn", () =>
    ensureAwsConnectionRoleArnColumn(env)
  );
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE)"
  ).run();
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS memberships (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(workspace_id, user_id), FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)"
  ).run();
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS auth_tokens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, purpose TEXT NOT NULL, token_hash TEXT NOT NULL, expires_at TEXT NOT NULL, consumed_at TEXT, metadata TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)"
  ).run();
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS incident_events (id TEXT PRIMARY KEY, incident_id TEXT NOT NULL, event_type TEXT NOT NULL, title TEXT NOT NULL, detail TEXT NOT NULL, state TEXT NOT NULL, actor_type TEXT NOT NULL, actor_id TEXT, created_at TEXT NOT NULL, FOREIGN KEY (incident_id) REFERENCES alerts(id) ON DELETE CASCADE)"
  ).run();
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS playbook_executions (id TEXT PRIMARY KEY, playbook_id TEXT NOT NULL, incident_id TEXT, status TEXT NOT NULL, verification_result TEXT NOT NULL, retry_count INTEGER NOT NULL, started_at TEXT NOT NULL, finished_at TEXT, details TEXT NOT NULL, FOREIGN KEY (playbook_id) REFERENCES automation_rules(id) ON DELETE CASCADE, FOREIGN KEY (incident_id) REFERENCES alerts(id) ON DELETE SET NULL)"
  ).run();
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS playbook_execution_locks (lock_key TEXT PRIMARY KEY, owner_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)"
  ).run();
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS notification_deliveries (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, incident_id TEXT, channel_type TEXT NOT NULL, target TEXT NOT NULL, status TEXT NOT NULL, provider_message_id TEXT, attempt_count INTEGER NOT NULL, error_message TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE, FOREIGN KEY (incident_id) REFERENCES alerts(id) ON DELETE SET NULL)"
  ).run();

  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS notification_dead_letters (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, incident_id TEXT, channel_type TEXT NOT NULL, target TEXT NOT NULL, payload TEXT NOT NULL, reason TEXT NOT NULL, attempt_count INTEGER NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE, FOREIGN KEY (incident_id) REFERENCES alerts(id) ON DELETE SET NULL)"
  ).run();
  await runMigrationOnce(env, "2026_03_add_notification_delivery_columns", () =>
    ensureNotificationDeliveriesColumns(env)
  );
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, workspace_id TEXT, user_id TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, metadata TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL)"
  ).run();
  await runMigrationOnce(env, "2026_03_add_audit_log_columns", () => ensureAuditLogsColumns(env));
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS incident_audit_notes (incident_id TEXT PRIMARY KEY, note TEXT NOT NULL, updated_at TEXT NOT NULL)"
  ).run();
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS usage_counters (user_id TEXT NOT NULL, period TEXT NOT NULL, metric TEXT NOT NULL, value INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, period, metric), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)"
  ).run();
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS quota_alert_events (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, period TEXT NOT NULL, metric TEXT NOT NULL, threshold_percent INTEGER NOT NULL, current_value INTEGER NOT NULL, limit_value INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)"
  ).run();
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS billing_subscriptions (user_id TEXT PRIMARY KEY, plan TEXT NOT NULL, status TEXT NOT NULL, provider_customer_id TEXT, provider_subscription_id TEXT, renews_at TEXT, updated_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)"
  ).run();
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS abuse_events (id TEXT PRIMARY KEY, scope TEXT NOT NULL, actor_key TEXT NOT NULL, email TEXT NOT NULL, ip_address TEXT NOT NULL, reason TEXT NOT NULL, metadata TEXT NOT NULL, created_at TEXT NOT NULL)"
  ).run();

  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_servers_created_at ON servers(created_at)"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at)"
  ).run();

  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_incident_detection_rules_enabled ON incident_detection_rules(enabled, updated_at)"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_rules_created_at ON automation_rules(created_at)"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id)"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_aws_connections_user_id ON aws_connections(user_id)"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id)"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_memberships_workspace_id ON memberships(workspace_id)"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON auth_tokens(user_id)"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_auth_tokens_purpose_hash ON auth_tokens(purpose, token_hash)"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_incident_events_incident_id ON incident_events(incident_id, created_at)"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_playbook_executions_playbook_id ON playbook_executions(playbook_id, started_at)"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_playbook_execution_locks_expires_at ON playbook_execution_locks(expires_at)"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_notification_deliveries_workspace_id ON notification_deliveries(workspace_id, created_at)"
  ).run();

  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_notification_dead_letters_workspace_id ON notification_dead_letters(workspace_id, created_at)"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_id ON audit_logs(workspace_id, created_at)"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_usage_counters_user_period ON usage_counters(user_id, period)"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_quota_alert_events_user_period ON quota_alert_events(user_id, period, updated_at)"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_status ON billing_subscriptions(status, updated_at)"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_abuse_events_scope_created ON abuse_events(scope, created_at)"
  ).run();

  await seedMonitoringData(env);
  await seedDetectionRules(env);

  schemaInitialized = true;
}

function toAuthUser(row: Pick<
  UserCredentialsRow,
  "id" | "first_name" | "last_name" | "email" | "plan" | "created_at" | "updated_at"
>): AuthUser {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    plan: normalizePlan(row.plan),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getUserFromSession(c: HonoContext): Promise<AuthUser | null> {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (typeof token !== "string") {
    return null;
  }

  const now = new Date().toISOString();
  const row = await c.env.DB.prepare(
    `
      SELECT
        u.id as id,
        u.first_name as firstName,
        u.last_name as lastName,
        u.email as email,
        u.plan as plan,
        u.created_at as createdAt,
        u.updated_at as updatedAt
      FROM sessions s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.token = ?1
        AND s.expires_at > ?2
      LIMIT 1
    `
  )
    .bind(token, now)
    .first<SessionUserRow>();

  if (!row) {
    await c.env.DB.prepare("DELETE FROM sessions WHERE token = ?1").bind(token).run();
    clearSessionCookie(c);
    return null;
  }

  return {
    ...row,
    plan: normalizePlan(row.plan),
  };
}

async function hasMigration(env: Env, migrationId: string): Promise<boolean> {
  const row = await env.DB.prepare(
    "SELECT id FROM schema_migrations WHERE id = ?1 LIMIT 1"
  )
    .bind(migrationId)
    .first<{ id: string }>();
  return Boolean(row?.id);
}

async function markMigrationApplied(env: Env, migrationId: string): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO schema_migrations (id, applied_at) VALUES (?1, ?2)"
  )
    .bind(migrationId, new Date().toISOString())
    .run();
}

async function runMigrationOnce(
  env: Env,
  migrationId: string,
  runner: () => Promise<void>
): Promise<void> {
  if (await hasMigration(env, migrationId)) return;
  await runner();
  await markMigrationApplied(env, migrationId);
}

async function ensureUsersPlanColumn(env: Env): Promise<void> {
  const result = await env.DB.prepare("PRAGMA table_info(users)").all<{
    name: string;
  }>();
  const columns = (result.results ?? []) as Array<{ name: string }>;
  const hasPlanColumn = columns.some((column: { name: string }) => column.name === "plan");
  if (hasPlanColumn) return;

  await env.DB.prepare(
    "ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'pro'"
  ).run();
}

async function ensureUsersEmailVerifiedColumn(env: Env): Promise<void> {
  const result = await env.DB.prepare("PRAGMA table_info(users)").all<{ name: string }>();
  const columns = (result.results ?? []) as Array<{ name: string }>;
  const hasColumn = columns.some((column: { name: string }) => column.name === "email_verified");
  if (hasColumn) return;

  await env.DB.prepare(
    "ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0"
  ).run();
}

async function ensureAlertsLifecycleColumn(env: Env): Promise<void> {
  const result = await env.DB.prepare("PRAGMA table_info(alerts)").all<{ name: string }>();
  const columns = (result.results ?? []) as Array<{ name: string }>;
  const hasLifecycle = columns.some((column: { name: string }) => column.name === "lifecycle_status");
  if (hasLifecycle) return;
  await env.DB.prepare(
    "ALTER TABLE alerts ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'Detected'"
  ).run();
}

async function ensureAlertsOwnershipColumns(env: Env): Promise<void> {
  const result = await env.DB.prepare("PRAGMA table_info(alerts)").all<{ name: string }>();
  const columns = (result.results ?? []) as Array<{ name: string }>;

  const hasOwner = columns.some((column: { name: string }) => column.name === "owner");
  if (!hasOwner) {
    await env.DB.prepare(
      "ALTER TABLE alerts ADD COLUMN owner TEXT NOT NULL DEFAULT 'Platform SRE'"
    ).run();
  }

  const hasTeam = columns.some((column: { name: string }) => column.name === "team");
  if (!hasTeam) {
    await env.DB.prepare(
      "ALTER TABLE alerts ADD COLUMN team TEXT NOT NULL DEFAULT 'Reliability'"
    ).run();
  }
}

async function ensureAutomationRuleExtraColumns(env: Env): Promise<void> {
  const result = await env.DB.prepare("PRAGMA table_info(automation_rules)").all<{ name: string }>();
  const columns = (result.results ?? []) as Array<{ name: string }>;
  const hasVerification = columns.some(
    (column: { name: string }) => column.name === "verification_window_seconds"
  );
  if (!hasVerification) {
    await env.DB.prepare(
      "ALTER TABLE automation_rules ADD COLUMN verification_window_seconds INTEGER NOT NULL DEFAULT 90"
    ).run();
  }
  const hasEscalation = columns.some(
    (column: { name: string }) => column.name === "escalation_target"
  );
  if (!hasEscalation) {
    await env.DB.prepare(
      "ALTER TABLE automation_rules ADD COLUMN escalation_target TEXT NOT NULL DEFAULT 'On-call SRE'"
    ).run();
  }
}

async function ensureAwsConnectionRoleArnColumn(env: Env): Promise<void> {
  const result = await env.DB.prepare("PRAGMA table_info(aws_connections)").all<{ name: string }>();
  const columns = (result.results ?? []) as Array<{ name: string }>;
  const hasRoleArn = columns.some((column: { name: string }) => column.name === "role_arn");
  if (hasRoleArn) return;
  await env.DB.prepare(
    "ALTER TABLE aws_connections ADD COLUMN role_arn TEXT NOT NULL DEFAULT ''"
  ).run();
}

async function ensureNotificationDeliveriesColumns(env: Env): Promise<void> {
  const result = await env.DB.prepare("PRAGMA table_info(notification_deliveries)").all<{
    name: string;
  }>();
  const columns = (result.results ?? []) as Array<{ name: string }>;

  const hasWorkspaceId = columns.some((column: { name: string }) => column.name === "workspace_id");
  if (!hasWorkspaceId) {
    await env.DB.prepare(
      "ALTER TABLE notification_deliveries ADD COLUMN workspace_id TEXT"
    ).run();
  }

  const hasChannelType = columns.some((column: { name: string }) => column.name === "channel_type");
  if (!hasChannelType) {
    await env.DB.prepare(
      "ALTER TABLE notification_deliveries ADD COLUMN channel_type TEXT NOT NULL DEFAULT 'email'"
    ).run();
  }

  const hasTarget = columns.some((column: { name: string }) => column.name === "target");
  if (!hasTarget) {
    await env.DB.prepare(
      "ALTER TABLE notification_deliveries ADD COLUMN target TEXT NOT NULL DEFAULT ''"
    ).run();
  }

  const hasUpdatedAt = columns.some((column: { name: string }) => column.name === "updated_at");
  if (!hasUpdatedAt) {
    await env.DB.prepare(
      "ALTER TABLE notification_deliveries ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''"
    ).run();
  }

  await env.DB.prepare(
    "UPDATE notification_deliveries SET updated_at = COALESCE(NULLIF(updated_at, ''), created_at)"
  ).run();
}

async function ensureAuditLogsColumns(env: Env): Promise<void> {
  const result = await env.DB.prepare("PRAGMA table_info(audit_logs)").all<{
    name: string;
  }>();
  const columns = (result.results ?? []) as Array<{ name: string }>;

  const hasWorkspaceId = columns.some((column: { name: string }) => column.name === "workspace_id");
  if (!hasWorkspaceId) {
    await env.DB.prepare("ALTER TABLE audit_logs ADD COLUMN workspace_id TEXT").run();
  }

  const hasUserId = columns.some((column: { name: string }) => column.name === "user_id");
  if (!hasUserId) {
    await env.DB.prepare("ALTER TABLE audit_logs ADD COLUMN user_id TEXT").run();
  }

  const hasMetadata = columns.some((column: { name: string }) => column.name === "metadata");
  if (!hasMetadata) {
    await env.DB.prepare(
      "ALTER TABLE audit_logs ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}'"
    ).run();
  }
}

async function createSession(c: HonoContext, userId: string): Promise<void> {
  const token = generateRandomToken(32);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

  await c.env.DB.prepare(
    `
      INSERT INTO sessions (token, user_id, expires_at, created_at)
      VALUES (?1, ?2, ?3, ?4)
    `
  )
    .bind(token, userId, expiresAt, now)
    .run();

  setCookie(c, SESSION_COOKIE_NAME, token, getSessionCookieOptions(c, SESSION_TTL_SECONDS));
}

function clearSessionCookie(c: HonoContext): void {
  setCookie(c, SESSION_COOKIE_NAME, "", getSessionCookieOptions(c, 0));
}

function getSessionCookieOptions(c: HonoContext, maxAge: number) {
  const requestProtocol = getRequestProtocol(c);
  const secure = requestProtocol === "https";
  return {
    httpOnly: true,
    path: "/",
    secure,
    sameSite: secure ? "none" : "lax",
    maxAge,
  } as const;
}

function getRequestProtocol(c: HonoContext): "http" | "https" {
  const forwardedProto = c.req.header("x-forwarded-proto");
  if (forwardedProto === "https") return "https";
  if (forwardedProto === "http") return "http";
  return c.req.url.startsWith("https://") ? "https" : "http";
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePlan(value: string): SubscriptionPlan {
  if (value === "pro" || value === "enterprise" || value === "starter") {
    return value;
  }
  return "pro";
}

async function readBody(c: HonoContext): Promise<Record<string, unknown> | null> {
  try {
    const body = await c.req.json();
    if (body && typeof body === "object") {
      return body as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function getZodIssueMessage(error: z.ZodError, fallback: string): string {
  const issue = error.issues[0];
  return issue?.message || fallback;
}

function parseBodyWithSchema<TSchema extends z.ZodTypeAny>(
  c: HonoContext,
  body: Record<string, unknown> | null,
  schema: TSchema,
  fallback = "Invalid request payload."
): { data: z.infer<TSchema> } | { response: Response } {
  if (!body) {
    return { response: c.json({ error: fallback }, 400) };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { response: c.json({ error: getZodIssueMessage(parsed.error, fallback) }, 400) };
  }

  return { data: parsed.data };
}

function safeCompare(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: PASSWORD_HASH_ITERATIONS,
      salt: base64UrlToBytes(salt),
    },
    keyMaterial,
    256
  );

  return bytesToBase64Url(new Uint8Array(derivedBits));
}

function generateRandomToken(bytesLength: number): string {
  const bytes = new Uint8Array(bytesLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function getWelcomeEmailStatus(env: Env): WelcomeEmailStatus {
  return env.RESEND_API_KEY ? "queued" : "disabled";
}

function getWelcomeEmailMessage(status: WelcomeEmailStatus): string {
  if (status === "queued") {
    return "Account created successfully. Please sign in. Welcome email sent.";
  }
  if (status === "failed") {
    return "Account created successfully. Please sign in. Welcome email could not be delivered.";
  }
  return "Account created successfully. Please sign in.";
}

async function sendWelcomeEmail({
  env,
  firstName,
  lastName,
  recipientEmail,
  requestUrl,
}: {
  env: Env;
  firstName: string;
  lastName: string;
  recipientEmail: string;
  requestUrl: string;
}): Promise<void> {
  if (!env.RESEND_API_KEY) {
    return;
  }

  const fullName = `${firstName} ${lastName}`.trim();
  const safeName = escapeHtml(fullName || firstName || "there");
  const safeFirstName = escapeHtml(firstName || "there");
  const appBaseUrl = normalizeBaseUrl(env.APP_BASE_URL) ?? getOriginFromUrl(requestUrl);
  const loginUrl = appBaseUrl ? `${appBaseUrl}/login` : null;
  const from = env.WELCOME_EMAIL_FROM || "InfraMind AI <onboarding@resend.dev>";
  const replyTo = env.WELCOME_EMAIL_REPLY_TO;
  const subject = "Welcome to InfraMind AI";

  const text = [
    `Hi ${firstName || "there"},`,
    "",
    "Welcome to InfraMind AI.",
    "Your account is ready and you can now sign in to access monitoring dashboards, alerts, and AI insights.",
    loginUrl ? `Sign in: ${loginUrl}` : "",
    "",
    "If this was not you, please contact support immediately.",
    "",
    "InfraMind AI Team",
  ]
    .filter(Boolean)
    .join("\n");

  const ctaBlock = loginUrl
    ? `
      <tr>
        <td style="padding: 0 28px 28px 28px;">
          <a href="${escapeHtml(loginUrl)}" style="display:inline-block;padding:12px 18px;background:#0ea5e9;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;">
            Open Dashboard
          </a>
        </td>
      </tr>
    `
    : "";

  const html = `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#020617;font-family:Arial,Helvetica,sans-serif;color:#e2e8f0;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#020617;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#0f172a;border:1px solid #1e293b;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px 10px 28px;">
                <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#38bdf8;">InfraMind AI</p>
                <h1 style="margin:10px 0 0 0;font-size:26px;line-height:1.25;color:#f8fafc;">Welcome to your monitoring workspace</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 0 28px;font-size:15px;line-height:1.7;color:#cbd5e1;">
                Hi ${safeFirstName},<br /><br />
                Your account for <strong style="color:#f8fafc;">${safeName}</strong> is ready.
                You can now track infrastructure health, alert status, and AI-powered insights in one place.
              </td>
            </tr>
            ${ctaBlock}
            <tr>
              <td style="padding:0 28px 24px 28px;font-size:13px;line-height:1.6;color:#94a3b8;">
                If you did not create this account, reply to this email and we will help secure it.
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;border-top:1px solid #1e293b;font-size:12px;color:#64748b;">
                InfraMind AI Team
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();

  const payload: {
    from: string;
    to: string[];
    subject: string;
    html: string;
    text: string;
    reply_to?: string;
  } = {
    from,
    to: [recipientEmail],
    subject,
    html,
    text,
  };

  if (replyTo) {
    payload.reply_to = replyTo;
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API ${response.status}: ${body}`);
  }
}

async function sendWorkspaceInvitationEmail({
  env,
  requestUrl,
  inviterName,
  inviteeEmail,
  workspaceName,
  role,
  invitationToken,
}: {
  env: Env;
  requestUrl: string;
  inviterName: string;
  inviteeEmail: string;
  workspaceName: string;
  role: WorkspaceRole;
  invitationToken: string;
}): Promise<void> {
  if (!env.RESEND_API_KEY) {
    return;
  }

  const appBaseUrl = normalizeBaseUrl(env.APP_BASE_URL) ?? getOriginFromUrl(requestUrl);
  const inviteUrl = appBaseUrl
    ? `${appBaseUrl}/invite/${encodeURIComponent(invitationToken)}`
    : null;

  const safeWorkspaceName = escapeHtml(workspaceName || "InfraMind Workspace");
  const safeInviterName = escapeHtml(inviterName || "InfraMind Team");
  const safeRole = escapeHtml(role);
  const from = env.WELCOME_EMAIL_FROM || "InfraMind AI <onboarding@resend.dev>";
  const replyTo = env.WELCOME_EMAIL_REPLY_TO;
  const subject = `${inviterName || "InfraMind Team"} invited you to ${workspaceName}`;

  const text = [
    "You were invited to InfraMind AI workspace access.",
    "",
    `Workspace: ${workspaceName}`,
    `Role: ${role}`,
    `Invited by: ${inviterName}`,
    inviteUrl ? `Accept invitation: ${inviteUrl}` : "",
    "",
    "If you do not recognize this invitation, ignore this email.",
  ]
    .filter(Boolean)
    .join("\n");

  const ctaBlock = inviteUrl
    ? `
      <tr>
        <td style="padding: 0 28px 26px 28px;">
          <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;padding:12px 18px;background:#0ea5e9;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;">
            Accept Invitation
          </a>
        </td>
      </tr>
    `
    : "";

  const html = `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#020617;font-family:Arial,Helvetica,sans-serif;color:#e2e8f0;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#020617;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#0f172a;border:1px solid #1e293b;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px 10px 28px;">
                <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#38bdf8;">InfraMind AI</p>
                <h1 style="margin:10px 0 0 0;font-size:24px;line-height:1.25;color:#f8fafc;">Workspace invitation</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 0 28px;font-size:15px;line-height:1.7;color:#cbd5e1;">
                <strong style="color:#f8fafc;">${safeInviterName}</strong> invited you to join
                <strong style="color:#f8fafc;">${safeWorkspaceName}</strong> as
                <strong style="color:#f8fafc;">${safeRole}</strong>.
              </td>
            </tr>
            ${ctaBlock}
            <tr>
              <td style="padding:0 28px 24px 28px;font-size:13px;line-height:1.6;color:#94a3b8;">
                If you did not expect this invitation, you can safely ignore this email.
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;border-top:1px solid #1e293b;font-size:12px;color:#64748b;">
                InfraMind AI Team
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();

  const payload: {
    from: string;
    to: string[];
    subject: string;
    html: string;
    text: string;
    reply_to?: string;
  } = {
    from,
    to: [inviteeEmail],
    subject,
    html,
    text,
  };

  if (replyTo) {
    payload.reply_to = replyTo;
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API ${response.status}: ${body}`);
  }
}

function normalizeBaseUrl(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function getOriginFromUrl(url: string): string | null {
  try {
    return normalizeBaseUrl(new URL(url).origin);
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function requireAuthenticatedUser(c: HonoContext): Promise<AuthUser | Response> {
  const user = await getUserFromSession(c);
  if (!user) {
    return c.json({ error: "Not authenticated." }, 401);
  }
  return user;
}

function normalizeWorkspaceRole(value: string): WorkspaceRole | null {
  const lowered = value.trim().toLowerCase();
  if (
    lowered === "owner" ||
    lowered === "admin" ||
    lowered === "engineer" ||
    lowered === "viewer"
  ) {
    return lowered;
  }
  return null;
}

function parseJsonRecord(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

async function getPrimaryMembership(
  env: Env,
  userId: string
): Promise<{ workspaceId: string; role: WorkspaceRole } | null> {
  const membership = await env.DB.prepare(
    `
      SELECT workspace_id, role
      FROM memberships
      WHERE user_id = ?1
        AND status = 'active'
      ORDER BY created_at ASC
      LIMIT 1
    `
  )
    .bind(userId)
    .first<{ workspace_id: string; role: string }>();

  if (!membership) return null;
  const role = normalizeWorkspaceRole(membership.role);
  if (!role) return null;
  return {
    workspaceId: membership.workspace_id,
    role,
  };
}

async function upsertMembership(
  env: Env,
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
  status: "invited" | "active" | "disabled"
): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `
      INSERT INTO memberships (id, workspace_id, user_id, role, status, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      ON CONFLICT(workspace_id, user_id)
      DO UPDATE SET role = excluded.role, status = excluded.status, updated_at = excluded.updated_at
    `
  )
    .bind(
      `mbr-${workspaceId}-${userId}`,
      workspaceId,
      userId,
      role,
      status,
      now,
      now
    )
    .run();
}

async function ensureDefaultWorkspaceForUser(
  env: Env,
  userId: string,
  displayName?: string
): Promise<{ workspaceId: string; role: WorkspaceRole }> {
  const existing = await getPrimaryMembership(env, userId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const workspaceId = `ws-${userId}`;
  const normalizedName = displayName?.trim() ? `${displayName.trim()} Workspace` : "My Workspace";
  const slug = `ws-${userId.slice(0, 8)}`;

  await env.DB.prepare(
    `
      INSERT OR IGNORE INTO workspaces (id, name, slug, created_by, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)
    `
  )
    .bind(workspaceId, normalizedName, slug, userId, now, now)
    .run();

  await upsertMembership(env, workspaceId, userId, "owner", "active");
  return {
    workspaceId,
    role: "owner",
  };
}

async function requireWorkspaceRole(
  env: Env,
  userId: string,
  allowedRoles: WorkspaceRole[]
): Promise<{ workspaceId: string; role: WorkspaceRole } | Response> {
  const membership = await ensureDefaultWorkspaceForUser(env, userId);
  if (allowedRoles.includes(membership.role)) {
    return membership;
  }

  return new Response(JSON.stringify({ error: "Insufficient workspace permissions." }), {
    status: 403,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

async function requireWorkspaceViewerRole(
  env: Env,
  userId: string
): Promise<{ workspaceId: string; role: WorkspaceRole } | Response> {
  return requireWorkspaceRole(env, userId, ["owner", "admin", "engineer", "viewer"]);
}

function requirePlanAccess(
  c: HonoContext,
  user: AuthUser,
  minimumPlan: SubscriptionPlan,
  featureLabel: string
): Response | null {
  if (hasPlanAccess(user.plan, minimumPlan)) return null;
  return c.json(
    {
      error: `${featureLabel} requires ${minimumPlan} plan access.`,
      code: "PLAN_ACCESS_REQUIRED",
      minimumPlan,
      currentPlan: user.plan,
    },
    403
  );
}

function getCurrentUsagePeriod(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

async function getUsageCounter(
  env: Env,
  userId: string,
  metric: PlanLimitMetric,
  period = getCurrentUsagePeriod()
): Promise<number> {
  const row = await env.DB.prepare(
    `
      SELECT value
      FROM usage_counters
      WHERE user_id = ?1 AND period = ?2 AND metric = ?3
      LIMIT 1
    `
  )
    .bind(userId, period, metric)
    .first<{ value: number }>();
  return Number(row?.value ?? 0);
}

async function incrementUsageCounter(
  env: Env,
  userId: string,
  metric: PlanLimitMetric,
  amount = 1,
  period = getCurrentUsagePeriod()
): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `
      INSERT INTO usage_counters (user_id, period, metric, value, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5)
      ON CONFLICT(user_id, period, metric)
      DO UPDATE SET value = usage_counters.value + excluded.value, updated_at = excluded.updated_at
    `
  )
    .bind(userId, period, metric, amount, now)
    .run();
}

async function requirePlanLimit(
  c: HonoContext,
  user: AuthUser,
  metric: PlanLimitMetric,
  featureLabel: string,
  currentValueResolver: (() => Promise<number>) | null = null
): Promise<Response | null> {
  const limit = PLAN_LIMITS[user.plan][metric];

  let current = 0;
  if (currentValueResolver) {
    current = await currentValueResolver();
  } else {
    current = await getUsageCounter(c.env, user.id, metric);
  }

  if (current < limit) return null;

  return c.json(
    {
      error: `${featureLabel} limit reached for ${user.plan} plan.`,
      code: "PLAN_LIMIT_REACHED",
      metric,
      limit,
      current,
      plan: user.plan,
    },
    403
  );
}

async function hashOpaqueToken(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

async function createAuthToken(
  env: Env,
  userId: string,
  purpose: AuthTokenPurpose,
  ttlSeconds: number,
  metadata: Record<string, unknown>
): Promise<{ token: string; expiresAt: string }> {
  const token = `${purpose}_${generateRandomToken(24)}`;
  const tokenHash = await hashOpaqueToken(token);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  await env.DB.prepare(
    `
      INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at, consumed_at, metadata, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    `
  )
    .bind(
      `tok-${Date.now()}-${randomInt(1000, 9999)}`,
      userId,
      purpose,
      tokenHash,
      expiresAt,
      null,
      JSON.stringify(metadata),
      now
    )
    .run();

  return { token, expiresAt };
}

async function consumeAuthToken(
  env: Env,
  token: string,
  purpose: AuthTokenPurpose
): Promise<AuthTokenRow | null> {
  const tokenHash = await hashOpaqueToken(token);
  const now = new Date().toISOString();

  const row = await env.DB.prepare(
    `
      SELECT id, user_id, purpose, token_hash, expires_at, consumed_at, metadata, created_at
      FROM auth_tokens
      WHERE token_hash = ?1
        AND purpose = ?2
        AND consumed_at IS NULL
        AND expires_at > ?3
      LIMIT 1
    `
  )
    .bind(tokenHash, purpose, now)
    .first<AuthTokenRow>();

  if (!row) return null;

  await env.DB.prepare("UPDATE auth_tokens SET consumed_at = ?1 WHERE id = ?2")
    .bind(now, row.id)
    .run();

  return row;
}

async function appendIncidentEvent(env: Env, input: {
  incidentId: string;
  eventType: string;
  title: string;
  detail: string;
  state: AlertLifecycleStatus;
  actorType: "system" | "user";
  actorId: string | null;
}): Promise<void> {
  await env.DB.prepare(
    `
      INSERT INTO incident_events (
        id, incident_id, event_type, title, detail, state, actor_type, actor_id, created_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    `
  )
    .bind(
      `iev-${Date.now()}-${randomInt(1000, 9999)}`,
      input.incidentId,
      input.eventType,
      input.title,
      input.detail,
      input.state,
      input.actorType,
      input.actorId,
      new Date().toISOString()
    )
    .run();
}

async function appendAuditLog(env: Env, input: {
  workspaceId: string | null;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  await env.DB.prepare(
    `
      INSERT INTO audit_logs (id, workspace_id, user_id, action, entity_type, entity_id, metadata, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    `
  )
    .bind(
      `aud-${Date.now()}-${randomInt(1000, 9999)}`,
      input.workspaceId,
      input.userId,
      input.action,
      input.entityType,
      input.entityId,
      JSON.stringify(input.metadata),
      new Date().toISOString()
    )
    .run();
}

type NotificationDispatchInput = {
  workspaceId: string;
  incidentId: string | null;
  type: NotificationDeliveryRow["channel_type"];
  target: string;
  source: "test" | "system";
  maxAttempts?: number;
};

type NotificationDispatchResult = {
  id: string;
  type: NotificationDeliveryRow["channel_type"];
  target: string;
  status: NotificationDeliveryRow["status"];
  providerMessageId: string | null;
  attemptCount: number;
  errorMessage: string | null;
  createdAt: string;
};

async function dispatchNotification(
  env: Env,
  input: NotificationDispatchInput
): Promise<NotificationDispatchResult> {
  const maxAttempts = Math.max(1, input.maxAttempts ?? 3);
  let attempt = 0;
  let status: NotificationDeliveryRow["status"] = "failed";
  let providerMessageId: string | null = null;
  let errorMessage: string | null = null;
  let retryableFailure = true;

  while (attempt < maxAttempts) {
    attempt += 1;
    const providerResult = await sendViaNotificationProvider({
      env,
      channelType: input.type,
      target: input.target,
      attempt,
      source: input.source,
      incidentId: input.incidentId,
    });
    status = providerResult.status;
    providerMessageId = providerResult.providerMessageId;
    errorMessage = providerResult.errorMessage;
    retryableFailure = providerResult.retryable;
    if (status === "sent") break;
    if (!providerResult.retryable) {
      status = "dropped";
      break;
    }
    if (attempt < maxAttempts) {
      const retryDelayMs = Math.min(120 * 2 ** (attempt - 1), 1000);
      await sleep(retryDelayMs);
    }
  }

  if (status !== "sent" && retryableFailure && attempt >= maxAttempts) {
    status = "dropped";
    errorMessage = errorMessage ?? "Delivery dropped after retry attempts were exhausted.";
  }

  const now = new Date().toISOString();
  const deliveryId = `nd-${Date.now()}-${randomInt(1000, 9999)}`;
  await env.DB.prepare(
    `
      INSERT INTO notification_deliveries (
        id, workspace_id, incident_id, channel_type, target, status,
        provider_message_id, attempt_count, error_message, created_at, updated_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
    `
  )
    .bind(
      deliveryId,
      input.workspaceId,
      input.incidentId,
      input.type,
      input.target,
      status,
      providerMessageId,
      attempt,
      errorMessage,
      now,
      now
    )
    .run();

  if (status === "dropped") {
    const deadLetterId = `ndl-${Date.now()}-${randomInt(1000, 9999)}`;
    await env.DB.prepare(
      `
        INSERT INTO notification_dead_letters (
          id, workspace_id, incident_id, channel_type, target, payload, reason, attempt_count, created_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
      `
    )
      .bind(
        deadLetterId,
        input.workspaceId,
        input.incidentId,
        input.type,
        input.target,
        JSON.stringify({
          source: input.source,
          maxAttempts,
        }),
        errorMessage ?? "Delivery dropped after retry exhaustion.",
        attempt,
        now
      )
      .run();
  }

  return {
    id: deliveryId,
    type: input.type,
    target: input.target,
    status,
    providerMessageId,
    attemptCount: attempt,
    errorMessage,
    createdAt: now,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureUserSettings(env: Env, userId: string): Promise<void> {
  const row = await env.DB.prepare("SELECT user_id FROM user_settings WHERE user_id = ?1 LIMIT 1")
    .bind(userId)
    .first<{ user_id: string }>();
  if (row) return;

  await env.DB.prepare(
    `
      INSERT INTO user_settings (
        user_id, company, role, timezone, theme, email_alerts, slack_alerts, weekly_report, updated_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    `
  )
    .bind(
      userId,
      "InfraMind Cloud Team",
      "Platform Engineer",
      "Asia/Kolkata",
      "system",
      1,
      1,
      0,
      new Date().toISOString()
    )
    .run();
}

async function seedMonitoringData(env: Env): Promise<void> {
  const serversCount = await env.DB.prepare("SELECT COUNT(*) as count FROM servers")
    .first<{ count: number }>();
  if (!serversCount || Number(serversCount.count) === 0) {
    const now = new Date().toISOString();
    const seedServers = [
      ["srv-01", "prod-api-01", "10.0.1.12", "us-east-1", "28d 14h", 41, 62, "Healthy", "8s ago", now],
      ["srv-02", "prod-api-02", "10.0.1.13", "us-east-1", "23d 08h", 69, 78, "Warning", "12s ago", now],
      ["srv-03", "prod-worker-01", "10.0.2.21", "eu-west-1", "16d 21h", 52, 58, "Healthy", "11s ago", now],
      ["srv-04", "db-primary-01", "10.0.3.10", "ap-south-1", "61d 02h", 88, 91, "Critical", "4s ago", now],
      ["srv-05", "cache-node-01", "10.0.4.16", "us-west-2", "34d 19h", 46, 49, "Healthy", "9s ago", now],
    ] as const;
    for (const server of seedServers) {
      await env.DB.prepare(
        `
          INSERT INTO servers (
            id, name, ip, region, uptime, cpu, memory, status, last_heartbeat, created_at
          )
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        `
      )
        .bind(...server)
        .run();
    }
  }

  const alertsCount = await env.DB.prepare("SELECT COUNT(*) as count FROM alerts")
    .first<{ count: number }>();
  if (!alertsCount || Number(alertsCount.count) === 0) {
    const now = new Date().toISOString();
    const seedAlerts = [
      ["ALT-8412", "Database connection timeout exceeded threshold", "db-primary-01", "Critical", "Active", now],
      ["ALT-8410", "Memory usage above 80% for 10 minutes", "prod-api-02", "Warning", "Active", now],
      ["ALT-8408", "Cache service restarted automatically", "cache-node-01", "Info", "Resolved", now],
      ["ALT-8397", "Packet loss spike detected in eu-west-1", "edge-gateway-03", "Warning", "Resolved", now],
    ] as const;
    for (const alert of seedAlerts) {
      await env.DB.prepare(
        `
          INSERT INTO alerts (id, title, source, severity, status, created_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        `
      )
        .bind(...alert)
        .run();
    }
  }

  const rulesCount = await env.DB.prepare("SELECT COUNT(*) as count FROM automation_rules")
    .first<{ count: number }>();
  if (!rulesCount || Number(rulesCount.count) === 0) {
    const now = new Date().toISOString();
    const seedRules = [
      [
        "rule-1",
        "Restart API Service on High CPU",
        "CPU > 90% for 5 minutes on prod-api-*",
        "Restart api service and flush worker queue",
        15,
        1,
        "3 hours ago",
        97,
        now,
      ],
      [
        "rule-2",
        "Scale Worker Pool on Queue Spike",
        "Queue depth > 2000 for 3 minutes",
        "Add 2 worker replicas and rebalance queue consumers",
        20,
        1,
        "12 hours ago",
        93,
        now,
      ],
      [
        "rule-3",
        "Clear Temp Logs on Disk Pressure",
        "Disk utilization > 92% on /var",
        "Archive and prune logs older than 7 days",
        60,
        0,
        "5 days ago",
        88,
        now,
      ],
    ] as const;
    for (const rule of seedRules) {
      await env.DB.prepare(
        `
          INSERT INTO automation_rules (
            id, name, trigger_condition, action_text, cooldown_minutes, enabled, last_run, success_rate, created_at
          )
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        `
      )
        .bind(...rule)
        .run();
    }
  }

  const recommendationsCount = await env.DB.prepare("SELECT COUNT(*) as count FROM ai_recommendations")
    .first<{ count: number }>();
  if (!recommendationsCount || Number(recommendationsCount.count) === 0) {
    const seedRecommendations = [
      [
        "rc-201",
        "Scale API deployment by +2 instances during 12:00-17:00 UTC",
        "Expected 18% reduction in request latency during peak traffic.",
        "High",
        0,
      ],
      [
        "rc-202",
        "Increase DB connection pool and cap idle timeout to 60s",
        "Estimated 12% lower timeout rate for read-heavy bursts.",
        "Medium",
        0,
      ],
      [
        "rc-203",
        "Archive old log partitions every 6 hours",
        "Projected delay of disk saturation threshold by 3 weeks.",
        "Low",
        0,
      ],
    ] as const;

    for (const recommendation of seedRecommendations) {
      await env.DB.prepare(
        `
          INSERT INTO ai_recommendations (id, title, impact, priority, done)
          VALUES (?1, ?2, ?3, ?4, ?5)
        `
      )
        .bind(...recommendation)
        .run();
    }
  }
}

async function seedDetectionRules(env: Env): Promise<void> {
  const count = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM incident_detection_rules"
  ).first<{ count: number }>();
  if (Number(count?.count ?? 0) > 0) {
    return;
  }

  const now = new Date().toISOString();
  const defaults: Array<[
    string,
    string,
    DetectionRuleMetric,
    DetectionRuleOperator,
    number,
    "Critical" | "Warning" | "Info",
    number,
    number,
    string | null,
    string,
    string
  ]> = [
    [
      "dr-high-error-rate",
      "High Error Rate",
      "error_rate",
      "gte",
      5,
      "Critical",
      10,
      1,
      null,
      now,
      now,
    ],
    [
      "dr-high-response-time",
      "API Latency Spike",
      "response_time",
      "gte",
      900,
      "Warning",
      15,
      1,
      null,
      now,
      now,
    ],
  ];

  for (const row of defaults) {
    await env.DB.prepare(
      `
        INSERT INTO incident_detection_rules (
          id, name, metric, operator, threshold, severity, cooldown_minutes,
          enabled, last_triggered_at, created_at, updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
      `
    )
      .bind(...row)
      .run();
  }
}

function generateMetricSeries(
  metric: "cpu" | "memory" | "disk" | "network",
  range: "1h" | "24h" | "7d"
): Array<{ timestamp: string; value: number }> {
  const config: Record<typeof metric, { base: number; variance: number; min: number; max: number }> = {
    cpu: { base: 38, variance: 8, min: 20, max: 95 },
    memory: { base: 63, variance: 6, min: 28, max: 98 },
    disk: { base: 56, variance: 4, min: 18, max: 90 },
    network: { base: 94, variance: 22, min: 20, max: 190 },
  };

  const pointsCount = range === "1h" ? 20 : range === "7d" ? 28 : 24;
  const stepMs = range === "1h" ? 3 * 60 * 1000 : range === "7d" ? 6 * 60 * 60 * 1000 : 60 * 60 * 1000;
  const metricConfig = config[metric];
  const values: Array<{ timestamp: string; value: number }> = [];

  let current = metricConfig.base;
  for (let index = pointsCount - 1; index >= 0; index -= 1) {
    const drift = (Math.random() - 0.5) * metricConfig.variance * 1.8;
    current = clampNumber(current + drift, metricConfig.min, metricConfig.max);
    values.push({
      timestamp: new Date(Date.now() - index * stepMs).toISOString(),
      value: Number(current.toFixed(2)),
    });
  }

  return values;
}

function buildLatestMetricsSample() {
  const at = new Date().toISOString();
  return {
    at,
    timestamp: at,
    cpu: randomInt(20, 95),
    memory: randomInt(28, 98),
    disk: randomInt(18, 90),
    network: randomInt(20, 190),
    errorRate: Number((Math.random() * 8).toFixed(2)),
    responseTime: randomInt(80, 1300),
  };
}

function generateMetricsBundle(range: "15m" | "1h" | "24h") {
  const length = range === "15m" ? 20 : range === "1h" ? 24 : 36;
  return {
    cpu: generateSeriesWave(length, 44, 14, 12, 98),
    memory: generateSeriesWave(length, 58, 11, 16, 98),
    disk: generateSeriesWave(length, 52, 9, 12, 96),
    network: generateSeriesWave(length, 820, 520, 80, 2400),
    errorRate: generateSeriesWave(length, 1.8, 2.2, 0, 12),
    responseTime: generateSeriesWave(length, 320, 240, 70, 1800),
    anomalies: generateAnomalyFlags(length),
  };
}

function generateSeriesWave(
  length: number,
  center: number,
  variance: number,
  min: number,
  max: number
): number[] {
  const values: number[] = [];
  let current = center;
  for (let index = 0; index < length; index += 1) {
    const drift = (Math.random() - 0.5) * variance;
    current = clampNumber(current + drift, min, max);
    values.push(Number(current.toFixed(2)));
  }
  return values;
}

function generateAnomalyFlags(length: number): number[] {
  const flags = new Array(length).fill(0);
  const count = Math.max(1, Math.floor(length / 12));
  for (let index = 0; index < count; index += 1) {
    flags[randomInt(0, length - 1)] = 1;
  }
  return flags;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function parseBoundedInt(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = parsePositiveInt(value, fallback);
  return clampNumber(parsed, min, max);
}

function normalizeSortDirection(value: string | undefined): "asc" | "desc" {
  return value?.toLowerCase() === "asc" ? "asc" : "desc";
}

function normalizeServerSortField(value: string | undefined): keyof ServerResponseItem {
  const allowed: Array<keyof ServerResponseItem> = [
    "createdAt",
    "name",
    "region",
    "status",
    "cpu",
    "memory",
    "lastHeartbeat",
  ];
  return allowed.includes(value as keyof ServerResponseItem)
    ? (value as keyof ServerResponseItem)
    : "createdAt";
}

function normalizeAlertSortField(value: string | undefined): keyof AlertResponseItem {
  const allowed: Array<keyof AlertResponseItem> = [
    "createdAt",
    "title",
    "source",
    "severity",
    "status",
  ];
  return allowed.includes(value as keyof AlertResponseItem)
    ? (value as keyof AlertResponseItem)
    : "createdAt";
}

function normalizeRuleSortField(value: string | undefined): keyof RuleResponseItem {
  const allowed: Array<keyof RuleResponseItem> = [
    "createdAt",
    "name",
    "enabled",
    "successRate",
    "cooldownMinutes",
    "lastRun",
  ];
  return allowed.includes(value as keyof RuleResponseItem)
    ? (value as keyof RuleResponseItem)
    : "createdAt";
}

function getServerSortValue(
  server: ServerResponseItem,
  sortBy: keyof ServerResponseItem
): string | number | boolean {
  return server[sortBy];
}

function getAlertSortValue(
  alert: AlertResponseItem,
  sortBy: keyof AlertResponseItem
): string | number | boolean {
  return alert[sortBy];
}

function getRuleSortValue(
  rule: RuleResponseItem,
  sortBy: keyof RuleResponseItem
): string | number | boolean {
  return rule[sortBy];
}

function compareValues(
  left: string | number | boolean,
  right: string | number | boolean,
  direction: "asc" | "desc"
): number {
  const multiplier = direction === "asc" ? 1 : -1;
  if (typeof left === "number" && typeof right === "number") {
    return (left - right) * multiplier;
  }
  if (typeof left === "boolean" && typeof right === "boolean") {
    return (Number(left) - Number(right)) * multiplier;
  }
  return String(left).localeCompare(String(right)) * multiplier;
}

function paginateList<T>(items: T[], page: number, limit: number) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = clampNumber(page, 1, totalPages);
  const offset = (safePage - 1) * limit;
  return {
    items: items.slice(offset, offset + limit),
    meta: {
      page: safePage,
      limit,
      total,
      totalPages,
    },
  };
}

function buildIncidentTimeline(alert: AlertRow) {
  return [
    {
      id: `${alert.id}-ev-3`,
      at: alert.created_at,
      title: "Detected",
      detail: "CloudWatch alarm threshold breached.",
      state: "Detected",
    },
    {
      id: `${alert.id}-ev-2`,
      at: new Date(new Date(alert.created_at).getTime() + 2 * 60 * 1000).toISOString(),
      title: "Analyzing",
      detail: "Automated diagnosis checked service health and dependencies.",
      state: "Analyzing",
    },
    {
      id: `${alert.id}-ev-1`,
      at: new Date(new Date(alert.created_at).getTime() + 5 * 60 * 1000).toISOString(),
      title: alert.status === "Resolved" ? "Resolved" : "Recovering",
      detail:
        alert.status === "Resolved"
          ? "Verification checks passed and incident was resolved."
          : "Recovery playbook started and waiting for verification.",
      state: alert.status === "Resolved" ? "Resolved" : "Recovering",
    },
  ];
}

function computeAuditResult(incidentId: string): "passed" | "failed" {
  let sum = 0;
  for (let index = 0; index < incidentId.length; index += 1) {
    sum += incidentId.charCodeAt(index);
  }
  return sum % 5 === 0 ? "failed" : "passed";
}

async function ensureAwsConnection(env: Env, userId: string): Promise<void> {
  const existing = await env.DB.prepare(
    "SELECT user_id FROM aws_connections WHERE user_id = ?1 LIMIT 1"
  )
    .bind(userId)
    .first<{ user_id: string }>();
  if (existing) return;

  await env.DB.prepare(
    `
      INSERT INTO aws_connections (
        user_id, account_id, region, environment, role_arn, connection_status, auto_recovery_enabled,
        channel_email, channel_sms, channel_slack, channel_teams, updated_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
    `
  )
    .bind(
      userId,
      "123456789012",
      "us-east-1",
      "prod",
      `arn:aws:iam::123456789012:role/InfraMindMonitorRole`,
      "connected",
      1,
      1,
      0,
      1,
      0,
      new Date().toISOString()
    )
    .run();
}

async function getAwsConfigForUser(env: Env, userId: string) {
  const row = await env.DB.prepare(
    `
      SELECT
        user_id,
        account_id,
        region,
        environment,
        role_arn,
        connection_status,
        auto_recovery_enabled,
        channel_email,
        channel_sms,
        channel_slack,
        channel_teams,
        updated_at
      FROM aws_connections
      WHERE user_id = ?1
      LIMIT 1
    `
  )
    .bind(userId)
    .first<AwsConnectionRow>();

  const config = row ?? {
    user_id: userId,
    account_id: "123456789012",
    region: "us-east-1",
    environment: "prod",
    role_arn: "arn:aws:iam::123456789012:role/InfraMindMonitorRole",
    connection_status: "connected",
    auto_recovery_enabled: 1,
    channel_email: 1,
    channel_sms: 0,
    channel_slack: 1,
    channel_teams: 0,
    updated_at: new Date().toISOString(),
  };

  return {
    accountId: config.account_id,
    region: config.region,
    environment: config.environment,
    roleArn: config.role_arn,
    connectionStatus: config.connection_status,
    autoRecoveryEnabled: Boolean(config.auto_recovery_enabled),
    alertChannels: {
      email: Boolean(config.channel_email),
      sms: Boolean(config.channel_sms),
      slack: Boolean(config.channel_slack),
      teams: Boolean(config.channel_teams),
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
  };
}

function resolveLifecycleStatus(alert: AlertRow): AlertLifecycleStatus {
  if (alert.lifecycle_status && isValidIncidentStatus(alert.lifecycle_status)) {
    return alert.lifecycle_status;
  }
  if (alert.status === "Resolved") return "Resolved";
  return "Detected";
}

function isValidIncidentStatus(value: string): value is AlertLifecycleStatus {
  return ["Detected", "Analyzing", "Recovering", "Resolved", "Escalated"].includes(value);
}

async function runIncidentLifecyclePolicy(env: Env): Promise<void> {
  await evaluateIncidentDetectionRules(env);

  const rows = await env.DB.prepare(
    `
      SELECT id, title, source, severity, status, lifecycle_status, owner, team, created_at
      FROM alerts
      WHERE status = 'Active'
      ORDER BY created_at ASC
    `
  ).all<AlertRow>();

  const now = Date.now();
  for (const alert of (rows.results ?? []) as AlertRow[]) {
    const createdAtMs = Date.parse(alert.created_at);
    if (Number.isNaN(createdAtMs)) {
      continue;
    }

    const ageMinutes = (now - createdAtMs) / (60 * 1000);
    const current = resolveLifecycleStatus(alert);
    let target = current;

    if (current === "Detected" && ageMinutes >= 10) {
      target = "Analyzing";
    } else if (current === "Analyzing" && ageMinutes >= 20) {
      target = "Recovering";
    } else if (current === "Recovering" && ageMinutes >= 40) {
      target = "Escalated";
    }

    if (target !== current) {
      await updateIncidentLifecycleStatus(env, alert.id, target, {
        reason: "policy_transition",
      });
    }
  }
}

async function evaluateIncidentDetectionRules(env: Env): Promise<void> {
  const rules = await env.DB.prepare(
    `
      SELECT
        id, name, metric, operator, threshold, severity, cooldown_minutes,
        enabled, last_triggered_at, created_at, updated_at
      FROM incident_detection_rules
      WHERE enabled = 1
    `
  ).all<DetectionRuleRow>();

  const allRules = (rules.results ?? []) as DetectionRuleRow[];
  if (allRules.length === 0) return;

  const [activeAlertsRow] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) as count FROM alerts WHERE status = 'Active'")
      .first<{ count: number }>(),
  ]);

  const metrics = buildLatestMetricsSample();
  const valuesByMetric: Record<DetectionRuleMetric, number> = {
    error_rate: Number(metrics.errorRate),
    response_time: Number(metrics.responseTime),
    cpu: Number(metrics.cpu),
    memory: Number(metrics.memory),
    disk: Number(metrics.disk),
    network: Number(metrics.network),
    active_alerts: Number(activeAlertsRow?.count ?? 0),
  };

  const now = new Date();
  const nowIso = now.toISOString();

  for (const rule of allRules) {
    const metricValue = valuesByMetric[rule.metric];
    if (!evaluateThreshold(metricValue, rule.operator, Number(rule.threshold))) {
      continue;
    }

    if (rule.last_triggered_at) {
      const elapsedMs = now.getTime() - Date.parse(rule.last_triggered_at);
      if (!Number.isNaN(elapsedMs) && elapsedMs < rule.cooldown_minutes * 60_000) {
        continue;
      }
    }

    const existingActive = await env.DB.prepare(
      "SELECT id FROM alerts WHERE source = ?1 AND status = 'Active' LIMIT 1"
    )
      .bind(`rule:${rule.id}`)
      .first<{ id: string }>();

    if (existingActive) {
      await env.DB.prepare(
        "UPDATE incident_detection_rules SET last_triggered_at = ?1, updated_at = ?2 WHERE id = ?3"
      )
        .bind(nowIso, nowIso, rule.id)
        .run();
      continue;
    }

    const incidentId = `ALT-RULE-${Date.now()}-${randomInt(1000, 9999)}`;
    await env.DB.prepare(
      `
        INSERT INTO alerts (
          id, title, source, severity, status, lifecycle_status, owner, team, created_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
      `
    )
      .bind(
        incidentId,
        `${rule.name} threshold breached`,
        `rule:${rule.id}`,
        rule.severity,
        "Active",
        "Detected",
        "Platform SRE",
        "Reliability",
        nowIso
      )
      .run();

    await appendIncidentEvent(env, {
      incidentId,
      eventType: "detection_rule_triggered",
      title: "Detected",
      detail: `${rule.metric} ${rule.operator} ${rule.threshold} (actual: ${metricValue}).`,
      state: "Detected",
      actorType: "system",
      actorId: null,
    });

    await env.DB.prepare(
      "UPDATE incident_detection_rules SET last_triggered_at = ?1, updated_at = ?2 WHERE id = ?3"
    )
      .bind(nowIso, nowIso, rule.id)
      .run();
  }
}

function evaluateThreshold(
  value: number,
  operator: DetectionRuleOperator,
  threshold: number
): boolean {
  if (operator === "gt") return value > threshold;
  if (operator === "gte") return value >= threshold;
  if (operator === "lt") return value < threshold;
  return value <= threshold;
}

async function updateIncidentLifecycleStatus(
  env: Env,
  incidentId: string,
  status: AlertLifecycleStatus,
  options?: {
    actorId?: string;
    workspaceId?: string;
    reason?: string;
  }
): Promise<void> {
  const current = await env.DB.prepare(
    `
      SELECT status, lifecycle_status
      FROM alerts
      WHERE id = ?1
      LIMIT 1
    `
  )
    .bind(incidentId)
    .first<{ status: "Active" | "Resolved"; lifecycle_status: AlertLifecycleStatus | null }>();
  if (!current) {
    return;
  }
  const currentLifecycle = current.lifecycle_status ?? (current.status === "Resolved" ? "Resolved" : "Detected");
  if (currentLifecycle === status) {
    return;
  }

  const alertStatus = status === "Resolved" ? "Resolved" : "Active";
  await env.DB.prepare(
    `
      UPDATE alerts
      SET status = ?1, lifecycle_status = ?2
      WHERE id = ?3
    `
  )
    .bind(alertStatus, status, incidentId)
    .run();

  if (status === "Escalated") {
    await env.DB.prepare(
      `
        UPDATE alerts
        SET
          owner = CASE WHEN TRIM(owner) = '' THEN 'On-call Commander' ELSE owner END,
          team = CASE WHEN TRIM(team) = '' THEN 'Incident Response' ELSE team END
        WHERE id = ?1
      `
    )
      .bind(incidentId)
      .run();
  }

  const eventTitle =
    status === "Detected"
      ? "Detected"
      : status === "Analyzing"
      ? "Analyzing"
      : status === "Recovering"
      ? "Recovering"
      : status === "Resolved"
      ? "Resolved"
      : "Escalated";

  await appendIncidentEvent(env, {
    incidentId,
    eventType: options?.reason ?? "status_update",
    title: eventTitle,
    detail: `Incident moved to ${status}.`,
    state: status,
    actorType: options?.actorId ? "user" : "system",
    actorId: options?.actorId ?? null,
  });

  if (options?.workspaceId) {
    await appendAuditLog(env, {
      workspaceId: options.workspaceId,
      userId: options.actorId ?? null,
      action: "incident.status_changed",
      entityType: "incident",
      entityId: incidentId,
      metadata: {
        status,
        reason: options.reason ?? "status_update",
      },
    });

    if (status === "Escalated" || status === "Resolved") {
      await dispatchIncidentLifecycleNotifications(env, {
        workspaceId: options.workspaceId,
        incidentId,
        status,
        actorId: options.actorId ?? null,
      });
    }
  }
}

async function getAlertById(env: Env, id: string): Promise<AlertRow | null> {
  return env.DB.prepare(
    `
      SELECT id, title, source, severity, status, lifecycle_status, owner, team, created_at
      FROM alerts
      WHERE id = ?1
      LIMIT 1
    `
  )
    .bind(id)
    .first<AlertRow>();
}

async function dispatchIncidentLifecycleNotifications(
  env: Env,
  input: {
    workspaceId: string;
    incidentId: string;
    status: "Escalated" | "Resolved";
    actorId: string | null;
  }
): Promise<void> {
  const actorId = input.actorId;
  if (!actorId) {
    return;
  }

  const [channelConfig, actor] = await Promise.all([
    env.DB.prepare(
      `
        SELECT channel_email, channel_sms, channel_slack, channel_teams
        FROM aws_connections
        WHERE user_id = ?1
        LIMIT 1
      `
    )
      .bind(actorId)
      .first<{
        channel_email: number;
        channel_sms: number;
        channel_slack: number;
        channel_teams: number;
      }>(),
    env.DB.prepare("SELECT email FROM users WHERE id = ?1 LIMIT 1")
      .bind(actorId)
      .first<{ email: string }>(),
  ]);

  if (!channelConfig) {
    return;
  }

  const deliveries: Array<Promise<unknown>> = [];
  const summaryTarget = `incident:${input.incidentId}:${input.status.toLowerCase()}`;

  if (channelConfig.channel_email && actor?.email) {
    deliveries.push(
      dispatchNotification(env, {
        workspaceId: input.workspaceId,
        incidentId: input.incidentId,
        type: "email",
        target: actor.email,
        source: "system",
      })
    );
  }
  if (channelConfig.channel_sms) {
    deliveries.push(
      dispatchNotification(env, {
        workspaceId: input.workspaceId,
        incidentId: input.incidentId,
        type: "sms",
        target: "+15550001111",
        source: "system",
      })
    );
  }
  if (channelConfig.channel_slack) {
    deliveries.push(
      dispatchNotification(env, {
        workspaceId: input.workspaceId,
        incidentId: input.incidentId,
        type: "slack",
        target: `https://hooks.slack.com/services/${summaryTarget}`,
        source: "system",
      })
    );
  }
  if (channelConfig.channel_teams) {
    deliveries.push(
      dispatchNotification(env, {
        workspaceId: input.workspaceId,
        incidentId: input.incidentId,
        type: "teams",
        target: `https://outlook.office.com/webhook/${summaryTarget}`,
        source: "system",
      })
    );
  }

  if (deliveries.length === 0) {
    return;
  }

  await Promise.allSettled(deliveries);
}

type PlaybookExecutionRunInput = {
  playbookId: string;
  incidentId: string | null;
  runType: "manual" | "system";
  actorUserId: string | null;
  workspaceId: string;
};

type PlaybookExecutionRunResult = {
  success: boolean;
  code:
    | "OK"
    | "PLAYBOOK_NOT_FOUND"
    | "PLAYBOOK_DISABLED"
    | "PLAYBOOK_ALREADY_RUNNING"
    | "PLAYBOOK_EXECUTION_FAILED";
  executionId: string | null;
  status: "running" | "success" | "failed" | "escalated";
  verificationResult: "pending" | "passed" | "failed" | null;
  retryCount: number | null;
  message: string;
};

async function runPlaybookExecution(
  env: Env,
  input: PlaybookExecutionRunInput
): Promise<PlaybookExecutionRunResult> {
  const playbook = await env.DB.prepare(
    `
      SELECT id, action_text, enabled, verification_window_seconds, escalation_target
      FROM automation_rules
      WHERE id = ?1
      LIMIT 1
    `
  )
    .bind(input.playbookId)
    .first<{
      id: string;
      action_text: string;
      enabled: number;
      verification_window_seconds: number;
      escalation_target: string;
    }>();

  if (!playbook) {
    return {
      success: false,
      code: "PLAYBOOK_NOT_FOUND",
      executionId: null,
      status: "failed",
      verificationResult: null,
      retryCount: null,
      message: "Playbook not found.",
    };
  }

  if (!playbook.enabled) {
    return {
      success: false,
      code: "PLAYBOOK_DISABLED",
      executionId: null,
      status: "failed",
      verificationResult: null,
      retryCount: null,
      message: "Playbook is disabled.",
    };
  }

  const lockKey = `${input.playbookId}:${input.incidentId ?? "manual"}`;
  const lockOwnerId =
    input.actorUserId ?? `system-${Date.now()}-${randomInt(1000, 9999)}`;
  const lockAcquired = await acquirePlaybookExecutionLock(env, lockKey, lockOwnerId);
  if (!lockAcquired) {
    return {
      success: false,
      code: "PLAYBOOK_ALREADY_RUNNING",
      executionId: null,
      status: "running",
      verificationResult: "pending",
      retryCount: 0,
      message: "Playbook execution is already in progress.",
    };
  }

  const startedAt = new Date().toISOString();
  const executionId = `pe-${Date.now()}-${randomInt(1000, 9999)}`;
  const actions = parsePlaybookActions(playbook.action_text);
  const maxRetries = 2;
  let retryCount = 0;
  let status: "success" | "failed" | "escalated" = "failed";
  let verificationResult: "passed" | "failed" = "failed";
  let success = false;
  const attemptDetails: Array<{
    attempt: number;
    actions: Array<{ action: PlaybookAction; success: boolean; detail: string }>;
    verificationPassed: boolean;
  }> = [];

  try {
    for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
      const actionResults: Array<{ action: PlaybookAction; success: boolean; detail: string }> = [];
      let actionFailure = false;

      for (const action of actions) {
        const result = simulatePlaybookAction(action, attempt);
        actionResults.push(result);
        if (!result.success) {
          actionFailure = true;
          break;
        }
      }

      const verificationPassed = !actionFailure && simulateVerificationCheck(
        input.playbookId,
        playbook.verification_window_seconds,
        attempt
      );

      attemptDetails.push({
        attempt,
        actions: actionResults,
        verificationPassed,
      });

      if (!actionFailure && verificationPassed) {
        success = true;
        status = "success";
        verificationResult = "passed";
        retryCount = attempt - 1;
        break;
      }

      retryCount = attempt;
    }

    if (!success) {
      status = "escalated";
      verificationResult = "failed";
    }

    await env.DB.prepare(
      `
        INSERT INTO playbook_executions (
          id, playbook_id, incident_id, status, verification_result, retry_count,
          started_at, finished_at, details
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
      `
    )
      .bind(
        executionId,
        input.playbookId,
        input.incidentId,
        status,
        verificationResult,
        retryCount,
        startedAt,
        new Date().toISOString(),
        JSON.stringify({
          runType: input.runType,
          actions,
          attempts: attemptDetails,
          escalationTarget: playbook.escalation_target,
          lockKey,
        })
      )
      .run();

    await env.DB.prepare(
      `
        UPDATE automation_rules
        SET
          last_run = ?1,
          success_rate = MIN(99, MAX(55, success_rate + ?2))
        WHERE id = ?3
      `
    )
      .bind(
        "Just now",
        success ? randomInt(1, 3) : randomInt(-8, -3),
        input.playbookId
      )
      .run();

    if (input.incidentId) {
      await updateIncidentLifecycleStatus(
        env,
        input.incidentId,
        success ? "Resolved" : "Escalated",
        {
          actorId: input.actorUserId ?? undefined,
          workspaceId: input.workspaceId,
          reason: success ? "auto_recovery_succeeded" : "auto_recovery_failed",
        }
      );
    }

    return {
      success,
      code: success ? "OK" : "PLAYBOOK_EXECUTION_FAILED",
      executionId,
      status,
      verificationResult,
      retryCount,
      message: success
        ? "Playbook executed successfully."
        : "Playbook execution failed verification and was escalated.",
    };
  } finally {
    await releasePlaybookExecutionLock(env, lockKey, lockOwnerId);
  }
}

async function acquirePlaybookExecutionLock(
  env: Env,
  lockKey: string,
  ownerId: string,
  ttlMs = 90_000
): Promise<boolean> {
  const now = Date.now();
  const expiresAt = playbookExecutionLocks.get(lockKey);
  if (expiresAt && expiresAt > now) {
    return false;
  }

  const nowIso = new Date(now).toISOString();
  const expiresIso = new Date(now + ttlMs).toISOString();
  await env.DB.prepare(
    "DELETE FROM playbook_execution_locks WHERE expires_at <= ?1"
  )
    .bind(nowIso)
    .run();

  const insertResult = await env.DB.prepare(
    `
      INSERT OR IGNORE INTO playbook_execution_locks (lock_key, owner_id, expires_at, created_at)
      VALUES (?1, ?2, ?3, ?4)
    `
  )
    .bind(lockKey, ownerId, expiresIso, nowIso)
    .run();
  if (Number(insertResult.meta?.changes ?? 0) === 0) {
    return false;
  }

  playbookExecutionLocks.set(lockKey, now + ttlMs);
  cleanupPlaybookExecutionLocks(now);
  return true;
}

async function releasePlaybookExecutionLock(
  env: Env,
  lockKey: string,
  ownerId: string
): Promise<void> {
  await env.DB.prepare(
    "DELETE FROM playbook_execution_locks WHERE lock_key = ?1 AND owner_id = ?2"
  )
    .bind(lockKey, ownerId)
    .run();
  playbookExecutionLocks.delete(lockKey);
}

function cleanupPlaybookExecutionLocks(now: number): void {
  if (playbookExecutionLocks.size <= 400) return;
  for (const [key, expiresAt] of playbookExecutionLocks.entries()) {
    if (expiresAt <= now) {
      playbookExecutionLocks.delete(key);
    }
  }
}

function simulatePlaybookAction(
  action: PlaybookAction,
  attempt: number
): { action: PlaybookAction; success: boolean; detail: string } {
  const baseSuccessChance =
    action === "restart"
      ? 0.84
      : action === "scale"
      ? 0.87
      : action === "redeploy"
      ? 0.79
      : 0.75;
  const adjustedChance = Math.min(0.96, baseSuccessChance + (attempt - 1) * 0.06);
  const success = Math.random() <= adjustedChance;
  return {
    action,
    success,
    detail: success
      ? `${action} action completed.`
      : `${action} action failed and requires retry/escalation.`,
  };
}

function simulateVerificationCheck(
  playbookId: string,
  verificationWindowSeconds: number,
  attempt: number
): boolean {
  const deterministicBump = (playbookId.length % 7) / 100;
  const retryBump = (attempt - 1) * 0.08;
  const verificationFactor = Math.min(0.97, 0.72 + deterministicBump + retryBump);
  if (verificationWindowSeconds >= 300) {
    return Math.random() <= Math.min(0.99, verificationFactor + 0.04);
  }
  return Math.random() <= verificationFactor;
}

function parsePlaybookActions(actionText: string): PlaybookAction[] {
  const parsed = actionText
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is PlaybookAction =>
      ["restart", "scale", "redeploy", "failover"].includes(item)
    );
  return parsed.length > 0 ? parsed : ["restart"];
}

function mapServerToInfrastructureResource(server: ServerRow) {
  const type = inferServiceType(server.name);
  return {
    id: server.id,
    name: server.name,
    type,
    region: server.region,
    health: server.status,
    owner: "Infra Platform",
    team: type === "RDS" ? "Database Reliability" : "SRE Team",
    cpuUtilization: server.cpu,
    memoryUtilization: server.memory,
    requestsPerMinute: deriveRequestsPerMinute(server.id),
    uptime: server.uptime,
    lastEvent: server.status === "Healthy" ? "No issues detected" : "Recovery action recommended",
  };
}

function inferServiceType(name: string): "EC2" | "ECS" | "Lambda" | "RDS" | "ALB" {
  const lower = name.toLowerCase();
  if (lower.includes("db")) return "RDS";
  if (lower.includes("gateway") || lower.includes("alb") || lower.includes("edge")) return "ALB";
  if (lower.includes("worker") || lower.includes("task") || lower.includes("service")) return "ECS";
  if (lower.includes("lambda") || lower.includes("function")) return "Lambda";
  return "EC2";
}

function deriveRequestsPerMinute(id: string): number {
  let sum = 0;
  for (let index = 0; index < id.length; index += 1) {
    sum += id.charCodeAt(index);
  }
  return 80 + (sum % 1400);
}

function mapAlertToIncident(alert: AlertRow) {
  const lifecycleStatus = resolveLifecycleStatus(alert);
  return {
    id: alert.id,
    title: alert.title,
    severity:
      alert.severity === "Warning"
        ? "Medium"
        : alert.severity === "Info"
        ? "Low"
        : "Critical",
    status: lifecycleStatus,
    source: alert.source,
    service: inferServiceType(alert.source),
    owner: alert.owner ?? "Platform SRE",
    team: alert.team ?? "Reliability",
    detectedAt: alert.created_at,
    recoveryAction:
      lifecycleStatus === "Resolved"
        ? "restart"
        : lifecycleStatus === "Escalated"
        ? null
        : "scale",
    timeline: buildIncidentTimelineWithStatus(alert, lifecycleStatus),
  };
}

function buildIncidentTimelineWithStatus(
  alert: AlertRow,
  status: AlertLifecycleStatus
) {
  const base = buildIncidentTimeline(alert);
  if (status === "Detected") return base;
  if (status === "Analyzing") {
    return base.map((item, index) => (index === 0 ? { ...item, state: "Analyzing" } : item));
  }
  if (status === "Escalated") {
    return [
      {
        id: `${alert.id}-ev-escalated`,
        at: new Date(new Date(alert.created_at).getTime() + 8 * 60 * 1000).toISOString(),
        title: "Escalated",
        detail: "Incident escalated to on-call engineering team.",
        state: "Escalated",
      },
      ...base,
    ];
  }
  if (status === "Resolved") {
    return base.map((item, index) =>
      index === 0
        ? {
            ...item,
            title: "Resolved",
            state: "Resolved",
            detail: "Verification checks passed and incident was resolved.",
          }
        : item
    );
  }
  return base;
}

function mapAlertToAuditRecord(alert: AlertRow, note?: AuditNoteRow) {
  return {
    id: `AUD-${alert.id}`,
    incidentId: alert.id,
    summary: `${alert.title} (${alert.source})`,
    verificationResult: computeAuditResult(alert.id),
    executedActions: ["restart", "scale"],
    humanNotes:
      note?.note ??
      "Auto-recovery run completed. Follow-up monitoring window set for 20 minutes.",
    updatedAt: note?.updated_at ?? alert.created_at,
    timeline: buildIncidentTimelineWithStatus(alert, resolveLifecycleStatus(alert)),
  };
}

function extractIncidentIdFromAuditId(auditId: string): string | null {
  if (auditId.startsWith("AUD-")) {
    return auditId.slice(4);
  }
  return auditId || null;
}

type IncidentExportFormat = "txt" | "json" | "csv";

function resolveIncidentExportFormat(rawValue?: string): IncidentExportFormat {
  if (rawValue === "json" || rawValue === "csv" || rawValue === "txt") {
    return rawValue;
  }
  return "txt";
}

function buildIncidentExportReportPayload(alert: AlertRow, note: string) {
  return {
    incidentId: alert.id,
    title: alert.title,
    source: alert.source,
    severity: alert.severity,
    status: resolveLifecycleStatus(alert),
    detectedAt: alert.created_at,
    owner: alert.owner ?? "Platform SRE",
    team: alert.team ?? "Reliability",
    notes: note || "N/A",
  };
}

function renderIncidentExportReport(
  payload: ReturnType<typeof buildIncidentExportReportPayload>,
  format: IncidentExportFormat
): {
  body: string;
  contentType: string;
  extension: IncidentExportFormat;
} {
  if (format === "json") {
    return {
      body: JSON.stringify(payload, null, 2),
      contentType: "application/json; charset=utf-8",
      extension: "json",
    };
  }

  if (format === "csv") {
    const headers = [
      "incidentId",
      "title",
      "source",
      "severity",
      "status",
      "detectedAt",
      "owner",
      "team",
      "notes",
    ];
    const values = [
      payload.incidentId,
      payload.title,
      payload.source,
      payload.severity,
      payload.status,
      payload.detectedAt,
      payload.owner,
      payload.team,
      payload.notes,
    ].map((value) => `"${String(value).replace(/"/g, '""')}"`);

    return {
      body: `${headers.join(",")}\n${values.join(",")}`,
      contentType: "text/csv; charset=utf-8",
      extension: "csv",
    };
  }

  return {
    body: [
      `Incident: ${payload.incidentId}`,
      `Title: ${payload.title}`,
      `Source: ${payload.source}`,
      `Severity: ${payload.severity}`,
      `Status: ${payload.status}`,
      `Detected At: ${payload.detectedAt}`,
      `Owner: ${payload.owner}`,
      `Team: ${payload.team}`,
      `Notes: ${payload.notes}`,
    ].join("\n"),
    contentType: "text/plain; charset=utf-8",
    extension: "txt",
  };
}

function buildOverviewRegions(servers: ServerRow[], alerts: AlertRow[]) {
  const regionMap = new Map<string, { total: number; degraded: number }>();
  for (const server of servers) {
    const current = regionMap.get(server.region) ?? { total: 0, degraded: 0 };
    current.total += 1;
    if (server.status !== "Healthy") {
      current.degraded += 1;
    }
    regionMap.set(server.region, current);
  }

  const regions = Array.from(regionMap.entries()).map(([region, stats]) => {
    const activeIncidents = alerts.filter(
      (alert) =>
        alert.status !== "Resolved" &&
        alert.source.toLowerCase().includes(region.split("-")[0] ?? "")
    ).length;
    const scoreBase = 98 - stats.degraded * 7;
    return {
      region,
      healthScore: clampNumber(scoreBase, 60, 99),
      activeIncidents,
      recoveryRunning: Math.min(1, stats.degraded),
    };
  });

  if (regions.length === 0) {
    return [
      { region: "us-east-1", healthScore: 95, activeIncidents: 0, recoveryRunning: 0 },
      { region: "eu-west-1", healthScore: 92, activeIncidents: 0, recoveryRunning: 0 },
      { region: "ap-south-1", healthScore: 90, activeIncidents: 0, recoveryRunning: 0 },
    ];
  }
  return regions;
}

function makeReadableToken(length: number): string {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";
  for (let index = 0; index < length; index += 1) {
    token += characters[Math.floor(Math.random() * characters.length)];
  }
  return token;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export default app;
