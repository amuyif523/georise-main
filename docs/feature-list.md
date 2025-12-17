# GEORISE Platform: Complete Feature List (2025)

This document enumerates **all features**—major and minor—implemented in the GEORISE platform as of December 2025. It covers backend, frontend, mobile, AI, GIS, admin, and infrastructure capabilities.

---

## 1. Incident Reporting & Citizen Experience
- Multi-step Incident Report Wizard (title, description, location, photo, not-at-scene toggle)
- Infrastructure Hazard Reporting (potholes, lights, leaks) with dedicated workflow
- Real-time map for location selection (Leaflet)
- Offline-first reporting (queue & sync when online)
- Duplicate incident detection (spatial, time, text similarity)
- "Already reported?" prompt for clustered incidents
- Multilingual UI (English/Amharic, i18next)
- Phone + OTP registration and login
- Email registration (legacy)
- My Reports dashboard (status, history, details)
- Live in-app incident update notifications (Socket.io notification bell)
- Push notifications for proximity alerts and status updates
- "Crisis Mode" banner and reporting restrictions
- Accessibility: mobile-friendly, keyboard navigation, color contrast

## 2. Agency & Admin Features
- Agency Dashboard (incident queue, map, analytics)
- Incident Detail View (status, chat, merge, handoff, backup request)
- Incident timeline/activity log with internal comments
- Dispatch recommendation panel with scored suggestions (accept to assign)
- Inter-agency chat (Socket.io, IncidentChat)
- Merge Incidents (UI, backend logic)
- Assign/dispatch responders (manual & auto)
- Agency Analytics (response time, heatmaps, resource utilization)
- Admin Dashboard (system status, user management, broadcast alerts)
- Admin live activity feed (incident created/updated stream)
- Admin review queue for pending incidents
- Admin citizen verification queue (approve/reject)
- Admin agency approval + activate/deactivate agencies
- Admin user activation/deactivation
- Admin demo scenario controls (reset/seed demo data)
- Admin GIS Management (draw/edit agency jurisdictions, save as GeoJSON)
- Admin can shadow-ban users
- Admin can send broadcast alerts to all users or by polygon/subcity
- Admin can view system health (DB, Redis, AI, uptime)
- Admin can review/verify citizen reports
- Audit logs for admin actions

## 3. Dispatch & GIS
- Auto-dispatch logic (find nearest available responder)
- PostGIS-powered spatial queries (ST_DWithin, ST_Distance)
- Smart routing (OSRM/Google API, drive time calculation)
- SLA timer and escalation alerts
- Agency jurisdiction enforcement (spatial)
- Responder live tracking (Socket.io, map updates)
- Responder field app (PWA) with GPS tracking, assignments, navigation, resolve
- Responder unit management (create/list units, status tracking)
- Nearby incident search (radius-based)
- Boundary overlays and boundary-based incident queries (subcity/woreda/agency)
- Simulation: fake responder movement for testing
- Incident location stored as both lat/lng and PostGIS geometry
- Geo-fencing for proximity alerts
- Heatmap and cluster visualization (Leaflet, Chart.js)

## 4. AI & Automation
- Incident classification (AfroXLMR, FastAPI)
- Severity scoring (AI or manual for hazards)
- Confidence scoring
- Amharic/English text support in AI
- Fallback to base model if custom weights missing
- AI bypass for infrastructure hazards
- Text similarity for duplicate detection

## 5. Security & Trust
- JWT authentication (all clients)
- Role-based access control (citizen, agency, admin)
- Rate limiting (Redis, per user/IP)
- TrustScore system (auto-verifies trusted users)
- Tiered user reputation (Tier 0-3)
- Shadow ban (admin)
- OTP verification for phone numbers
- Refresh token rotation
- Account lockout after repeated failed logins
- Citizen identity verification (national ID + phone OTP + admin approval)
- Secure password reset
- Audit logs for sensitive actions

## 6. Offline & Resilience
- Offline incident queue (idb-keyval)
- Sync queue on reconnect
- PWA support (service worker, offline cache)
- PWA install prompts (citizen + responder apps)
- Responder location offline queue (sync on reconnect)
- Low-data mode with fallback polling when sockets disconnect
- System health monitoring (DB, Redis, AI, uptime)
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
- Export incidents CSV (admin)
- Export analytics data (CSV/JSON)

## 8. Developer & Infrastructure
- Modular monorepo (frontend, backend, ai-service, infra)
- Docker Compose for local/dev deployment
- Prisma ORM with PostGIS support
- Automated database migrations & seeding
- TypeScript (frontend/backend), Python (AI)
- Centralized logging (Pino)
- Environment variable management per service
- Automated tests (unit/integration)

## 9. Partially Implemented or Not Yet Implemented
### Partial / Stubbed
- Incident photo uploads (UI exists, no backend storage/processing)
- SMS integration (OTP send simulated; no real provider configured)
- Push notifications (browser notifications + sockets only; no FCM/Web Push)
- Smart routing (heuristic drive time; OSRM/Google integration not wired)
- Crisis mode restrictions (UI banner only; no backend category enforcement)
- Responder simulation (demo data only; no automated fake movement)

### Not Implemented / Unverified
- Secure password reset flow (no endpoints/UI found)
- Automated tests (no unit/integration suite beyond AI test script)
- Analytics export (CSV/JSON) beyond incident CSV export
- Email registration (legacy) not verified as maintained flow

---

**Features above are implemented unless listed in Section 9.**
