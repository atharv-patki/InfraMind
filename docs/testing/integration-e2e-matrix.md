# Backend Integration and E2E Matrix

## Integration Suites (Implemented)
- `src/worker/integration/api-version.integration.test.ts`
  - Validates `/api/v1/*` internal compatibility flow without redirect.
  - Confirms OpenAPI output is available from both compatibility and canonical paths.
- `src/worker/integration/load-chaos.integration.test.ts`
  - Validates burst-load behavior and chaos-path resilience without 5xx regressions.
- `src/worker/openapi/spec.test.ts`
  - Ensures every documented operation has response contracts.
- `src/worker/services/billing-service.test.ts`
  - Validates Stripe webhook payload mapping and rejection behavior.
- `src/worker/services/tenant-isolation-service.test.ts`
  - Validates adversarial tenant-isolation violation detection.
- `src/worker/services/usage-service.test.ts`
  - Validates quota alert threshold behavior.
- `src/worker/services/abuse-guard.test.ts`
  - Validates email-domain normalization behavior.

## E2E Flows (Ready To Automate)
- Signup -> Login -> Usage endpoint -> Logout.
- Owner/admin invite creation with anti-abuse checks.
- Incident lifecycle status update + assignment + audit export.
- Playbook create -> run -> execution lock conflict behavior.

## Pending Automation Harness
- Add Playwright/worker test harness for browser + API combined E2E.
- Add seeded test tenant fixtures for deterministic role and quota validation.
