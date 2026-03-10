# InfraMind AI Backend Foundation

## Completed in This Phase
- Global API error handler and request logging middleware.
- Security headers middleware for all responses.
- App-level API rate limiting buckets (`auth`, `mutation`) with rate-limit headers.
- API version compatibility route (`/api/v1/*` -> `/api/*`) via internal dispatch without HTTP redirect.
- OpenAPI discovery endpoint (`/api/openapi.json`).
- Auth/session baseline with secure cookie session support.
- D1 schema initialization + seed data.
- Schema migration tracking table (`schema_migrations`) added.
- Local/remote migration scripts switched to Wrangler migrations apply.
- Follow-up hardening migration added: `db/migrations/002_non_aws_backend_hardening.sql`.
- Shared Zod validation on core auth/AWS/incident/playbook/settings mutations.
- Workspace-role authorization helper enforcement expanded across dashboard read/write routes.
- Plan policy logic extracted to `src/worker/lib/plan.ts`.
- Incident detection rule contracts added with backend CRUD validation.
- Notification retry backoff + dead-letter persistence added for delivery failures.
- Middleware extraction started in:
  - `src/worker/middleware/http.ts`
  - `src/worker/middleware/rate-limit.ts`
- Route extraction started in:
  - `src/worker/routes/meta.ts`
  - `src/worker/routes/saas.ts`
- Repository/service data-access layering introduced:
  - `src/worker/repositories/user-repository.ts`
  - `src/worker/repositories/usage-repository.ts`
  - `src/worker/repositories/billing-repository.ts`
  - `src/worker/repositories/tenancy-repository.ts`
  - `src/worker/services/auth-service.ts`
  - `src/worker/services/usage-service.ts`
  - `src/worker/services/abuse-guard.ts`
  - `src/worker/services/billing-service.ts`
  - `src/worker/services/tenant-isolation-service.ts`
  - `src/worker/services/notification-provider.ts`

## Module Boundaries (Current)
- `auth`: register/login/logout/me, password, session.
- `monitoring`: servers, alerts, metrics, streams.
- `automation`: auto-healing rules.
- `insights`: AI anomalies/predictions/recommendations.
- `settings`: profile + API keys.
- `incidents`: incident list/detail/export/audit.

## Next Foundation Tasks
- Continue route extraction from `src/worker/index.ts` into domain route registrars.
- Convert remaining low-risk legacy/alias routes to schema validation.
- Move role helpers to dedicated middleware modules.
- Break route handlers into dedicated files by domain.

## API Versioning
- Current target version: `v1`.
- Backward compatibility path:
  - Existing `/api/*` endpoints continue.
  - `/api/v1/*` available and should be used by new clients.
