# Sensitive Operation Audit Policy

## Operations Requiring Audit Logs
- Authentication state changes (login/logout/reset/verify).
- Role/permission changes.
- Billing/subscription changes and webhook sync events.
- Incident lifecycle updates and escalations.
- Playbook create/update/run/delete.
- Notification test sends and dead-letter drops.
- API key create/delete.

## Required Audit Fields
- `workspace_id`
- `user_id` (or `system` actor reference)
- action identifier
- entity type and entity id
- metadata JSON with decision context
- timestamp (UTC ISO8601)

## Retention and Access
- Minimum retention: 180 days in staging; 365 days in production.
- Read access limited to owner/admin/security roles.

## Integrity Controls
- Audit entries are append-only from application paths.
- Modification/deletion of historical audit rows must be blocked outside privileged maintenance procedures.
