# InfraMind AI Product Freeze (MVP)

Last updated: 2026-03-09
Freeze version: `mvp-freeze-v1`

## Launch Scope (MVP)
- Auth: signup, login, logout, session-based auth.
- Marketing: home, features, pricing, docs, company, legal, changelog.
- Dashboard pages: overview, infrastructure, metrics, alerts, auto-healing, AI insights, incidents, settings.
- AWS operations UI: connect/disconnect state, IAM status placeholder, region/env/account config.
- Incident workflows: lifecycle UI (Detected, Analyzing, Recovering, Resolved, Escalated).
- Playbook workflows: trigger, action chain, cooldown, verification, escalation.

## Out of Scope for MVP Launch
- Real AWS account linking (cross-account role + AssumeRole).
- Real CloudWatch/EventBridge/Lambda ingestion.
- Real AI inference service and model explainability.
- Full billing/subscription enforcement and quotas.
- Enterprise-only capabilities (SSO/SAML, advanced compliance exports).

## Frozen Data Contracts
- Canonical frontend contract:
  - `src/react-app/lib/aws-contracts.ts`
- Auth contract:
  - `src/react-app/lib/auth-client.ts` (`AuthUser`, `RegisterResult`)
- Contract rule:
  - Backend responses must preserve these shapes to avoid frontend refactor.

## Frozen UX Flows
- Auth flow: signup -> login -> dashboard.
- AWS flow: settings connection panel -> operational pages.
- Incidents flow: list -> timeline/details -> actions (ack/escalate/resolve).
- Playbooks flow: create/update/toggle/run/delete.

## MVP SLA/SLO Targets
- API availability: 99.9% monthly.
- Alert creation to UI visibility (P95): under 5 seconds.
- Auto-recovery completion (simple restart playbook, P95): under 90 seconds.
- Auth endpoints (P95): under 500ms.

## Pricing and Plan Limits (MVP Rule)
- Starter:
  - Up to 5 resources
  - Basic monitoring + alerts
  - No AI insights / auto-healing / incidents audit
- Pro:
  - Up to 50 resources
  - AI insights + auto-healing + incidents audit
  - Priority support
- Enterprise:
  - Unlimited resources
  - Advanced integrations + dedicated support

## Freeze Change-Control Rule
- No feature additions to MVP scope without a written change request.
- Contract changes require version bump and migration notes.
- UX flow changes require update in this document and `docs/project-completion-status.md`.

## Sign-Off
- Product owner: Approved for MVP baseline (2026-03-09)
- Engineering owner: Approved for implementation baseline (2026-03-09)
- Status: Frozen for local/staging completion work
