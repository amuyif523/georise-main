# GEORISE Architecture (Overview)

- Clients: React (Citizen, Agency, Admin) with offline cache/PWA.
- Backend: Node/Express + Prisma + PostGIS.
- AI Service: FastAPI `/classify` using AfroXLMR fine-tuned model.
- DB: PostgreSQL + PostGIS (geography point for incidents, polygon for agency boundaries).
- Infra: Docker Compose (PostGIS); frontend/backend/ai-service run locally.

Key flows:

- Auth: JWT access + refresh, RBAC middleware.
- Incidents: Citizen submits → backend stores + geocodes to geography → calls AI → stores AI output.
- GIS: location column, nearby queries, heatmap, clustering.
- Admin: approval, boundary updates, audit logs.
