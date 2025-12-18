# GEORISE Implementation Plan (Sprints 4-8)

## Sprint 4: Operational Intelligence (Completed)

- [x] **Duplicate Detection Engine**
  - [x] Backend: `findPotentialDuplicates` (PostGIS 200m + Jaccard Similarity).
  - [x] Frontend: Citizen warning in `ReportIncidentWizard`.
- [x] **Reputation Management System**
  - [x] Backend: `ReputationService` (Scoring + Tiers).
  - [x] Backend: Auto-flag low-trust reports.
- [x] **Incident Merging**
  - [x] Backend: `mergeIncidents` (Status update + Logging).
  - [x] Frontend: Agency UI in `IncidentDetailPane` to merge duplicates.

## Sprint 5: Resource Management & Dispatch (Next)

- [ ] **Unit Management**
  - [ ] Backend: CRUD for `Unit` (Type, Capacity, Status).
  - [ ] Frontend: `UnitsPage` for Agency Admins.
- [ ] **Shift Management**
  - [ ] Backend: `Shift` model (Start/End time, Personnel).
  - [ ] Frontend: Shift assignment UI.
- [ ] **Advanced Dispatch**
  - [ ] Backend: Auto-dispatch logic based on Unit Type & Availability.
  - [ ] Frontend: Dispatch recommendation UI improvements.

## Sprint 6: Analytics & Reporting

- [ ] **Heatmaps**
  - [ ] Backend: Aggregated incident data endpoint.
  - [ ] Frontend: `Leaflet.heat` integration.
- [ ] **Agency Performance Metrics**
  - [ ] Backend: Response time calculation.
  - [ ] Frontend: Dashboard charts (Recharts).
- [ ] **Export**
  - [ ] Backend: CSV/PDF export for reports.

## Sprint 7: Communication & Notifications

- [ ] **In-App Chat**
  - [ ] Backend: Socket.io rooms for Incident-specific chat.
  - [ ] Frontend: Chat UI in `IncidentDetailPane`.
- [ ] **Push Notifications**
  - [ ] Backend: WebPush integration.
  - [ ] Frontend: Service Worker notification handling.

## Sprint 8: System Hardening & Final Polish

- [ ] **Role-Based Access Control (RBAC)**
  - [ ] Audit all endpoints for permission checks.
- [ ] **Rate Limiting**
  - [ ] Redis-based rate limiting for API.
- [ ] **Load Testing**
  - [ ] Simulate high load with Artillery.
