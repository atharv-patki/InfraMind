# InfraMind AI Frontend Final Integration Plan

## Contract Rule
- Keep response contracts in `src/react-app/lib/aws-contracts.ts` stable.
- Backend changes must adapt to contracts, not force frontend structural rewrites.

## Integration Sequence
1. Replace mock config calls in `AwsOpsContext` with backend API.
2. Replace page-level mock calls:
   - `Overview`, `Infrastructure`, `Alerts`, `AutoHealing`, `Metrics`, `IncidentHistory`.
3. Wire SSE streams:
   - Metrics page -> `/api/stream/metrics`
   - Alerts/overview counters -> `/api/stream/alerts`
4. Keep current loading/empty/error/retry components everywhere.
5. Final pass on responsiveness and accessibility labels.

## Technical Notes
- Keep `DataStateCard`, `PageSkeleton`, `OpsStatusBadge`, `TimelineList` as shared primitives.
- Preserve retry behavior and toast feedback for all mutations.
- Avoid frontend data shape branching by normalizing in API service layer.

## Done Criteria
- No page depends on `aws-mock-service.ts` in production mode.
- All app pages read/write live backend data.
- Realtime updates visible without manual refresh.

