import type { SubscriptionPlan } from "../lib/plan";

export type StripeWebhookProcessResult = {
  ok: boolean;
  status: number;
  error?: string;
  eventType?: string;
  userId?: string;
  plan?: SubscriptionPlan;
  statusValue?: "trialing" | "active" | "past_due" | "canceled";
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  renewsAt?: string | null;
};

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqualHex(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function signHmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toHex(new Uint8Array(signature));
}

function parseStripeSignatureHeader(signatureHeader: string): {
  timestamp: string | null;
  signaturesV1: string[];
} {
  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2) ?? null;
  const signaturesV1 = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3))
    .filter(Boolean);

  return {
    timestamp,
    signaturesV1,
  };
}

export async function verifyStripeWebhookSignature(input: {
  payload: string;
  signatureHeader: string;
  secret: string;
  toleranceSeconds?: number;
}): Promise<boolean> {
  const parsed = parseStripeSignatureHeader(input.signatureHeader);
  if (!parsed.timestamp || parsed.signaturesV1.length === 0) {
    return false;
  }

  const timestampNumber = Number(parsed.timestamp);
  if (!Number.isFinite(timestampNumber)) {
    return false;
  }

  const toleranceSeconds = input.toleranceSeconds ?? 300;
  const ageSeconds = Math.abs(Date.now() / 1000 - timestampNumber);
  if (ageSeconds > toleranceSeconds) {
    return false;
  }

  const payloadToSign = `${parsed.timestamp}.${input.payload}`;
  const expectedSignature = await signHmacSha256Hex(input.secret, payloadToSign);

  return parsed.signaturesV1.some((signature) => safeEqualHex(signature, expectedSignature));
}

function mapStripeStatus(value: string): "trialing" | "active" | "past_due" | "canceled" {
  if (value === "trialing") return "trialing";
  if (value === "active") return "active";
  if (value === "past_due" || value === "unpaid" || value === "incomplete") return "past_due";
  return "canceled";
}

function mapStripePlan(rawValue: string | undefined, normalizePlan: (value: string) => SubscriptionPlan) {
  if (!rawValue) return normalizePlan("starter");
  return normalizePlan(rawValue);
}

function unixSecondsToIso(value: unknown): string | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return new Date(numeric * 1000).toISOString();
}

export async function processStripeWebhook(input: {
  payloadText: string;
  signatureHeader: string | null;
  webhookSecret: string | undefined;
  allowInsecureBypass: boolean;
  normalizePlan: (value: string) => SubscriptionPlan;
}): Promise<StripeWebhookProcessResult> {
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(input.payloadText) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      status: 400,
      error: "Invalid webhook JSON payload.",
    };
  }

  if (!input.allowInsecureBypass) {
    if (!input.webhookSecret) {
      return {
        ok: false,
        status: 500,
        error: "Stripe webhook secret is not configured.",
      };
    }
    if (!input.signatureHeader) {
      return {
        ok: false,
        status: 400,
        error: "Missing Stripe-Signature header.",
      };
    }

    const verified = await verifyStripeWebhookSignature({
      payload: input.payloadText,
      signatureHeader: input.signatureHeader,
      secret: input.webhookSecret,
    });
    if (!verified) {
      return {
        ok: false,
        status: 400,
        error: "Stripe signature verification failed.",
      };
    }
  }

  const eventType = String(event.type ?? "");
  if (!eventType.startsWith("customer.subscription.")) {
    return {
      ok: true,
      status: 200,
      eventType,
    };
  }

  const dataObject = ((event.data as Record<string, unknown> | undefined)?.object ?? {}) as Record<string, unknown>;
  const metadata = (dataObject.metadata as Record<string, unknown> | undefined) ?? {};

  const userId =
    typeof metadata.userId === "string"
      ? metadata.userId
      : typeof metadata.user_id === "string"
      ? metadata.user_id
      : "";

  if (!userId) {
    return {
      ok: false,
      status: 400,
      error: "Stripe subscription metadata.userId is required.",
      eventType,
    };
  }

  const planHint =
    typeof metadata.plan === "string"
      ? metadata.plan
      : typeof dataObject.plan === "string"
      ? dataObject.plan
      : undefined;

  const plan = mapStripePlan(planHint, input.normalizePlan);
  const statusValue = mapStripeStatus(String(dataObject.status ?? ""));
  const providerCustomerId = dataObject.customer ? String(dataObject.customer) : null;
  const providerSubscriptionId = dataObject.id ? String(dataObject.id) : null;
  const renewsAt = unixSecondsToIso(dataObject.current_period_end);

  return {
    ok: true,
    status: 200,
    eventType,
    userId,
    plan,
    statusValue,
    providerCustomerId,
    providerSubscriptionId,
    renewsAt,
  };
}
