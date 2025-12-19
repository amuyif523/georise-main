# GEORISE Platform: Complete Feature List (Dec 2025)

This document enumerates all features implemented in the GEORISE platform as of December 2025 across backend, frontend, AI, GIS, admin, and infrastructure.

---

## 1. Incident Reporting & Citizen Experience

- Multi-step incident report wizard (title, description, location, photo, not-at-scene toggle)
- Infrastructure hazard reporting (potholes, lights, leaks) with dedicated workflow
- Real-time map for location selection (Leaflet)
- Offline-first reporting (queue and sync when online)
- Duplicate incident detection (spatial, time, text similarity) with "Already reported?" prompt
- Multilingual UI (English/Amharic via i18next)
- Phone + OTP registration and login; email registration supported
- My Reports dashboard (status, history, details)
- Live in-app incident notifications (Socket.io bell) and proximity/status push notifications
- Crisis Mode banner and low-priority category restrictions
- Accessibility: mobile-friendly, keyboard navigation, color contrast

## 2. Agency & Admin Features

- Agency dashboard (incident queue, map, analytics)
- Incident detail view (status changes, chat, merge, handoff/share for backup)
- Incident timeline/activity log with internal comments
- Dispatch recommendation panel with scored suggestions (accept to assign)
- Inter-agency chat (Socket.io incident rooms)
- Merge incidents (UI + backend logic)
- Assign/dispatch responders (manual and auto)
- Agency analytics (response time, heatmaps, resource utilization)
- Admin dashboard (system status, user management, broadcast alerts)
- Admin live activity feed (incident stream)
- Admin review queue for pending incidents
- Admin citizen verification queue (approve/reject)
- Admin agency approval + activate/deactivate agencies
- Admin user activation/deactivation
- Admin demo scenario controls (reset/seed demo data)
- Admin GIS management (draw/edit/save jurisdictions as GeoJSON)
- Admin shadow-ban users
- Admin broadcast alerts to all users or polygon/subcity
- Admin system health view (DB, Redis, AI)
- Admin audit logs for sensitive actions

## 3. Dispatch & GIS

- Auto-dispatch logic (nearest available responder with routing score)
- PostGIS-powered spatial queries (ST_DWithin, ST_Distance)
- Smart routing (OSRM/Google API with caching + heuristic fallback)
- SLA timer and escalation alerts (background job)
- Agency jurisdiction enforcement (spatial)
- Responder live tracking (Socket.io map updates)
- Responder PWA with GPS tracking, assignments, navigation, resolve
- Responder unit management (create/list units, status tracking)
- Nearby incident search (radius-based)
- Boundary overlays and boundary-based incident queries (subcity/woreda/agency)
- Responder simulation (demo movement toggle)
- Incident location stored as lat/lng and PostGIS geometry
- Geo-fencing for proximity alerts
- Heatmap and cluster visualization (Leaflet, Chart.js)

## 4. AI & Automation

- Incident classification (AfroXLMR via FastAPI)
- Severity scoring with confidence output
- Amharic/English text support in AI
- Fallback to base model if custom weights missing
- AI bypass for infrastructure hazards
- Text similarity for duplicate detection

## 5. Security & Trust

- JWT authentication with refresh token rotation
- Role-based access control (citizen, agency, admin)
- Rate limiting (Redis-backed) and abuse protections (shadow ban, spam throttles)
- TrustScore system with tiered reputation (auto-review for Tier 0)
- OTP verification for phone numbers
- Account lockout after repeated failed logins
- Citizen identity verification (national ID + phone OTP + admin approval)
- Secure password reset (tokenized, SMS/email logging)
- Audit logs for sensitive actions

## 6. Offline & Resilience

- Offline incident queue (idb-keyval) with sync on reconnect
- PWA support (service worker, offline cache, install prompts)
- Responder location offline queue (sync on reconnect)
- Low-data mode with polling fallback when sockets disconnect
- Crisis mode disables low-priority categories
- Broadcast alerts (admin to all users)

## 7. Analytics & Reporting

- Response time distribution (histogram)
- Heatmap by time-of-day
- Resource utilization (busy/idle)
- Agency and system-wide analytics dashboards
- KPI cards (avg dispatch/arrival, resolution rate)
- 30-day incident timeline trend
- K-means hotspot clustering
- Export incidents CSV
- Export analytics data (CSV/JSON)

## 8. Developer & Infrastructure

- Modular monorepo (frontend, backend, ai-service, infra)
- Docker Compose for local/dev deployment
- Prisma ORM with PostGIS support
- Automated database migrations and seeding
- TypeScript (frontend/backend), Python (AI)
- Centralized logging (Pino)
- Environment variable management per service
- Automated tests (unit/integration + e2e smoke)
- GitHub Actions CI for lint/test/build

---

## 9. Known Gaps / Follow-Ups

- AI model quality depends on provided weights; repository falls back to the base AfroXLMR model if fine-tuned checkpoints are absent.
- SMS delivery uses Twilio when credentials are set; otherwise messages are simulated/logged. Populate provider credentials for live OTP/alerts.
- Web Push relies on VAPID keys; FCM/mobile push is not wired.
- Observability beyond health checks is minimal (no metrics/tracing/alerting pipeline).
- Load/performance testing is not automated; run Artillery/JMeter before go-live.

All other features above are implemented in code as of this revision.
