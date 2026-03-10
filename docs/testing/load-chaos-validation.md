# Load and Chaos Validation Plan

## Load Test Targets
- Metrics endpoints: `/api/metrics/:metric`, `/api/metrics/latest`, `/api/stream/metrics`.
- Incident list and details: `/api/incidents`, `/api/incidents/:id`.
- Notification delivery list: `/api/notifications/deliveries`.

## SLO Targets
- p95 API latency < 500ms on list endpoints at 200 RPS synthetic load.
- p99 auth route latency < 700ms during rate-limit stress.
- Error budget burn alert if 5xx > 1% for 5-minute windows.

## Chaos Scenarios
- DB transient errors on write-heavy routes (alerts/playbooks).
- Notification provider failures causing retry + dead-letter execution.
- Concurrent playbook run lock contention and release behavior.

## Exit Criteria
- No data corruption in incident state machine transitions.
- Retry/backoff and dead-letter logic preserves auditability.
- Recovery to steady state within defined RTO for local staging tests.
