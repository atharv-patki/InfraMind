# DevOps and Release Strategy

## Environments
- `dev`: local and shared integration.
- `staging`: production-like data flow and alert routing.
- `prod`: customer-facing environment.

## Pipeline Stages
1. Lint + typecheck.
2. Build artifacts.
3. Security scan.
4. Deploy to staging.
5. Staging smoke tests.
6. Manual approval.
7. Production deploy.

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
