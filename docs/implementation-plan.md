# GEORISE Implementation Plan: Road to 100%

This document outlines the remaining sprints required to bring the GEORISE platform from its current MVP state (~75%) to 100% feature completion as defined in `feature-list.md`.

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
  - [ ] **Backend:** Integrate SMS provider (e.g., Twilio or local Ethio-Telecom gateway stub).
  - [ ] **Frontend:** Replace/Augment Email Registration with Phone + OTP flow.
  - [ ] **Backend:** Implement SMS fallback for critical alerts.

### 2.2 Inter-Agency Coordination (Feature 2.5)
- **Goal:** Allow Police, Fire, and Medical to collaborate on a single incident.
- **Tasks:**
  - [ ] **Database:** Add `SharedIncident` relation to allow multiple agencies to view one record.
  - [ ] **Backend:** Implement `IncidentChat` (Socket.io namespace for inter-agency messaging).
  - [ ] **Frontend:** Add "Chat" tab in Agency Incident Detail pane.
  - [ ] **Frontend:** Add "Request Handoff" or "Request Backup" workflow.

### 2.3 Proximity Alerts (Feature 1.4)
- **Goal:** Warn citizens of danger nearby.
- **Tasks:**
  - [ ] **Backend:** Geo-fencing service. When incident = `CONFIRMED` & Severity > 4, find users within 2km.
  - [ ] **Mobile:** Implement Push Notifications (Firebase FCM or Web Push) for "Danger Nearby".

---

## Phase 3: Advanced Dispatch & GIS (Sprint 6)
**Focus:** Optimizing response times and administrative control.

### 3.1 Smart Routing & SLAs (Feature 2.3)
- **Goal:** Automate unit selection and ensure timely responses.
- **Tasks:**
  - [ ] **Backend:** Implement OSRM (Open Source Routing Machine) or Google Routes API integration to calculate *drive time* instead of just linear distance.
  - [ ] **Backend:** Implement SLA Background Job (Cron). Check `createdAt` vs `dispatchedAt`. If > Threshold, trigger "Escalation" alert to Supervisor.

### 3.2 Admin GIS Management (Feature 4.1)
- **Goal:** Allow admins to manage jurisdictions without SQL.
- **Tasks:**
  - [ ] **Frontend:** Implement `Leaflet-Draw` in Admin Console.
  - [ ] **Frontend:** UI to Draw/Edit Agency Jurisdictions and Save as GeoJSON.
  - [ ] **Backend:** API endpoint to update `Agency.jurisdiction` geometry.

---

## Phase 4: Resilience & Analytics (Sprint 7)
**Focus:** System health and long-term insights.

### 4.1 Crisis Mode & Public Safety (Feature 3.1, 1.4)
- **Goal:** City-wide override for disasters and mass communication.
- **Tasks:**
  - [ ] **Backend:** Global `SystemConfig` toggle for "Crisis Mode".
  - [ ] **Frontend:** "Crisis Banner" on all Citizen/Agency screens.
  - [ ] **Logic:** Disable low-priority reporting categories during crisis.
  - [ ] **Backend:** Implement "Broadcast Alert" feature (Admin sends message to all users in a specific Polygon/Subcity).

### 4.2 Advanced Analytics (Feature 2.7, 3.2)
- **Goal:** Data-driven decision making.
- **Tasks:**
  - [ ] **Frontend:** Implement Chart.js / Recharts for:
    - Response Time Distribution (Histogram).
    - Heatmap by Time-of-Day (Grid).
    - Resource Utilization (Busy vs Idle time).
  - [ ] **Backend:** Aggregation pipelines for complex stats.

### 4.3 System Health Monitoring (Feature 4.3)
- **Goal:** Ensure uptime.
- **Tasks:**
  - [ ] **Backend:** `/health` endpoint checking DB connection, Redis, and AI Service latency.
  - [ ] **Frontend:** Admin "System Status" dashboard.

---

## Phase 5: Localization & Polish (Sprint 8)
**Focus:** Accessibility and user experience for the local context.

### 5.1 Multilingual Support (Feature 6.2, 8)
- **Goal:** Full Amharic support for citizens.
- **Tasks:**
  - [ ] **Frontend:** Implement `i18next` for UI translations (English/Amharic).
  - [ ] **AI:** Ensure classification model handles Amharic script (already supported by AfroXLMR, verify edge cases).

### 5.2 Infrastructure Hazard Workflow (Feature 3.2)
- **Goal:** Handle non-emergency reports differently.
- **Tasks:**
  - [ ] **Backend:** Create separate workflow for "Infrastructure" category (no SLA timer, routed to City Admin instead of Emergency Dispatch).
  - [ ] **Frontend:** "Report Hazard" simplified flow for potholes/broken lights.

---

## Execution Strategy

1.  **Start with Sprint 4 (Operational Intelligence)** immediately. It requires no UI overhaul, just backend logic and minor UI tweaks, but adds immense value for the pilot.
2.  **Sprint 5** requires external service setup (SMS/Push).
3.  **Sprint 6 & 7** are "Power User" features that can wait until after the initial pilot feedback.
