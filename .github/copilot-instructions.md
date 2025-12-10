# GEORISE Project Instructions

## Architecture Overview
- **Monorepo Structure:**
  - `frontend/`: React + Vite + Tailwind + Leaflet (PWA capabilities).
  - `backend/`: Node.js + Express + Prisma (PostgreSQL + PostGIS).
  - `ai-service/`: Python FastAPI (AfroXLMR model for incident classification).
  - `infra/`: Docker Compose for PostgreSQL/PostGIS.

## Core Workflows
- **Development:**
  - Backend: `npm run dev` (Port 4000).
  - Frontend: `npm run dev` (Port 5173).
  - AI Service: `uvicorn main:app --reload --port 8001`.
  - Database: `docker compose up -d` (in `infra/`).
- **Database Management:**
  - Migrations: `npx prisma migrate dev`.
  - Seeding: `npx prisma db seed` (Populates agencies, users, and demo incidents).
  - **GIS Note:** Uses `postgis` extension. Raw SQL (`prisma.$executeRaw`) is often required for spatial operations (e.g., `ST_MakePoint`, `ST_Buffer`).

## Code Conventions
### Frontend
- **Layouts:**
  - **Unified Layout:** Use `AppLayout` for ALL pages (Admin, Agency, Citizen).
  - `AppLayout` handles role-based navigation via `AppSidebar`.
  - **Do not use** `CommandLayout`, `CitizenLayout`, or `PageWrapper` (deprecated/unused).
- **State Management:** Context API (`AuthContext`) for auth.
- **Maps:** `react-leaflet` with `react-leaflet-cluster`.
- **Styling:** Tailwind CSS with DaisyUI. "Cyber" theme for Command Center.

### Backend
- **Modular Structure:** `src/modules/{domain}/` (e.g., `incident`, `dispatch`, `auth`).
  - Each module contains: `*.controller.ts`, `*.service.ts`, `*.routes.ts`.
- **Type Safety:**
  - **Avoid `any`**. Use generated Prisma types (`Incident`, `User`) or Zod schemas.
  - Request objects should be typed (extend `Express.Request`).
- **GIS Operations:**
  - Store coordinates as `Float` (lat/lng) AND `geometry` (PostGIS).
  - Use `prisma.$queryRaw` for spatial queries (e.g., "find nearby").

### AI Service
- **Model:** AfroXLMR (fine-tuned).
- **Fallback:** Loads base model if fine-tuned weights are missing.

## Integration Points
- **Frontend -> Backend:** `src/lib/api.ts` (Axios instance with interceptors).
- **Backend -> AI:** HTTP calls to `http://localhost:8001`.
- **Real-time:** Socket.IO for live incident updates and responder tracking.
