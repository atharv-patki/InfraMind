# DevOps and Release Strategy

## Environments
- `dev`: local and shared integration.
- `staging`: production-like data flow and alert routing.
- `prod`: customer-facing environment.

## Pipeline Stages
1. Lint + typecheck.
2. Unit/integration tests.
3. Build artifacts.
4. Security scan.
5. Apply DB migrations (`wrangler d1 migrations apply`).
6. Deploy to staging.
7. Staging smoke tests.
8. Manual approval.
9. Production deploy.

## GitHub Workflows
- `.github/workflows/ci.yml`
  - Runs lint, typecheck, tests, build, and dependency audit on push/PR.
- `.github/workflows/backend-deploy.yml`
  - Manual deployment workflow for backend worker.
  - Supports `dry_run` mode before real deploy.
  - Supports target environment selection (`staging`/`production`).

## Deployment Model
- Preferred: canary rollout with automated rollback triggers.
- Alternative: blue/green deployment.

## Rollback Triggers
- Elevated error rate.
- Latency regression above threshold.
- Critical recovery workflows failing.

## Required Metrics Gate
- API error rate.
- P95 latency.
- Alert delivery success rate.
- Auto-recovery success rate.

## Required Release Artifacts
- Backend deployment + rollback runbook:
  - `docs/runbooks/backend-deploy-rollback.md`
- Incident response runbook:
  - `docs/runbooks/incident-response.md`
- Auto-recovery runbook:
  - `docs/runbooks/auto-recovery.md`
- Production release gates checklist:
  - `docs/devops/production-release-gates.md`
