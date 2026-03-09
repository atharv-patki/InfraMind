# Auto-Recovery Playbook Runbook

## Preconditions
- AWS account connected with required IAM permissions.
- Target resource health checks configured.
- Escalation target configured.

## Standard Auto-Recovery Sequence
1. Trigger condition breached.
2. Start playbook execution with correlation id.
3. Execute action chain:
   - `restart`
   - `scale`
   - `redeploy`
   - `failover`
4. Wait for cooldown and verification window.
5. Verify service health.
6. Mark success or escalate.

## Safety Controls
- Idempotency lock per incident + playbook.
- Cooldown guard to prevent action storms.
- Maximum retry count before escalation.

## Failure Paths
- Action execution failed: retry policy, then escalate.
- Verification failed: run next action or escalate.
- Dependency unavailable: pause automation, open human incident.

## Audit Requirements
- Store start/end time, action results, retries, verification, and final decision.
- Store actor (`system` or `human`) for each state transition.
