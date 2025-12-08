# GEORISE – AI + GIS Incident Management for Addis Ababa

AI-driven, geospatial incident reporting and multi-agency dispatch platform (Citizen, Agency, Admin portals) with offline resilience.

## Features
- Citizen incident reporting wizard (Amharic/English) with AI classification + severity scoring
- PostGIS-powered maps: clustering, heatmaps, nearby search
- Agency dispatch workflow (assign/respond/resolve) + audit logs
- Admin governance: agency approval, boundaries, user verification, analytics
- Security: JWT + refresh, RBAC, rate limits, validation, lockouts, abuse checks
- Offline queue + PWA; online/offline banner

## Tech Stack
- Frontend: React + TypeScript + Vite + Tailwind + DaisyUI + Leaflet
- Backend: Node.js + Express + TypeScript + Prisma
- DB: PostgreSQL + PostGIS
- AI: FastAPI + Transformers (AfroXLMR fine-tune)
- DevOps: Docker Compose (PostGIS)

## Quickstart (Local)
```bash
git clone <repo>
cd georise

# 1) Infra
cd infra
docker compose up -d

# 2) Backend
cd ../backend
cp .env.example .env
npm install
npx prisma migrate dev   # ensure PostGIS enabled
npx prisma db seed       # demo data
npm run dev

# 3) AI Service
cd ../ai-service
cp .env.example .env
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001

# 4) Frontend
cd ../frontend
cp .env.example .env
npm install
npm run dev
```

## Demo Accounts
- Admin: `admin@example.com` / `password123`
- Agency (Police): `police1@example.com` / `password123`
- Citizen: `citizen1@example.com` / `password123`

## Project Structure
```
georise/
  frontend/        # React app (pages, components, context, lib)
  backend/         # Express API (modules, middleware, config, prisma)
  ai-service/      # FastAPI classifier
  infra/           # docker-compose (PostGIS)
  docs/            # architecture, api, ai, gis, security, deployment
  README.md
```

## Key Docs
- docs/architecture/architecture.md
- docs/api/backend-api.md
- docs/ai/ai-module.md
- docs/gis/gis-module.md
- docs/security/security-design.md
- docs/deployment/local-deployment.md
- docs/demo/scenarios.md (demo scripts)
- docs/testing/bugs.md (open issues log)

## Scripts
- Backend: `npm run dev` | `npm run build` | `npm start` | `npm run seed`
- Frontend: `npm run dev` | `npm run build` | `npm run preview`
- AI service: `uvicorn main:app --reload --port 8001`

## Notes
- Models/weights are git-ignored (`models/`).
- Use `.env.example` templates per service; keep secrets out of git.
- PostGIS required; if Prisma migrate fails on shadow DB, set `PRISMA_MIGRATION_SKIP_SHADOW_DATABASE=1` and ensure PostGIS extension is enabled.
