import { recordAbuseEvent } from "../repositories/abuse-event-repository";

type ThrottleEntry = {
  count: number;
  resetAt: number;
};

const throttleStore = new Map<string, ThrottleEntry>();

const DEFAULT_DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "10minutemail.com",
  "guerrillamail.com",
  "tempmail.com",
  "yopmail.com",
  "trashmail.com",
]);

export type AbuseDecision = {
  status: 400 | 403 | 429;
  error: string;
  code: string;
};

function parseCsvSet(value: string | undefined): Set<string> {
  return new Set(
    String(value ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export function getEmailDomain(email: string): string {
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex < 0 || atIndex === normalized.length - 1) return "";
  return normalized.slice(atIndex + 1);
}

function checkThrottle(input: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  const now = Date.now();
  const existing = throttleStore.get(input.key);

  if (!existing || existing.resetAt <= now) {
    throttleStore.set(input.key, {
      count: 1,
      resetAt: now + input.windowMs,
    });
    cleanupThrottleStore(now);
    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  existing.count += 1;
  throttleStore.set(input.key, existing);
  cleanupThrottleStore(now);

  if (existing.count > input.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

function cleanupThrottleStore(now: number): void {
  if (throttleStore.size < 5_000) return;
  for (const [key, value] of throttleStore.entries()) {
    if (value.resetAt <= now) {
      throttleStore.delete(key);
    }
  }
}

async function rejectWithAudit(
  env: Env,
  input: {
    scope: "signup" | "invite" | "mail";
    actorKey: string;
    email: string;
    ipAddress: string;
    reason: string;
    metadata: Record<string, unknown>;
    decision: AbuseDecision;
  }
): Promise<AbuseDecision> {
  try {
    await recordAbuseEvent(env, {
      scope: input.scope,
      actorKey: input.actorKey,
      email: input.email,
      ipAddress: input.ipAddress,
      reason: input.reason,
      metadata: input.metadata,
    });
  } catch {
    // Do not fail the request if abuse logging cannot be persisted.
  }

  return input.decision;
}

export async function enforceSignupAbusePolicy(input: {
  env: Env;
  email: string;
  ipAddress: string;
}): Promise<AbuseDecision | null> {
  const email = input.email.trim().toLowerCase();
  const domain = getEmailDomain(email);
  if (!domain) {
    return {
      status: 400,
      error: "Valid email is required.",
      code: "INVALID_EMAIL",
    };
  }

  const blockedDomains = parseCsvSet(input.env.BLOCKED_EMAIL_DOMAINS);
  const allBlockedDomains = new Set([...DEFAULT_DISPOSABLE_DOMAINS, ...blockedDomains]);

  if (allBlockedDomains.has(domain)) {
    return rejectWithAudit(input.env, {
      scope: "signup",
      actorKey: `${input.ipAddress}:${domain}`,
      email,
      ipAddress: input.ipAddress,
      reason: "blocked_email_domain",
      metadata: { domain },
      decision: {
        status: 403,
        error: "Registrations from this email domain are not allowed.",
        code: "DOMAIN_BLOCKED",
      },
    });
  }

  const signupPerIpLimit = parseNumber(input.env.SIGNUP_MAX_PER_IP_HOUR, 12);
  const signupPerDomainLimit = parseNumber(input.env.SIGNUP_MAX_PER_DOMAIN_DAY, 40);

  const perIp = checkThrottle({
    key: `signup:ip:${input.ipAddress}`,
    limit: signupPerIpLimit,
    windowMs: 60 * 60 * 1000,
  });

  if (!perIp.allowed) {
    return rejectWithAudit(input.env, {
      scope: "signup",
      actorKey: `ip:${input.ipAddress}`,
      email,
      ipAddress: input.ipAddress,
      reason: "signup_rate_limited_ip",
      metadata: {
        retryAfterSeconds: perIp.retryAfterSeconds,
        signupPerIpLimit,
      },
      decision: {
        status: 429,
        error: "Too many sign-up attempts from this IP. Please try again shortly.",
        code: "SIGNUP_RATE_LIMITED_IP",
      },
    });
  }

  const perDomain = checkThrottle({
    key: `signup:domain:${domain}`,
    limit: signupPerDomainLimit,
    windowMs: 24 * 60 * 60 * 1000,
  });

  if (!perDomain.allowed) {
    return rejectWithAudit(input.env, {
      scope: "signup",
      actorKey: `domain:${domain}`,
      email,
      ipAddress: input.ipAddress,
      reason: "signup_rate_limited_domain",
      metadata: {
        retryAfterSeconds: perDomain.retryAfterSeconds,
        signupPerDomainLimit,
      },
      decision: {
        status: 429,
        error: "Too many registrations for this email domain today.",
        code: "SIGNUP_RATE_LIMITED_DOMAIN",
      },
    });
  }

  return null;
}

export async function enforceInviteAbusePolicy(input: {
  env: Env;
  email: string;
  ipAddress: string;
  workspaceId: string;
}): Promise<AbuseDecision | null> {
  const email = input.email.trim().toLowerCase();
  const domain = getEmailDomain(email);
  if (!domain) {
    return {
      status: 400,
      error: "Valid invite email is required.",
      code: "INVALID_EMAIL",
    };
  }

  const blockedDomains = parseCsvSet(input.env.BLOCKED_EMAIL_DOMAINS);
  const allowedInviteDomains = parseCsvSet(input.env.INVITE_ALLOWED_DOMAINS);
  const allBlockedDomains = new Set([...DEFAULT_DISPOSABLE_DOMAINS, ...blockedDomains]);

  if (allBlockedDomains.has(domain)) {
    return rejectWithAudit(input.env, {
      scope: "invite",
      actorKey: `${input.workspaceId}:${domain}`,
      email,
      ipAddress: input.ipAddress,
      reason: "blocked_invite_domain",
      metadata: { domain },
      decision: {
        status: 403,
        error: "Invites to this email domain are blocked by policy.",
        code: "INVITE_DOMAIN_BLOCKED",
      },
    });
  }

  if (allowedInviteDomains.size > 0 && !allowedInviteDomains.has(domain)) {
    return rejectWithAudit(input.env, {
      scope: "invite",
      actorKey: `${input.workspaceId}:${domain}`,
      email,
      ipAddress: input.ipAddress,
      reason: "invite_domain_not_allowlisted",
      metadata: {
        domain,
        allowedDomains: Array.from(allowedInviteDomains),
      },
      decision: {
        status: 403,
        error: "Invites to this domain are not allowed by workspace policy.",
        code: "INVITE_DOMAIN_NOT_ALLOWED",
      },
    });
  }

  const invitePerIpLimit = parseNumber(input.env.INVITE_MAX_PER_IP_HOUR, 30);
  const invitePerEmailLimit = parseNumber(input.env.INVITE_MAX_PER_EMAIL_DAY, 8);
  const invitePerWorkspaceLimit = parseNumber(input.env.INVITE_MAX_PER_WORKSPACE_DAY, 200);

  const byIp = checkThrottle({
    key: `invite:ip:${input.ipAddress}`,
    limit: invitePerIpLimit,
    windowMs: 60 * 60 * 1000,
  });
  if (!byIp.allowed) {
    return rejectWithAudit(input.env, {
      scope: "invite",
      actorKey: `ip:${input.ipAddress}`,
      email,
      ipAddress: input.ipAddress,
      reason: "invite_rate_limited_ip",
      metadata: {
        retryAfterSeconds: byIp.retryAfterSeconds,
        invitePerIpLimit,
      },
      decision: {
        status: 429,
        error: "Too many invites from this IP. Please try again later.",
        code: "INVITE_RATE_LIMITED_IP",
      },
    });
  }

  const byEmail = checkThrottle({
    key: `invite:email:${email}`,
    limit: invitePerEmailLimit,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!byEmail.allowed) {
    return rejectWithAudit(input.env, {
      scope: "invite",
      actorKey: `email:${email}`,
      email,
      ipAddress: input.ipAddress,
      reason: "invite_rate_limited_email",
      metadata: {
        retryAfterSeconds: byEmail.retryAfterSeconds,
        invitePerEmailLimit,
      },
      decision: {
        status: 429,
        error: "This email has reached the invite limit for today.",
        code: "INVITE_RATE_LIMITED_EMAIL",
      },
    });
  }

  const byWorkspace = checkThrottle({
    key: `invite:workspace:${input.workspaceId}`,
    limit: invitePerWorkspaceLimit,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!byWorkspace.allowed) {
    return rejectWithAudit(input.env, {
      scope: "invite",
      actorKey: `workspace:${input.workspaceId}`,
      email,
      ipAddress: input.ipAddress,
      reason: "invite_rate_limited_workspace",
      metadata: {
        retryAfterSeconds: byWorkspace.retryAfterSeconds,
        invitePerWorkspaceLimit,
      },
      decision: {
        status: 429,
        error: "Workspace invite quota exceeded for the day.",
        code: "INVITE_RATE_LIMITED_WORKSPACE",
      },
    });
  }

  return null;
}
