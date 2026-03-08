import { Hono, type Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";

const app = new Hono<{ Bindings: Env }>();

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

type SubscriptionPlan = "starter" | "pro" | "enterprise";

type UserCredentialsRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  plan: SubscriptionPlan;
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
  createdAt: string;
  updatedAt: string;
};

type WelcomeEmailStatus = "queued" | "disabled";

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
  created_at: string;
};

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

let schemaInitialized = false;

app.post("/api/auth/register", async (c) => {
  try {
    await ensureSchema(c.env);

    const body = await readBody(c);
    const firstName = stringField(body, "firstName").trim();
    const lastName = stringField(body, "lastName").trim();
    const email = normalizeEmail(stringField(body, "email"));
    const password = stringField(body, "password");
    const plan = normalizePlan(stringField(body, "plan"));

    if (!firstName || !lastName || !email || !password) {
      return c.json({ error: "All fields are required." }, 400);
    }
    if (!isValidEmail(email)) {
      return c.json({ error: "Please provide a valid email address." }, 400);
    }
    if (password.length < 8) {
      return c.json({ error: "Password must be at least 8 characters." }, 400);
    }

    const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?1")
      .bind(email)
      .first<{ id: string }>();
    if (existing) {
      return c.json({ error: "An account with this email already exists." }, 409);
    }

    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    const salt = generateRandomToken(16);
    const passwordHash = await hashPassword(password, salt);

    await c.env.DB.prepare(
      `
        INSERT INTO users (
          id, first_name, last_name, email, plan, password_hash, password_salt, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
      `
    )
      .bind(userId, firstName, lastName, email, plan, passwordHash, salt, now, now)
      .run();

    const welcomeEmailStatus = getWelcomeEmailStatus(c.env);
    if (welcomeEmailStatus === "queued") {
      c.executionCtx.waitUntil(
        sendWelcomeEmail({
          env: c.env,
          firstName,
          lastName,
          recipientEmail: email,
          requestUrl: c.req.url,
        }).catch((error) => {
          console.error("Welcome email failed:", error);
        })
      );
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
        message:
          welcomeEmailStatus === "queued"
            ? "Account created successfully. Please sign in. Welcome email queued."
            : "Account created successfully. Please sign in.",
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
    const email = normalizeEmail(stringField(body, "email"));
    const password = stringField(body, "password");

    if (!email || !password) {
      return c.json({ error: "Email and password are required." }, 400);
    }

    const user = await c.env.DB.prepare(
      `
        SELECT
          id,
          first_name,
          last_name,
          email,
          plan,
          password_hash,
          password_salt,
          created_at,
          updated_at
        FROM users
        WHERE email = ?1
        LIMIT 1
      `
    )
      .bind(email)
      .first<UserCredentialsRow>();

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

app.get("/api/servers", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;

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

  return c.json({
    servers: (servers.results ?? []).map((server: ServerRow) => ({
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
    })),
  });
});

app.post("/api/servers", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;

  await ensureSchema(c.env);

  const body = await readBody(c);
  const name = stringField(body, "name").trim();
  const ip = stringField(body, "ip").trim();
  const region = stringField(body, "region").trim() || "us-east-1";

  if (!name || !ip) {
    return c.json({ error: "Server name and IP are required." }, 400);
  }

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
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Server id is required." }, 400);

  await c.env.DB.prepare("DELETE FROM servers WHERE id = ?1").bind(id).run();
  return c.json({ success: true });
});

app.get("/api/alerts", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;

  await ensureSchema(c.env);
  const alerts = await c.env.DB.prepare(
    `
      SELECT id, title, source, severity, status, created_at
      FROM alerts
      ORDER BY created_at DESC
    `
  ).all<AlertRow>();

  return c.json({
    alerts: (alerts.results ?? []).map((alert: AlertRow) => ({
      id: alert.id,
      title: alert.title,
      source: alert.source,
      severity: alert.severity,
      status: alert.status,
      createdAt: alert.created_at,
    })),
  });
});

app.post("/api/alerts", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;

  await ensureSchema(c.env);

  const body = await readBody(c);
  const title = stringField(body, "title").trim();
  const source = stringField(body, "source").trim();
  const severity = stringField(body, "severity").trim() as "Critical" | "Warning" | "Info";

  if (!title || !source) {
    return c.json({ error: "Alert title and source are required." }, 400);
  }
  if (!["Critical", "Warning", "Info"].includes(severity)) {
    return c.json({ error: "Severity must be Critical, Warning, or Info." }, 400);
  }

  const id = `ALT-${randomInt(1000, 9999)}`;
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `
      INSERT INTO alerts (id, title, source, severity, status, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)
    `
  )
    .bind(id, title, source, severity, "Active", now)
    .run();

  return c.json(
    {
      alert: {
        id,
        title,
        source,
        severity,
        status: "Active",
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
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Alert id is required." }, 400);

  const body = await readBody(c);
  const statusInput = stringField(body, "status").trim();
  const status =
    statusInput === "Resolved" || statusInput === "Active" ? statusInput : null;
  if (!status) {
    return c.json({ error: "Status must be Active or Resolved." }, 400);
  }

  await c.env.DB.prepare("UPDATE alerts SET status = ?1 WHERE id = ?2")
    .bind(status, id)
    .run();

  return c.json({ success: true });
});

app.delete("/api/alerts/:id", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;

  await ensureSchema(c.env);
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Alert id is required." }, 400);

  await c.env.DB.prepare("DELETE FROM alerts WHERE id = ?1").bind(id).run();
  return c.json({ success: true });
});

app.get("/api/automation/rules", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;

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

  return c.json({
    rules: (rules.results ?? []).map((rule: AutomationRuleRow) => ({
      id: rule.id,
      name: rule.name,
      trigger: rule.trigger_condition,
      action: rule.action,
      cooldownMinutes: rule.cooldown_minutes,
      enabled: Boolean(rule.enabled),
      lastRun: rule.last_run,
      successRate: rule.success_rate,
      createdAt: rule.created_at,
    })),
  });
});

