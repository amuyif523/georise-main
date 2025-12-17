# GEORISE Implementation Plan: Road to 100%

This document outlines the remaining sprints required to bring the GEORISE platform from its current MVP state (~75%) to 100% feature completion as defined in `feature-list.md`.

## Phase 0: Testing & QA Foundation (Sprint 3.5)

**Focus:** Establish automated testing before new feature work.

### 0.1 Backend Test Harness

- **Goal:** Enable unit/integration coverage for core API flows.
- **Tasks:**
  - [x] **Setup:** Add test runner (e.g., Vitest/Jest) and config for TypeScript.
  - [x] **Infra:** Create test DB config + migrations/seed for test runs.
  - [x] **Tests:** Auth (login/OTP/refresh), incident creation/review, dispatch assign.

### 0.2 Frontend Test Harness

- **Goal:** Validate critical UI flows with automated tests.
- **Tasks:**
  - [x] **Setup:** Add component test runner (Vitest + React Testing Library).
  - [x] **Tests:** Report incident wizard, login/register, admin review queue.

### 0.3 E2E Smoke Tests

- **Goal:** End-to-end confidence for key user roles.
- **Tasks:**
  - [x] **Setup:** Add Playwright/Cypress baseline config.
  - [x] **Tests:** Admin login + analytics load, agency map loads, citizen report submit.

### 0.4 Linting & Formatting Baseline

- **Goal:** Consistent code quality checks across services.
- **Tasks:**
  - [x] **Backend:** Add ESLint config + real `npm run lint`.
  - [x] **Responder app:** Add ESLint config + lint script.
  - [x] **Repo:** Add Prettier config + format script (shared).

### 0.5 CI & Coverage

- **Goal:** Automated checks on every push/PR.
- **Tasks:**
  - [x] **CI:** Add GitHub Actions workflow for lint + test + build.
  - [x] **Coverage:** Enable coverage output + minimum thresholds.

### 0.6 Pre-commit Hooks

- **Goal:** Prevent bad commits locally.
- **Tasks:**
  - [x] **Setup:** Add Husky + lint-staged for lint/format on staged files.

---

## Phase 1: Operational Intelligence (Sprint 4)

**Focus:** Reducing noise, preventing spam, and managing high-volume events.

### 1.1 Duplicate Incident Detection (Feature 5.3)

- **Goal:** Prevent dispatcher overload during major events (e.g., 50 reports for one fire).
- **Tasks:**
  - [x] **Backend:** Implement `findPotentialDuplicates` service using PostGIS `ST_DWithin` (spatial) + Time window + Category match.
  - [x] **AI:** Add text similarity check (Cosine similarity on description) to refine spatial matches.
  - [x] **UI (Agency):** Add "Merge Incidents" interface in the Incident Detail view.
  - [x] **UI (Citizen):** "It looks like this has already been reported" prompt if reporting near an active cluster.
  - [x] **UI (Citizen):** Add "I am not at the scene" toggle in Report Wizard (Feature 1.2) to adjust location confidence score.

### 1.2 Reputation & Trust System (Feature 1.5)

- **Goal:** Auto-verify reports from trusted citizens and filter spam.
- **Tasks:**
  - [x] **Backend:** Implement `TrustScore` logic.
    - +5 for Verified Report (Agency marks "Resolved").
    - -10 for False Report (Agency marks "Rejected").
  - [x] **Backend:** Implement `Tier` logic (Tier 0 to Tier 3) based on score thresholds.
  - [x] **Middleware:** Update `incident.controller.ts` to auto-flag reports from Tier 0 users as "Pending Review".

### 1.3 Rate Limiting & Anti-Abuse (Feature 4.2)

- **Goal:** Protect the system from DDoS and spam bots.
- **Tasks:**
  - [x] **Backend:** Implement Redis-based rate limiting per IP/User.
  - [x] **Backend:** Add "Shadow Ban" functionality for admins.

---

## Phase 2: Communication & Coordination (Sprint 5)

**Focus:** Real-time collaboration and reaching users without data.

### 2.1 SMS & OTP Integration (Feature 1.1, 6.2)

