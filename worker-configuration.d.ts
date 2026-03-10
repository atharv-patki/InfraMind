/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database;
  RESEND_API_KEY?: string;
  WELCOME_EMAIL_FROM?: string;
  WELCOME_EMAIL_REPLY_TO?: string;
  APP_BASE_URL?: string;
  BLOCKED_EMAIL_DOMAINS?: string;
  INVITE_ALLOWED_DOMAINS?: string;
  SIGNUP_MAX_PER_IP_HOUR?: string;
  SIGNUP_MAX_PER_DOMAIN_DAY?: string;
  INVITE_MAX_PER_IP_HOUR?: string;
  INVITE_MAX_PER_EMAIL_DAY?: string;
  INVITE_MAX_PER_WORKSPACE_DAY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  BILLING_WEBHOOK_ALLOW_INSECURE?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM_NUMBER?: string;
  QUOTA_ALERT_SMS_TARGET?: string;
  QUOTA_ALERT_SLACK_WEBHOOK?: string;
  QUOTA_ALERT_TEAMS_WEBHOOK?: string;
}