app.post("/api/automation/rules", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;

  await ensureSchema(c.env);
  const body = await readBody(c);

  const name = stringField(body, "name").trim();
  const trigger = stringField(body, "trigger").trim();
  const action = stringField(body, "action").trim();
  const cooldownMinutes = numberField(body, "cooldownMinutes", 15);

  if (!name || !trigger || !action) {
    return c.json({ error: "Name, trigger, and action are required." }, 400);
  }
  if (cooldownMinutes <= 0) {
    return c.json({ error: "Cooldown must be greater than 0." }, 400);
  }

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

  await ensureSchema(c.env);
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Rule id is required." }, 400);

  const body = await readBody(c);
  const enabled = booleanField(body, "enabled", true);
  const runNow = booleanField(body, "runNow", false);

  if (runNow) {
    await c.env.DB.prepare(
      `
        UPDATE automation_rules
        SET
          last_run = ?1,
          success_rate = MIN(99, MAX(70, success_rate + ?2))
        WHERE id = ?3
      `
    )
      .bind("Just now", randomInt(-2, 2), id)
      .run();
  } else {
    await c.env.DB.prepare("UPDATE automation_rules SET enabled = ?1 WHERE id = ?2")
      .bind(enabled ? 1 : 0, id)
      .run();
  }

  return c.json({ success: true });
});

app.delete("/api/automation/rules/:id", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;

  await ensureSchema(c.env);
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Rule id is required." }, 400);
  await c.env.DB.prepare("DELETE FROM automation_rules WHERE id = ?1").bind(id).run();
  return c.json({ success: true });
});

app.get("/api/ai/anomalies", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;

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

  return c.json({
    points: [62, 64, 63, 66, 68, 69, 71, 72, 75, 78, 81, 84, 86, 89, 92],
  });
});

