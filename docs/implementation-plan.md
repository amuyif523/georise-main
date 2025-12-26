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

## Remaining Follow-Ups

- Provision production credentials: Twilio (SMS) and VAPID; decide on FCM/mobile push.
- Drop trained AfroXLMR weights into `ai-service/models` for higher-quality classification; base model remains fallback.
- Run load/performance testing and tune Redis/DB connection limits before go-live.

---

Scope note: Core functionality is in place; these sprints close RBAC/CRUD gaps, harden AI/GIS validation, improve admin usability, and add observability/performance hygiene.
