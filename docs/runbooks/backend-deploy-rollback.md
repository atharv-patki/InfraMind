# Backend Deploy and Rollback Runbook

## Scope
- InfraMind API worker deployment and rollback process for `staging` and `production`.
- Applies to backend-only changes (API, auth/session, incidents, playbooks, notifications).

## Preconditions
- CI `validate` workflow is green on the target commit.
- Required GitHub secrets are configured:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
- Database migration impact reviewed.
- Rollback owner assigned for the release window.

## Deploy Steps
1. Open GitHub Actions and run `Backend Deploy`.
2. Choose target environment (`staging` first, then `production`).
3. Run with `dry_run=true` for preflight.
4. Verify dry-run output has no config or binding errors.
5. Re-run with `dry_run=false` to deploy.
6. Confirm DB migrations step succeeded before worker deploy.
7. Confirm deployment output includes new worker version.

## Post-Deploy Verification (10-15 min)
1. Health check auth endpoints:
   - `POST /api/auth/login`
   - `GET /api/auth/me`
2. Health check core dashboard endpoints:
   - `GET /api/aws/overview`
   - `GET /api/incidents`
   - `GET /api/notifications/deliveries`
   - `GET /api/usage/me`
3. Validate mutation behavior:
   - playbook run endpoint returns execution payload
   - incident status/assignment updates succeed
4. Verify no 5xx spike in logs.

## Rollback Triggers
- Sustained 5xx rate above baseline for >5 minutes.
- Auth/session regression (login/logout/me failure).
- Playbook execution or incident lifecycle regressions.
- Critical data-write regression in alerts/incidents/settings.

## Rollback Steps
1. Re-deploy previous known-good commit via `Backend Deploy`.
2. Confirm `GET /api/auth/me` and `GET /api/aws/overview` recover.
3. Re-run smoke checks for incident/playbook flows.
4. Post internal incident summary with:
   - bad version
   - rollback version
   - user impact window

## Evidence to Capture
- Workflow run URL.
- Smoke-check API responses.
- Any rollback command output.
- Follow-up action items for next release.