app.get("/api/ai/recommendations", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;

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

  await ensureSchema(c.env);
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Recommendation id is required." }, 400);
  const body = await readBody(c);
  const done = booleanField(body, "done", false);

  await c.env.DB.prepare("UPDATE ai_recommendations SET done = ?1 WHERE id = ?2")
    .bind(done ? 1 : 0, id)
    .run();

  return c.json({ success: true });
});

app.get("/api/metrics/:metric", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;

  const metric = c.req.param("metric");
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
  return c.json(buildLatestMetricsSample());
});

app.get("/api/stream/metrics", async (c) => {
  const authUser = await requireAuthenticatedUser(c);
  if (authUser instanceof Response) return authUser;

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

  const firstName = stringField(body, "firstName").trim() || authUser.firstName;
  const lastName = stringField(body, "lastName").trim() || authUser.lastName;
  const emailInput = stringField(body, "email").trim();
  const email = emailInput ? normalizeEmail(emailInput) : authUser.email;
  const company = stringField(body, "company").trim() || "InfraMind Cloud Team";
  const role = stringField(body, "role").trim() || "Platform Engineer";
  const timezone = stringField(body, "timezone").trim() || "Asia/Kolkata";
  const themeInput = stringField(body, "theme").trim();
  const theme =
    themeInput === "light" || themeInput === "dark" || themeInput === "system"
      ? themeInput
      : "system";
  const emailAlerts = booleanField(body, "emailAlerts", true);
  const slackAlerts = booleanField(body, "slackAlerts", true);
  const weeklyReport = booleanField(body, "weeklyReport", false);

  if (!isValidEmail(email)) {
    return c.json({ error: "Please provide a valid email address." }, 400);
  }

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
  const currentPassword = stringField(body, "currentPassword");
  const newPassword = stringField(body, "newPassword");

  if (!currentPassword || !newPassword) {
    return c.json({ error: "Current password and new password are required." }, 400);
  }
  if (newPassword.length < 8) {
    return c.json({ error: "New password must be at least 8 characters." }, 400);
  }

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
  const name = stringField(body, "name").trim();
  if (!name) {
    return c.json({ error: "API key label is required." }, 400);
  }

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
    "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"
  ).run();

  await ensureUsersPlanColumn(env);

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
    "CREATE TABLE IF NOT EXISTS alerts (id TEXT PRIMARY KEY, title TEXT NOT NULL, source TEXT NOT NULL, severity TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)"
  ).run();
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS automation_rules (id TEXT PRIMARY KEY, name TEXT NOT NULL, trigger_condition TEXT NOT NULL, action_text TEXT NOT NULL, cooldown_minutes INTEGER NOT NULL, enabled INTEGER NOT NULL, last_run TEXT NOT NULL, success_rate INTEGER NOT NULL, created_at TEXT NOT NULL)"
  ).run();
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
    "CREATE INDEX IF NOT EXISTS idx_servers_created_at ON servers(created_at)"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at)"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_rules_created_at ON automation_rules(created_at)"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id)"
  ).run();

  await seedMonitoringData(env);

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

async function ensureUsersPlanColumn(env: Env): Promise<void> {
  const result = await env.DB.prepare("PRAGMA table_info(users)").all<{
    name: string;
  }>();
  const columns = result.results ?? [];
  const hasPlanColumn = columns.some((column) => column.name === "plan");
  if (hasPlanColumn) return;

  await env.DB.prepare(
    "ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'pro'"
  ).run();
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

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function stringField(
  body: Record<string, unknown> | null,
  key: string
): string {
  const value = body?.[key];
  return typeof value === "string" ? value : "";
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
  return {
    timestamp: new Date().toISOString(),
    cpu: randomInt(20, 95),
    memory: randomInt(28, 98),
    disk: randomInt(18, 90),
    network: randomInt(20, 190),
  };
}

function numberField(
  body: Record<string, unknown> | null,
  key: string,
  fallback: number
): number {
  const value = body?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function booleanField(
  body: Record<string, unknown> | null,
  key: string,
  fallback: boolean
): boolean {
  const value = body?.[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return fallback;
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
