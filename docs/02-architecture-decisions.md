# InfraMind AI Architecture Decisions

Last updated: 2026-03-09
Decision set: `arch-freeze-v1`

## Runtime Decision
- Primary API runtime: Cloudflare Worker (serverless API) for continuity with current codebase.
- Optional split later: Python Lambda services for anomaly detection and recovery execution workloads.

## Database Decision
- Current environment: Cloudflare D1.
- Production scale target: managed PostgreSQL with migration compatibility plan.
- Decision note:
  - Keep current schema contracts stable so D1 -> PostgreSQL migration does not affect frontend data shapes.

## Event Architecture Decision
- Target pipeline:
  - CloudWatch -> EventBridge -> Lambda (Python) -> API/DB -> Realtime stream -> Frontend
- Current phase:
  - Local/staging flow remains mock-driven for AWS telemetry fields until real AWS integration starts.

## Realtime Transport Decision
- Primary: SSE.
- Optional later: WebSocket for high-frequency bidirectional use cases.
- Reason:
  - SSE is lower operational complexity for one-way metrics/alerts stream and is already implemented.

## Deployment Topology Decision
- `dev`: local Worker + local D1.
- `staging`: cloud Worker + isolated staging DB + staging event bus.
- `prod`: cloud Worker + production DB + production event bus + monitoring stack.

## Non-Negotiable Architecture Rules
- API contracts remain backward-compatible with `src/react-app/lib/aws-contracts.ts`.
- API version namespace remains `/api/v1` for new route publication.
- Every mutating write action must generate an audit entry.
- Background/async handlers must be idempotent.

## Decision Log
- Runtime decision: Approved (2026-03-09)
- Database direction: Approved (2026-03-09)
- Event and realtime direction: Approved (2026-03-09)
- Deployment topology: Approved (2026-03-09)

## Sign-Off
- Engineering owner: Approved architecture baseline for implementation (2026-03-09)
- Status: Frozen for local/staging completion work
