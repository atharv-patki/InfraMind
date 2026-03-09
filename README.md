
# InfraMind AI

AI-powered cloud infrastructure monitoring platform (frontend + worker API).

## Current Status
- Detailed status tracker: `docs/project-completion-status.md`
- AWS platform execution checklist: `docs/aws-platform-worklist.md`
- Runbooks:
  - `docs/runbooks/incident-response.md`
  - `docs/runbooks/auto-recovery.md`
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
npm run build
```

## Local DB Bootstrap
```bash
npm run db:migrate:local
npm run db:seed:local
```
