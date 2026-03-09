/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database;
  RESEND_API_KEY?: string;
  WELCOME_EMAIL_FROM?: string;
  WELCOME_EMAIL_REPLY_TO?: string;
  APP_BASE_URL?: string;
}
