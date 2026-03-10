# Abuse and Mail Protection Policy

## Implemented Controls
- Signup anti-abuse checks:
  - IP hourly throttle (`SIGNUP_MAX_PER_IP_HOUR`).
  - Domain daily throttle (`SIGNUP_MAX_PER_DOMAIN_DAY`).
  - Disposable/blocked domain rejection (`BLOCKED_EMAIL_DOMAINS` + built-in disposable list).
- Invitation anti-abuse checks:
  - IP hourly throttle (`INVITE_MAX_PER_IP_HOUR`).
  - Invitee daily throttle (`INVITE_MAX_PER_EMAIL_DAY`).
  - Workspace daily throttle (`INVITE_MAX_PER_WORKSPACE_DAY`).
  - Optional allowlist policy (`INVITE_ALLOWED_DOMAINS`).
- Abuse event audit trail persisted to `abuse_events`.

## Operational Notes
- Controls are designed for local/staging baseline and should be backed by edge/WAF controls in production.
- Thresholds are configurable via worker environment variables.
- Rejection responses include stable error codes for frontend messaging and alerting.
