
# InfraMind AI

AI-powered cloud infrastructure monitoring platform (frontend + worker API).

## Current Status
- Detailed status tracker: `docs/project-completion-status.md`
- AWS platform execution checklist: `docs/aws-platform-worklist.md`
- Runbooks:
  - `docs/runbooks/incident-response.md`
  - `docs/runbooks/auto-recovery.md`
  - `docs/runbooks/backend-deploy-rollback.md`
- Ops and release docs:
  - `docs/operations/oncall-escalation-matrix.md`
  - `docs/operations/support-communication-templates.md`
  - `docs/devops/release-strategy.md`
  - `docs/security/security-hardening-checklist.md`
  - `docs/testing/reliability-test-plan.md`
  - `docs/saas-readiness.md`
- Existing phase docs:
  - `docs/01-product-freeze.md`
  - `docs/02-architecture-decisions.md`
  - `docs/03-backend-foundation.md`
  - `docs/11-api-surface-completion.md`
  - `docs/12-frontend-final-integration.md`
  - `docs/18-launch-checklist.md`

## Local Development
```bash
npm run dev
```

## Validation
```bash
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run build
```

## Local DB Bootstrap
```bash
npm run db:migrate:local
npm run db:seed:local
```

## Backend Plan Usage API
- `GET /api/usage/me`
  - Returns current plan limits, current usage, and remaining quota for metered backend actions.
- `GET /api/usage/alerts`
  - Returns warning/critical quota alerts persisted for the current usage period.

## API Versioning
- Canonical API version: `/api/v1/*`
- Compatibility alias: `/api/*`
- `/api/v1/*` is served through internal dispatch to avoid client-visible redirect behavior.

## Abuse Control Environment Variables
- `BLOCKED_EMAIL_DOMAINS`
- `INVITE_ALLOWED_DOMAINS`
- `SIGNUP_MAX_PER_IP_HOUR`
- `SIGNUP_MAX_PER_DOMAIN_DAY`
- `INVITE_MAX_PER_IP_HOUR`
- `INVITE_MAX_PER_EMAIL_DAY`
- `INVITE_MAX_PER_WORKSPACE_DAY`

## Workspace and Incident Operations APIs (Local Stage)
- Workspace membership and invites:
  - `GET /api/workspaces/me`
  - `POST /api/workspaces/invitations`
  - `POST /api/workspaces/invitations/:token/accept`
- Incident detection rules:
  - `GET /api/incidents/rules`
  - `POST /api/incidents/rules`
  - `PUT /api/incidents/rules/:id/enabled`
  - `DELETE /api/incidents/rules/:id`
- Notification operations:
  - `GET /api/notifications/deliveries`
  - `GET /api/notifications/dead-letters`
- SaaS baseline operations:
  - `GET /api/billing/subscription`
  - `POST /api/billing/subscription`
  - `GET /api/tenancy/validation`
