# Observability & Load Checks (Sprint D)

This guide documents the lightweight instrumentation added to the platform and how to run smoke/performance checks with DB/Redis tuning guidance.

## Metrics & Tracing Hooks

- Request timing/error tracking is emitted for every API call; slow (>2s) and server-error (5xx) requests are logged via `pino`.
- Prisma middleware tracks DB query latency; slow queries (>500ms) log a warning. Metrics include counts, error rates, and latency (avg/p95/max).
- AI `/classify` calls are timed with success/failure counters to spot degraded models or network regressions.
- Admins can fetch a live snapshot at `GET /api/admin/metrics` (requires ADMIN auth). Response includes request/DB/AI counters, error rates, and recent samples to back diagnostics/alerting.

## Quick Health Checks

- Basic uptime: `curl -s http://localhost:4000/health` (backend) and the existing AI `/health` endpoint for model version/metadata.
- Metrics spot check: `curl -s -H "Authorization: Bearer <admin-jwt>" http://localhost:4000/api/admin/metrics | jq '.metrics.errorRates'`.

## Light Load/Performance Runs

- **Artillery smoke (API baseline):**
  ```bash
  npx artillery quick --count 5 --num 20 http://localhost:4000/health
  npx artillery quick --count 3 --num 10 http://localhost:4000/api/incidents  \
    -H "Authorization: Bearer <agency-or-admin-jwt>"
  ```
- **Locust (richer flows):**
  1. Create a `locustfile.py` alongside this repo (or in /tmp) with incident list + classify calls. Example tasks: hit `/api/incidents?page=1&limit=20`, `/api/admin/metrics`, and `/api/incidents/:id/timeline` for an admin token.
  2. Run `locust -f locustfile.py --headless -u 30 -r 5 -t 5m --host http://localhost:4000`.
- Capture DB and Redis resource use during runs (CPU, connections). Re-run after tweaks to confirm gains.

## DB/Redis Tuning Guidance

- Start with sane connection caps: Prisma `connection_limit` 10–20; align Postgres `max_connections` accordingly. Avoid spikes that starve the DB.
- Add indexes before load tests on frequently filtered fields (e.g., `Incident.assignedAgencyId`, `Incident.createdAt`, `AuditLog.createdAt`, `AgencyStaff.agencyId`). Use `EXPLAIN ANALYZE` on slow queries flagged by metrics.
- Ensure `REDIS_MAX_CLIENTS` (or instance default) comfortably exceeds concurrent socket + rate-limit clients; monitor for `max number of clients reached` errors.
- For sustained load, bump Node.js heap only if GC is a bottleneck; prefer caching hot lookups (jurisdictions) in Redis first.
- Capture p95/p99 latency deltas from `/api/admin/metrics` before/after tuning to justify changes.

## What to Watch

- Request 5xx error rate > 0.02 or sudden p95 jumps: check upstream AI, DB locks, or Redis saturation.
- DB slow-query warnings: add indexes or reduce N+1s; consider read-only replicas later (future work).
- AI call failures/latency spikes: validate the model pod/host, retry budget, and network path.

These steps keep observability lightweight while giving admins fast signals to triage performance and stability regressions.
