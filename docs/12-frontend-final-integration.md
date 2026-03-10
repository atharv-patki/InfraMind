# InfraMind AI Frontend Final Integration Plan

## Contract Rule
- Keep response contracts in `src/react-app/lib/aws-contracts.ts` stable.
- Backend changes must adapt to contracts, not force frontend structural rewrites.

## Integration Sequence
1. Replace mock config calls in `AwsOpsContext` with backend API.
2. Replace page-level mock calls:
   - `Overview`, `Infrastructure`, `Alerts`, `AutoHealing`, `Metrics`, `IncidentHistory`, `AIInsights`.
3. Wire SSE streams:
   - Metrics page -> `/api/stream/metrics`
   - Alerts/overview counters -> `/api/stream/alerts`
4. Keep current loading/empty/error/retry components everywhere.
5. Final pass on responsiveness and accessibility labels.
6. Enforce workspace role permissions in route-level UI gates.
7. Add invitation acceptance UX route for token-based workspace onboarding.

## Technical Notes
- Keep `DataStateCard`, `PageSkeleton`, `OpsStatusBadge`, `TimelineList` as shared primitives.
- Preserve retry behavior and toast feedback for all mutations.
- Avoid frontend data shape branching by normalizing in API service layer.
- Use `WorkspaceContext` as the source of truth for role-aware UI controls.

## Done Criteria
- No page depends on `aws-mock-service.ts` in production mode.
- All app pages read/write live backend data.
- Realtime updates visible without manual refresh.
- Workspace invite token links (`/invite/:token`) can be accepted inside frontend flow.
