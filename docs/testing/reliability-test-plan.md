# Testing and Reliability Plan

## Unit Tests
- API utilities, validators, auth helpers, mappers.
- Frontend data adapters and critical UI state reducers.
- Current implemented:
  - `src/worker/lib/plan.test.ts` (backend plan access/limit helpers)
  - `src/worker/services/usage-service.test.ts` (quota alert threshold behavior)
  - `src/worker/services/abuse-guard.test.ts` (email/domain normalization baseline)
  - `src/worker/openapi/spec.test.ts` (OpenAPI response coverage contract)
  - frontend baseline tests for shared state/data components.

## Integration Tests
- API endpoints with local DB.
- Auth session lifecycle.
- Incident and playbook state transitions.
- Current implemented:
  - `src/worker/integration/api-version.integration.test.ts` (`/api` and `/api/v1` compatibility without redirect).
- Run command:
  - `npm run test:integration`
- Next immediate additions:
  - usage meter increment + quota alert persistence (`usage_counters`, `quota_alert_events`)
  - playbook lock conflict behavior and release checks.

## E2E Tests
- Signup/login/logout.
- AWS connect/disconnect settings flow.
- Incident acknowledge/escalate/resolve.
- Playbook create/run/delete.
- Flow matrix artifact: `docs/testing/integration-e2e-matrix.md`.

## Performance and Reliability
- Burst test metrics and incident ingestion paths.
- Concurrency test playbook execution and idempotency.
- Recovery workflow failure injection tests.
- Load and chaos scenarios artifact: `docs/testing/load-chaos-validation.md`.
- Executed local load/chaos baseline:
  - `docs/testing/results/load-chaos-execution-2026-03-10.md`

## Backup and Disaster Recovery
- Backup restore drill schedule.
- RTO/RPO validation before production launch.
- Backup/restore drill artifact: `docs/testing/backup-restore-validation.md`.
- Executed local D1 backup/restore mechanics drill:
  - `docs/testing/results/backup-restore-drill-execution-2026-03-10.md`
