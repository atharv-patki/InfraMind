# InfraMind AI API Surface Completion

## Completed in This Phase
- `GET /api/servers` now supports:
  - `page`, `limit`, `search`, `status`, `region`, `sortBy`, `sortDir`
- `GET /api/alerts` now supports:
  - `page`, `limit`, `search`, `severity`, `status`, `sortBy`, `sortDir`
- `GET /api/automation/rules` now supports:
  - `page`, `limit`, `search`, `enabled`, `sortBy`, `sortDir`
- Response payload now includes:
  - legacy list keys (`servers`, `alerts`, `rules`)
  - generic `items`
  - `meta` with pagination/filter/sort details
- Incidents API baseline added:
  - `GET /api/incidents`
  - `GET /api/incidents/:id`
  - `GET /api/incidents/:id/export`
  - `GET /api/incidents/audit`
- Incident detection rules API added:
  - `GET /api/incidents/rules`
  - `POST /api/incidents/rules`
  - `PUT /api/incidents/rules/:id/enabled`
  - `DELETE /api/incidents/rules/:id`
- Realtime:
  - `GET /api/stream/metrics` (existing)
  - `GET /api/stream/alerts` (new)
- Metrics query endpoint support:
  - `GET /api/metrics/query` via `/api/metrics/:metric` with `metric=query`.
- OpenAPI route coverage expanded for:
  - auth/logout and legacy aliases
  - servers/alerts/automation mutation routes
  - incident detection rule endpoints
  - user profile/password/API keys
  - incident assignment and latest metrics snapshot
  - usage/quota endpoint (`GET /api/usage/me`)
  - notifications dead-letter endpoint (`GET /api/notifications/dead-letters`)
- API v1 compatibility upgraded:
  - `/api/v1/*` now internally dispatches to canonical handlers (no HTTP redirect).
- OpenAPI component schemas expanded and standardized:
  - request/response contracts now attached across documented operations.
- SaaS contract endpoints added:
  - `GET /api/usage/alerts`
  - `GET /api/billing/subscription`
  - `POST /api/billing/subscription`
  - `POST /api/billing/webhooks/stripe`
  - `GET /api/tenancy/validation`
- Incident export consistency improved:
  - `GET /api/incidents/:id/export?format=txt|json|csv`
  - `GET /api/aws/audits/:id/export?format=txt|json|csv`

## Additional API Hardening Added
- Mutation payload schemas expanded (Zod) for:
  - resource quick actions
  - incident status/assignment
  - playbook create/toggle
  - alert create/update
  - automation rule create/update
  - AI recommendation update
  - password + API key creation
- Incident ownership fields (`owner`, `team`) are now persisted and returned.
- Read routes now enforce workspace viewer-level RBAC checks.
- Plan limit and usage-aware error responses added (`PLAN_LIMIT_REACHED`).

## Remaining for Full Completion
- Route extraction from monolith file into domain route modules.
- Cursor pagination for high-volume data.
- Sort/filter support across settings and API key lists.
- Bulk export endpoints for incidents and playbook runs.
