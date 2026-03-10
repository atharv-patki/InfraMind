import { normalizePlan, type SubscriptionPlan } from "@/react-app/lib/plans";

export type AuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  plan: SubscriptionPlan;
  createdAt: string;
  updatedAt: string;
};

export type RegisterResult = {
  user: AuthUser;
  message?: string;
  welcomeEmailStatus?: "queued" | "disabled" | "failed";
};

type AuthResponse = {
  user?: AuthUser;
  error?: string;
  message?: string;
  welcomeEmailStatus?: "queued" | "disabled" | "failed";
};

export async function loginWithPassword(payload: {
  email: string;
  password: string;
}): Promise<AuthUser> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await safeReadJson(response)) as AuthResponse | null;
  if (!response.ok || !data?.user) {
    throw new Error(data?.error ?? "Unable to sign in with these credentials.");
  }

  return normalizeAuthUser(data.user);
}

export async function registerWithPassword(payload: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  plan?: SubscriptionPlan;
}): Promise<RegisterResult> {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await safeReadJson(response)) as AuthResponse | null;
  if (!response.ok || !data?.user) {
    throw new Error(data?.error ?? "Unable to create account.");
  }

  return {
    user: normalizeAuthUser(data.user),
    message: data.message,
    welcomeEmailStatus: data.welcomeEmailStatus,
  };
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch("/api/auth/me", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  const data = (await safeReadJson(response)) as AuthResponse | null;
  if (!response.ok) {
    throw new Error(data?.error ?? "Unable to fetch current user.");
  }

  return data?.user ? normalizeAuthUser(data.user) : null;
}

export async function logoutUser(): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    const data = (await safeReadJson(response)) as AuthResponse | null;
    throw new Error(data?.error ?? "Unable to logout.");
  }
}

export function getSafeNextPath(nextPath: string | null, fallback = "/app/overview"): string {
  if (!nextPath) return fallback;
  if (!nextPath.startsWith("/")) return fallback;
  if (!nextPath.startsWith("/app")) return fallback;
  return nextPath;
}

async function safeReadJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function normalizeAuthUser(user: AuthUser): AuthUser {
  return {
    ...user,
    plan: normalizePlan(user.plan),
  };
}
