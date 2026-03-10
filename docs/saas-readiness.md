# SaaS Readiness Checklist

## Billing and Plans
- [x] Local billing adapter endpoints (`GET/POST /api/billing/subscription`) for backend contract stability.
- [x] Plan mapping in backend and frontend (starter/pro/enterprise).
- [x] Stripe webhook sync endpoint implemented (`POST /api/billing/webhooks/stripe`) with signature verification support.
- [ ] Production payment provider account configuration and webhook secret rollout.

## Plan Enforcement
- [x] Resource monitoring caps by plan.
- [x] Alerts/month caps by plan.
- [ ] User/workspace caps by plan.

## Usage Metering
- [x] Track monitored resources and key monthly usage counters.
- [x] Track alert/export/notification-test usage counters.
- [x] Expose usage + remaining quotas via `GET /api/usage/me`.
- [x] Generate and persist quota warning/critical events (`quota_alert_events`) and expose `GET /api/usage/alerts`.
- [x] Quota alerts trigger outbound notification dispatch path through channel provider adapters.
- [ ] Configure production channel credentials and targets.

## Tenant Isolation
- [x] Workspace role checks enforced for dashboard read/write API modules.
- [x] Tenant validation endpoint added (`GET /api/tenancy/validation`) for duplicate/orphan integrity checks.
- [x] Adversarial tenant-isolation unit tests added for duplicate/orphan/fanout patterns.
- [ ] Cross-tenant API attack test suite across authenticated multi-tenant fixtures.
- [ ] Incident/audit export strict workspace partition hardening for production audits.

## Legal and Compliance
- [x] Draft Privacy policy added.
- [x] Draft Terms of service added.
- [x] Legal sign-off checklist artifact added (`docs/legal/legal-signoff-checklist.md`).
- [x] Draft DPA added.
- [ ] Legal approval/signature for Privacy/Terms/DPA.
