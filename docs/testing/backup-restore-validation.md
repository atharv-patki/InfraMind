# Backup and Restore Validation Runbook

## Scope
- D1 backup export/import verification.
- Critical tables: `users`, `sessions`, `workspaces`, `memberships`, `alerts`, `incident_events`, `playbook_executions`, `audit_logs`.

## Drill Procedure
1. Export database snapshot from staging.
2. Restore snapshot into isolated validation database.
3. Run integrity checks:
   - Foreign key consistency.
   - Membership uniqueness.
   - Session/user referential integrity.
4. Run smoke API tests against restored environment.

## Validation Checks
- Login flow succeeds with restored sessions invalidated as expected.
- Incident timeline and playbook execution history remain queryable.
- Quota counters and alert events preserve period partitions.

## Acceptance
- RTO under 30 minutes.
- No critical data loss on core operational entities.
