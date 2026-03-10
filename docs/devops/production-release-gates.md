# Production Release Gates (Backend)

## Mandatory Gates
- CI green: lint, typecheck, unit/integration tests, build.
- Vulnerability scan clean for high/critical production dependencies.
- OpenAPI contract updated and reviewed for changed routes.
- DB migration reviewed and backward-compatibility verified.

## Deployment Gates
- Staging deployment + smoke tests completed.
- Rollback runbook verified for current release.
- Incident communication template prepared.
- On-call owner assigned for release window.

## Post-Deploy Validation
- Auth flow health check.
- API v1 compatibility smoke check (`/api/v1/openapi.json`).
- Notification delivery and dead-letter health check.
- Quota alert and billing endpoint sanity check.