- **Goal:** Support non-smartphone users and verify identity.
- **Tasks:**
  - [x] **Backend:** Integrate SMS provider (e.g., Twilio or local Ethio-Telecom gateway stub).
  - [x] **Frontend:** Replace/Augment Email Registration with Phone + OTP flow.
  - [x] **Backend:** Implement SMS fallback for critical alerts.

### 2.2 Inter-Agency Coordination (Feature 2.5)

- **Goal:** Allow Police, Fire, and Medical to collaborate on a single incident.
- **Tasks:**
  - [x] **Database:** Add `SharedIncident` relation to allow multiple agencies to view one record.
  - [x] **Backend:** Implement `IncidentChat` (Socket.io namespace for inter-agency messaging).
  - [x] **Frontend:** Add "Chat" tab in Agency Incident Detail pane.
  - [x] **Frontend:** Add "Request Handoff" or "Request Backup" workflow.

### 2.3 Proximity Alerts (Feature 1.4)

- **Goal:** Warn citizens of danger nearby.
- **Tasks:**
  - [x] **Backend:** Geo-fencing service. When incident = `CONFIRMED` & Severity > 4, find users within 2km.
  - [x] **Mobile:** Implement Push Notifications (Firebase FCM or Web Push) for "Danger Nearby".

---

## Phase 3: Advanced Dispatch & GIS (Sprint 6)

**Focus:** Optimizing response times and administrative control.

### 3.1 Smart Routing & SLAs (Feature 2.3)

- **Goal:** Automate unit selection and ensure timely responses.
- **Tasks:**
  - [x] **Backend:** Implement OSRM (Open Source Routing Machine) or Google Routes API integration to calculate _drive time_ instead of just linear distance.
  - [x] **Backend:** Implement SLA Background Job (Cron). Check `createdAt` vs `dispatchedAt`. If > Threshold, trigger "Escalation" alert to Supervisor.

### 3.2 Admin GIS Management (Feature 4.1)

- **Goal:** Allow admins to manage jurisdictions without SQL.
- **Tasks:**
  - [x] **Frontend:** Implement `Leaflet-Draw` in Admin Console.
  - [x] **Frontend:** UI to Draw/Edit Agency Jurisdictions and Save as GeoJSON.
  - [x] **Backend:** API endpoint to update `Agency.jurisdiction` geometry.

---

## Phase 4: Resilience & Analytics (Sprint 7)

**Focus:** System health and long-term insights.

### 4.1 Crisis Mode & Public Safety (Feature 3.1, 1.4)

- **Goal:** City-wide override for disasters and mass communication.
- **Tasks:**
  - [x] **Backend:** Global `SystemConfig` toggle for "Crisis Mode".
  - [x] **Frontend:** "Crisis Banner" on all Citizen/Agency screens.
  - [x] **Logic:** Disable low-priority reporting categories during crisis.
  - [x] **Backend:** Implement "Broadcast Alert" feature (Admin sends message to all users in a specific Polygon/Subcity).

### 4.2 Advanced Analytics (Feature 2.7, 3.2)

- **Goal:** Data-driven decision making.
- **Tasks:**
  - [x] **Frontend:** Implement Chart.js / Recharts for:
    - Response Time Distribution (Histogram).
    - Heatmap by Time-of-Day (Grid).
    - Resource Utilization (Busy vs Idle time).
  - [x] **Backend:** Aggregation pipelines for complex stats.

### 4.3 System Health Monitoring (Feature 4.3)

- **Goal:** Ensure uptime.
- **Tasks:**
  - [x] **Backend:** `/health` endpoint checking DB connection, Redis, and AI Service latency.
  - [x] **Frontend:** Admin "System Status" dashboard.

---

## Phase 5: Localization & Polish (Sprint 8)

**Focus:** Accessibility and user experience for the local context.

### 5.1 Multilingual Support (Feature 6.2, 8)

- **Goal:** Full Amharic support for citizens.
- **Tasks:**
  - [x] **Frontend:** Implement `i18next` for UI translations (English/Amharic).
  - [x] **AI:** Ensure classification model handles Amharic script (already supported by AfroXLMR, verify edge cases).

### 5.2 Infrastructure Hazard Workflow (Feature 3.2)

