# InfraMind AI Backend Foundation

## Completed in This Phase
- Global API error handler and request logging middleware.
- API version compatibility route (`/api/v1/*` -> `/api/*`).
- OpenAPI discovery endpoint (`/api/openapi.json`).
- Auth/session baseline with secure cookie session support.
- D1 schema initialization + seed data.

## Module Boundaries (Current)
- `auth`: register/login/logout/me, password, session.
- `monitoring`: servers, alerts, metrics, streams.
- `automation`: auto-healing rules.
- `insights`: AI anomalies/predictions/recommendations.
- `settings`: profile + API keys.
- `incidents`: incident list/detail/export/audit.

## Next Foundation Tasks
- Split `src/worker/index.ts` into module files:
  - `src/worker/routes/auth.ts`
  - `src/worker/routes/monitoring.ts`
  - `src/worker/routes/incidents.ts`
  - `src/worker/routes/settings.ts`
  - `src/worker/middleware/*`
- Add shared validation schemas for all endpoints.
- Add role middleware and policy checks.
- Add migration scripts folder and versioned migration runner.

## API Versioning
- Current target version: `v1`.
- Backward compatibility path:
  - Existing `/api/*` endpoints continue.
  - `/api/v1/*` available and should be used by new clients.

