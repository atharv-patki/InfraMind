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
  createdAt: string;
  updatedAt: string;
};

type UserCredentialsRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
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
  createdAt: string;
  updatedAt: string;
};

type WelcomeEmailStatus = "queued" | "disabled";

let schemaInitialized = false;

app.post("/api/auth/register", async (c) => {
  try {
    await ensureSchema(c.env);

    const body = await readBody(c);
    const firstName = stringField(body, "firstName").trim();
    const lastName = stringField(body, "lastName").trim();
    const email = normalizeEmail(stringField(body, "email"));
    const password = stringField(body, "password");

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
          id, first_name, last_name, email, password_hash, password_salt, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
      `
    )
      .bind(userId, firstName, lastName, email, passwordHash, salt, now, now)
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

  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)"
  ).run();

  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)"
  ).run();

  schemaInitialized = true;
}

function toAuthUser(row: Pick<
  UserCredentialsRow,
  "id" | "first_name" | "last_name" | "email" | "created_at" | "updated_at"
>): AuthUser {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
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

  return row;
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

export default app;