- **Goal:** Handle non-emergency reports differently.
- **Tasks:**
  - [x] **Backend:** Create separate workflow for "Infrastructure" category (no SLA timer, routed to City Admin instead of Emergency Dispatch).
  - [x] **Frontend:** "Report Hazard" simplified flow for potholes/broken lights.

---

## Phase 6: Notifications & Messaging Hardening (Sprint 9)

**Focus:** Production-grade SMS and push notifications.

### 6.1 SMS Provider Integration (Feature 2.1)

- **Goal:** Replace simulated SMS with a real provider.
- **Tasks:**
  - [ ] **Backend:** Integrate a real SMS gateway (Twilio or local Ethio-Telecom).
  - [ ] **Backend:** Add delivery/error handling and retry logic for OTP and alerts.
  - [ ] **Config:** Add provider credentials + environment configuration.

### 6.2 Push Notifications (Feature 2.3)

- **Goal:** Real push delivery for proximity alerts and status updates.
- **Tasks:**
  - [ ] **Backend:** Store device tokens and opt-in settings.
  - [ ] **Backend:** Send push via FCM/Web Push for alerts and status changes.
  - [ ] **Frontend:** Register service worker push handlers and token lifecycle.

---

## Phase 7: Incident Evidence & Media (Sprint 10)

**Focus:** Photo uploads for reports and review.

### 7.1 Incident Photo Uploads

- **Goal:** Allow citizens to upload and agencies to view images.
- **Tasks:**
  - [ ] **Backend:** Add upload endpoint, storage (local/S3), and file validation.
  - [ ] **Backend:** Persist image metadata linked to incidents.
  - [ ] **Frontend:** Upload images from report wizard and show in incident detail.

---

## Phase 8: Crisis Controls & Routing Realism (Sprint 11)

**Focus:** Enforce crisis rules and improve routing accuracy.

### 8.1 Crisis Mode Enforcement (Feature 4.1)

- **Goal:** Block low-priority categories when crisis mode is active.
- **Tasks:**
  - [ ] **Backend:** Validate categories on incident creation when crisis mode is enabled.
  - [ ] **Frontend:** Disable/gray out low-priority categories in reporting UI.

### 8.2 Real Routing Integration (Feature 3.1)

- **Goal:** Replace heuristic routing with OSRM or Google Routes.
- **Tasks:**
  - [ ] **Backend:** Integrate external routing API and cache route results.
  - [ ] **Dispatch:** Update recommendation scoring to use real drive-time.
  - [ ] **Ops:** Add configuration toggles and fallback behavior.

---

## Phase 9: Quality, Exports & Recovery (Sprint 12)

**Focus:** Reliability, recovery paths, and reporting exports.

### 9.1 Password Reset Flow (Feature 5.6)

- **Goal:** Secure account recovery.
- **Tasks:**
  - [ ] **Backend:** Implement request + reset endpoints with secure tokens.
  - [ ] **Frontend:** Add reset request + new password UI.
  - [ ] **Email/SMS:** Deliver reset links or codes.

### 9.2 Analytics Export (Feature 7.5)

- **Goal:** Export analytics beyond incidents CSV.
- **Tasks:**
  - [ ] **Backend:** Provide CSV/JSON export for analytics datasets.
  - [ ] **Frontend:** Add export controls to analytics dashboards.

### 9.3 Automated Tests (Feature 8.8)

- **Goal:** Add unit and integration coverage for core flows.
- **Tasks:**
  - [ ] **Backend:** Add unit/integration tests for auth, incidents, dispatch.
  - [ ] **Frontend:** Add UI tests for critical pages (reporting, admin).
  - [ ] **CI:** Wire tests into a repeatable script.

### 9.4 Responder Simulation (Feature 3.7)

- **Goal:** Simulate responder movement for demos.
- **Tasks:**
  - [ ] **Backend:** Add a demo job to move responders along a route.
  - [ ] **Frontend:** Add a toggle to start/stop simulation.

---

## Execution Strategy

1.  **Start with Sprint 4 (Operational Intelligence)** immediately. It requires no UI overhaul, just backend logic and minor UI tweaks, but adds immense value for the pilot.
2.  **Sprint 5** requires external service setup (SMS/Push).
3.  **Sprint 6 & 7** are "Power User" features that can wait until after the initial pilot feedback.
