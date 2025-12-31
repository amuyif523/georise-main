# GEORISE Implementation Plan: Updated (Dec 2025)

This plan adds the newly identified RBAC/user-management gaps, AI/GIS validation, and observability work. Earlier sprints remain documented for traceability.

---

## Phases Delivered (baseline)

- **Phase 0: Testing & QA Foundation** — Backend unit/integration harness; frontend component tests; Playwright smoke; lint/format + CI with coverage.
- **Phase 1: Operational Intelligence** — Duplicate detection; TrustScore tiers; rate limiting/anti-abuse.
- **Phase 2: Communication & Coordination** — SMS/OTP; incident chat/merge/share; proximity alerts via sockets/Web Push.
- **Phase 3: Advanced Dispatch & GIS** — Routing (OSRM/Google + cache); SLA job; admin GIS boundary editor.
- **Phase 4: Resilience & Analytics** — Crisis mode; analytics dashboards; system health endpoint.
- **Phase 5: Localization & Polish** — Amharic/English i18n; hazard flow polish.
- **Phase 6: Notifications & Messaging** — Twilio with retry/backoff; Web Push (VAPID) + SW handlers.
- **Phase 7: Evidence & Media** — Photo uploads with validation/metadata/UI.
- **Phase 8: Crisis Controls & Routing Realism** — Crisis enforcement; routing scores/caching.
- **Phase 9: Quality, Exports & Recovery** — Password reset flow; analytics exports; automated tests; responder simulation toggle.

---

## New Hardening Sprints (to address current gaps)

### Sprint A: Agency/Responder/Dispatcher RBAC & CRUD

- Agency-scoped user management: create/edit/deactivate dispatchers/responders; soft-delete/status flags; password reset/force-reset.
- Super-admin user management: `/admin/users` list/create/role change/deactivate with audit logs.
- Enforce role checks and agency scoping on responder/incident lists; add pagination/search.
- Audit logging for all user CRUD by agency admins and super-admins.

### Sprint B: Admin Console Enhancements

- Admin CRUD for agencies + their users (pagination, search, role/status filters).
- Agency admin console: user table with role dropdown/status toggle; invite/reset flows.
- Prevent deletion of users with active assignments; require deactivate instead.
- Add availability/status for responders; optional schedule/shift as stretch.

### Sprint C: AI/GIS Validation & Safety Nets

- Pin numpy/torch compatibility in AI venv; document `numpy<2` fallback.
- Per-language eval + golden regression wired into CI for `/classify` (Amharic/English/mix).
- Strengthen GIS access control and proximity/duplicate tests; unit tests for spatial queries and boundary validation.
- Surface AI `metadata.json` version via `/health`; add retry/backoff in backend AI calls.

### Sprint D: Observability & Load Checks

- Metrics/tracing/alerting hooks (at least request/DB/AI latency and error rates).
- Light load/performance runs (Locust/Artillery) with DB/Redis tuning guidance.
- Audit events for critical actions (user CRUD, dispatch actions, crisis toggles) exposed to admins.

---

## Detailed Remaining Implementation Plan

### Sprint A: Agency/Responder/Dispatcher RBAC & CRUD

- Backend: Add Prisma migrations for user status/role flags; implement agency-scoped user CRUD endpoints (create/edit/deactivate/reactivate, password reset/force-reset); enforce soft-delete and audit logging for all user mutations; paginate/search responders/dispatchers with agency scoping.
- Frontend: Agency admin console views for user table (search/filter, role dropdown, status toggle), invite/reset flows, error states; wire to backend auth tokens and show audit outcomes.
- Security: Enforce RBAC/ownership on responder/incident lists; deny cross-agency access; rate-limit user CRUD; update JWT claims/refresh logic as needed.
- Tests/QA: Integration tests for user CRUD + audit logs; e2e flow for agency admin managing responders; regression on incident list scoping.

### Sprint B: Admin Console Enhancements

- Backend: Admin CRUD for agencies and their users with pagination, search, role/status filters; prevent deletion when active assignments exist and require deactivate; add responder availability/status fields.
- Frontend: Admin console tables for agencies and users (filters, status chips, role selectors); availability toggle + optional schedule UI; confirmation modals for deactivation; empty/loading states.
- Data integrity: Validate assignments before status changes; add audit events for agency/user changes.
- Tests/QA: Integration tests for admin CRUD constraints; e2e coverage for admin console interactions; UX polish checks (pagination/filter accuracy).

### Sprint C: AI/GIS Validation & Safety Nets

- AI service: Pin numpy/torch versions; document fallback; expose `metadata.json` version via `/health`; add retry/backoff in backend AI client; cache model metadata.
- Evaluation: Add golden regression tests for `/classify` (Amharic/English/mixed) in CI; training data sanity checks; document model drop-in to `ai-service/models`.
- GIS: Enforce access control on spatial endpoints; add unit tests for proximity/duplicate queries and boundary validation; cache jurisdiction lookups in Redis.
- Tests/QA: Backend integration for AI retries and GIS guards; CI job running golden eval; smoke test that health reports model version.

### Sprint D: Observability & Load Checks

- Metrics/logging: Extend request/DB/AI metrics with p95/p99, error rates; expose admin metrics endpoint with recent samples; add tracing stubs and log correlation IDs; emit audit events for critical actions.
- Alerting/runbooks: Add lightweight alert thresholds (error rate, slow queries, AI failures); document runbooks in `docs/observability-load.md`.
- Load testing: Script Artillery/Locust scenarios (health, incident list, metrics, timeline); capture DB/Redis CPU/connections; iterate with connection caps and indexes; store baselines before/after tuning.
- Tests/QA: Add automated smoke load script to CI optional job; verify metrics endpoint authz; ensure logs redact PII.

### Sprint E: Production Readiness & Credentials

- Credentials: Provision Twilio (SMS/OTP) and VAPID keys; decide on FCM/mobile push; update `.env.example` templates and secret management docs.
- Deployability: Finalize Docker Compose/infra overrides for prod (PostGIS, Redis limits); ensure AI weights can be mounted to `ai-service/models`; confirm backup/restore notes.
- Performance: Run final load/perf pass post-tuning; document p95 targets and accepted error budgets.
- Tests/QA: Checklist-driven release validation (auth flows, notifications, AI classify, GIS boundaries, offline/PWA); update QA log with findings.

---

## Remaining Follow-Ups

- Provision production credentials: Twilio (SMS) and VAPID; decide on FCM/mobile push.
- Drop trained AfroXLMR weights into `ai-service/models` for higher-quality classification; base model remains fallback.
- Run load/performance testing and tune Redis/DB connection limits before go-live.

---

Scope note: Core functionality is in place; these sprints close RBAC/CRUD gaps, harden AI/GIS validation, improve admin usability, and add observability/performance hygiene.
