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
- Realtime:
  - `GET /api/stream/metrics` (existing)
  - `GET /api/stream/alerts` (new)
- Metrics query endpoint support:
  - `GET /api/metrics/query` via `/api/metrics/:metric` with `metric=query`.

## Remaining for Full Completion
- Dedicated `/api/v1/*` handlers (not only redirect compatibility).
- Consistent OpenAPI schemas for every endpoint.
- Cursor pagination for high-volume data.
- Sort/filter support across settings and API key lists.
- Bulk export endpoints for incidents and playbook runs.

