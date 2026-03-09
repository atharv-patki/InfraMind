# Incident Response Runbook

## Severity Model
- `SEV-1`: customer-impacting outage or data risk.
- `SEV-2`: major degradation with partial customer impact.
- `SEV-3`: minor degradation/no significant impact.

## Detection Sources
- CloudWatch alarms/anomaly detectors.
- API error budget burn alerts.
- Synthetic checks and customer reports.

## First 10 Minutes
1. Triage incident in dashboard and set lifecycle to `Detected`.
2. Assign owner and response team.
3. Move state to `Analyzing`.
4. Confirm blast radius (regions/services/workspaces).
5. Start customer/internal communication thread.

## Recovery Flow
1. If playbook exists and risk is acceptable, start auto-recovery.
2. Move state to `Recovering`.
3. Validate metrics and health checks.
4. If recovery successful, move to `Resolved`.
5. If recovery fails or repeats, escalate to human responders and set `Escalated`.

## Communications
- Internal update every 15 minutes for SEV-1/SEV-2.
- External status page update at incident start, major changes, and closure.

## Closure
1. Add timeline notes and final verification result.
2. Export incident report and attach to ticket.
3. Schedule postmortem within 48 hours for SEV-1/SEV-2.
