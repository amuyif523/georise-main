# GEORISE Project Instructions

## 1. Architecture & Monorepo Structure
- **`frontend/`**: Public/Admin web portal (React + Vite + Tailwind + Leaflet).
- **`responder-app/`**: Mobile-first PWA for field agents (React + Vite + Socket.IO).
- **`backend/`**: REST API & Socket.IO server (Node.js + Express + Prisma + PostGIS).
- **`ai-service/`**: Incident classification service (Python FastAPI + AfroXLMR).
- **`infra/`**: Docker Compose for PostgreSQL/PostGIS database.

## 2. Core Workflows & Commands
### Development
- **Backend**: `npm run dev` (Port 4000).
- **Frontend**: `npm run dev` (Port 5173).
- **Responder App**: `npm run dev` (Port 5174 - check console).
- **AI Service**: `uvicorn main:app --reload --port 8001`.
- **Database**: `docker compose up -d` (in `infra/`).

### Database & Simulation
- **Migrations**: `npx prisma migrate dev` (Backend).
- **Seeding**: `npm run seed` (Backend) - Populates agencies, users, and demo incidents.
- **Simulation**: `npm run simulate:responder` (Backend) - Simulates responder movement for testing live tracking.

## 3. Backend Conventions (`backend/`)
- **Modular Architecture**: `src/modules/{domain}/` (e.g., `incident`, `dispatch`, `auth`).
  - **Files**: `*.controller.ts`, `*.service.ts`, `*.routes.ts`.
  - **Validation**: Use `zod` schemas in `*.schema.ts` or inline with `validate` middleware.
- **Database Access**:
  - Use `prisma` client for standard CRUD.
  - Use `prisma.$queryRaw` for **PostGIS** spatial queries (e.g., `ST_DWithin`, `ST_Distance`).
  - **GeoJSON**: Store coordinates as `Float` (lat/lng) for API ease, but sync with `geometry` column for spatial queries.
- **Logging**: Use `src/logger.ts` (Pino) instead of `console.log`.

## 4. Frontend & Responder App Conventions
- **State Management**:
  - **Auth**: `AuthContext` (JWT storage, user role).
  - **Offline**: Use `idb-keyval` for caching incidents/forms when offline.
- **Maps (Leaflet)**:
  - Use `react-leaflet` components.
  - **Clustering**: `react-leaflet-cluster` for incident markers.
  - **Heatmaps**: `leaflet.heat` for analytics.
- **Styling**: Tailwind CSS + DaisyUI.
  - **Theme**: "Cyber" theme for Command Center; simpler themes for mobile.
- **Real-time**: `socket.io-client` for listening to `incident:new`, `responder:update`.

## 5. AI Service Integration (`ai-service/`)
- **API Contract**:
  - **Input**: `POST /classify` with `{ title: str, description: str }`.
  - **Output**: `{ predicted_category, severity_score, confidence }`.
- **Model Loading**: Checks `models/` directory; falls back to HuggingFace base model if local weights are missing.

## 6. Critical Integration Points
- **Authentication**: JWT-based. Backend `auth` middleware attaches user to `req.user`.
- **GIS Data**: Frontend sends `{ lat, lng }`; Backend converts to PostGIS `POINT(lng lat)`.
- **Dispatch Logic**:
  - **Auto-Assignment**: Backend `dispatch` module finds nearest available responder via PostGIS.
  - **Socket Events**: Backend emits events to specific rooms (e.g., `agency:{id}`, `responder:{id}`).

## 7. Common Pitfalls
- **PostGIS Syntax**: Remember PostGIS uses `(longitude, latitude)` order for points, while Leaflet uses `[latitude, longitude]`.
- **Prisma Types**: Always generate Prisma client after schema changes (`npx prisma generate`).
- **Env Variables**: Ensure `.env` exists in EACH service directory (`backend`, `frontend`, `ai-service`).
