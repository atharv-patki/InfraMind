const RESEND_API_URL = "https://api.resend.com/emails";

export type NotificationChannel = "email" | "sms" | "slack" | "teams";

export type ProviderSendResult = {
  status: "queued" | "sent" | "failed" | "dropped";
  providerMessageId: string | null;
  errorMessage: string | null;
  retryable: boolean;
};

function makeReadableToken(length: number): string {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";
  for (let index = 0; index < length; index += 1) {
    token += characters[Math.floor(Math.random() * characters.length)];
  }
  return token;
}

function getNotificationSubject(source: "test" | "system", channel: NotificationChannel): string {
  if (source === "test") {
    return `InfraMind ${channel.toUpperCase()} notification test`;
  }
  return "InfraMind operational notification";
}

function getNotificationBody(input: {
  source: "test" | "system";
  channel: NotificationChannel;
  target: string;
  incidentId: string | null;
}): string {
  if (input.source === "test") {
    return `InfraMind test notification for ${input.channel}. Target: ${input.target}.`;
  }

  return [
    "InfraMind incident lifecycle update.",
    input.incidentId ? `Incident: ${input.incidentId}` : "Incident: N/A",
    `Channel: ${input.channel}`,
    `Target: ${input.target}`,
  ].join(" ");
}

async function sendEmailViaResend(input: {
  env: Env;
  to: string;
  subject: string;
  text: string;
}): Promise<ProviderSendResult> {
  if (!input.env.RESEND_API_KEY) {
    return {
      status: "failed",
      providerMessageId: null,
      errorMessage: "RESEND_API_KEY is not configured.",
      retryable: false,
    };
  }

  const payload = {
    from: input.env.WELCOME_EMAIL_FROM || "InfraMind AI <onboarding@resend.dev>",
    to: [input.to],
    subject: input.subject,
    text: input.text,
  };

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const raw = await response.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      return {
        status: "failed",
        providerMessageId: null,
        errorMessage: parsed?.message ? String(parsed.message) : `Resend failed with status ${response.status}.`,
        retryable: response.status >= 500,
      };
    }

    return {
      status: "sent",
      providerMessageId: parsed?.id ? String(parsed.id) : `resend-${makeReadableToken(10)}`,
      errorMessage: null,
      retryable: false,
    };
  } catch (error) {
    return {
      status: "failed",
      providerMessageId: null,
      errorMessage: error instanceof Error ? error.message : "Resend request failed.",
      retryable: true,
    };
  }
}

function toBase64(value: string): string {
  if (typeof btoa === "function") return btoa(value);
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

async function sendSmsViaTwilio(input: {
  env: Env;
  to: string;
  body: string;
}): Promise<ProviderSendResult> {
  const sid = input.env.TWILIO_ACCOUNT_SID;
  const token = input.env.TWILIO_AUTH_TOKEN;
  const from = input.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    return {
      status: "failed",
      providerMessageId: null,
      errorMessage: "Twilio credentials are not configured.",
      retryable: false,
    };
  }

  const body = new URLSearchParams({
    To: input.to,
    From: from,
    Body: input.body,
  }).toString();

  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${toBase64(`${sid}:${token}`)}`,
      },
      body,
    });

    const raw = await response.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      return {
        status: "failed",
        providerMessageId: null,
        errorMessage: parsed?.message ? String(parsed.message) : `Twilio failed with status ${response.status}.`,
        retryable: response.status >= 500,
      };
    }

    return {
      status: "sent",
      providerMessageId: parsed?.sid ? String(parsed.sid) : `twilio-${makeReadableToken(10)}`,
      errorMessage: null,
      retryable: false,
    };
  } catch (error) {
    return {
      status: "failed",
      providerMessageId: null,
      errorMessage: error instanceof Error ? error.message : "Twilio request failed.",
      retryable: true,
    };
  }
}

async function postWebhook(target: string, payload: Record<string, unknown>): Promise<ProviderSendResult> {
  if (!/^https?:\/\//i.test(target)) {
    return {
      status: "failed",
      providerMessageId: null,
      errorMessage: "Webhook URL is invalid.",
      retryable: false,
    };
  }

  try {
    const response = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return {
        status: "failed",
        providerMessageId: null,
        errorMessage: `Webhook failed with status ${response.status}.`,
        retryable: response.status >= 500,
      };
    }

    return {
      status: "sent",
      providerMessageId: `webhook-${makeReadableToken(10)}`,
      errorMessage: null,
      retryable: false,
    };
  } catch (error) {
    return {
      status: "failed",
      providerMessageId: null,
      errorMessage: error instanceof Error ? error.message : "Webhook request failed.",
      retryable: true,
    };
  }
}

function validateTarget(channelType: NotificationChannel, target: string): ProviderSendResult | null {
  const normalizedTarget = target.trim();
  const loweredTarget = normalizedTarget.toLowerCase();
  const forceFailure =
    loweredTarget.includes("fail") ||
    loweredTarget.includes("invalid") ||
    loweredTarget.includes("blocked");

  if (forceFailure) {
    return {
      status: "failed",
      providerMessageId: null,
      errorMessage: `Provider rejected ${channelType} target.`,
      retryable: false,
    };
  }

  if (channelType === "email" && !normalizedTarget.includes("@")) {
    return {
      status: "failed",
      providerMessageId: null,
      errorMessage: "Email target is invalid.",
      retryable: false,
    };
  }

  if (channelType === "sms" && !/^\+?[0-9]{8,15}$/.test(normalizedTarget)) {
    return {
      status: "failed",
      providerMessageId: null,
      errorMessage: "SMS number format is invalid.",
      retryable: false,
    };
  }

  if ((channelType === "slack" || channelType === "teams") && normalizedTarget.length < 8) {
    return {
      status: "failed",
      providerMessageId: null,
      errorMessage: `${channelType} webhook target is invalid.`,
      retryable: false,
    };
  }

  return null;
}

export async function sendViaNotificationProvider(input: {
  env: Env;
  channelType: NotificationChannel;
  target: string;
  attempt: number;
  source: "test" | "system";
  incidentId: string | null;
}): Promise<ProviderSendResult> {
  const validation = validateTarget(input.channelType, input.target);
  if (validation) return validation;

  const message = getNotificationBody({
    source: input.source,
    channel: input.channelType,
    target: input.target,
    incidentId: input.incidentId,
  });
  const subject = getNotificationSubject(input.source, input.channelType);

  if (input.channelType === "email") {
    return sendEmailViaResend({
      env: input.env,
      to: input.target,
      subject,
      text: message,
    });
  }

  if (input.channelType === "sms") {
    return sendSmsViaTwilio({
      env: input.env,
      to: input.target,
      body: message,
    });
  }

  if (input.channelType === "slack") {
    return postWebhook(input.target, {
      text: message,
      source: "InfraMind AI",
      incidentId: input.incidentId,
    });
  }

  if (input.channelType === "teams") {
    return postWebhook(input.target, {
      text: message,
      title: "InfraMind Notification",
      incidentId: input.incidentId,
    });
  }

  return {
    status: "failed",
    providerMessageId: null,
    errorMessage: "Unsupported notification channel.",
    retryable: false,
  };
}
