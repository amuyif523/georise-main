# Backend API (Key Endpoints)

Auth

- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/refresh
- GET /api/auth/me

Incidents

- POST /api/incidents (citizen) — validated, anti-spam
- GET /api/incidents/my (citizen)
- GET /api/incidents (agency/admin; filters: status, hours)
- GET /api/incidents/nearby?lat&lng&radius
- PATCH /api/incidents/:id/assign|respond|resolve (agency/admin)

Admin

- GET /api/admin/agencies/pending
- PATCH /api/admin/agencies/:id/approve
- PATCH /api/admin/agencies/:id/boundary (GeoJSON polygon)
- GET /api/admin/users; PATCH /api/admin/users/:id/toggle; PATCH /api/admin/users/:id/verify
- GET /api/admin/audit
- GET /api/admin/analytics

Analytics

- GET /api/analytics/heatmap?hours&minSeverity
- GET /api/analytics/clusters
- GET /api/analytics/stats
- GET /api/analytics/risk
