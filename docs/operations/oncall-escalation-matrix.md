# On-Call Escalation Matrix

## Primary Rotation
- Window: 24x7 weekly rotation.
- Primary responder: Platform SRE.
- Backup responder: Cloud Reliability Engineer.

## Escalation Timing
1. `T+0 min`: Primary paged.
2. `T+10 min`: Backup paged if unacknowledged.
3. `T+20 min`: Engineering manager paged.
4. `T+30 min`: Incident commander assigned.

## Escalation Rules
- SEV-1 always requires incident commander.
- SEV-2 escalates to manager if unresolved after 30 minutes.
- Security incidents escalate immediately to security lead.

## Contacts (Fill Before Launch)
- Primary On-call:
- Backup On-call:
- Incident Commander:
- Security Lead:
- Product/Customer Comms Lead:
