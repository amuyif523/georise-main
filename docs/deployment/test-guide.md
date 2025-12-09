# GEORISE Local Run & Test Guide (Dev Mode)

Run everything locally with hot reloads. Commands are for **PowerShell** on this machine.

## 1) Prereqs
- Docker Desktop running.
- Ports free: 4000 (backend), 8001 (AI), 5173 (frontend).
- Database container running (PostGIS). If you don’t have it up:
  ```powershell
  cd infra
  docker compose up -d   # uses your dev compose
  ```
  Ensure DB is reachable at the host/port your `.env` expects (often `localhost:55432`).

## 2) Backend (Node/TypeScript)
```powershell
cd backend
npm install   # first time only
npm run dev   # starts ts-node-dev on port 4000
```
Health check: http://localhost:4000/health

## 3) AI Service (FastAPI)
```powershell
cd ai-service
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```
Health check: http://localhost:8001/health

## 4) Frontend (Vite)
```powershell
cd frontend
npm install   # first time only
npm run dev   # prints URL, usually http://localhost:5173
```
Make sure `frontend/.env` (or `.env.production` if reused) has:
```
VITE_API_URL=http://localhost:4000/api
```

## 5) Demo Logins (check actual users in DB)
List users:
```powershell
docker exec -it georisem-db psql -U georisem -d georisem_db -c 'SELECT id,email,role FROM "User";'
```
Typical demo credentials (adjust if your DB differs):
- Admin: admin@example.com / password123
- Agency: police1@example.com / password123
- Citizen: citizen@example.com / password123

## 6) Admin Flow (Command Theme)
1. Log in as Admin.
2. Demo Control (if present):
   - “Reset Demo Data”
   - “Seed Addis Scenario 1”
3. Analytics:
   - Open Admin Analytics; confirm KPI cards and charts render.
4. (Optional) Audit/Users/Agencies pages: tables load, badges show roles/status.

## 7) Agency Flow (Command Theme)
1. Log in as agency staff.
2. Dashboard/Queue:
   - Incident table with Severity badges.
3. Map:
   - Agency Map shows markers; if boundaries configured, polygons appear.
4. Dispatch suggestion:
   - Select an incident → “Suggested Dispatch” card → Accept to assign.
5. Agency Analytics:
   - KPIs/charts scoped to that agency.

## 8) Citizen Flow (Calm Theme)
1. Log in as Citizen.
2. Dashboard:
   - Light theme, “Report Emergency” entry.
   - “My Reports” shows incidents or EmptyState.
3. Report Incident:
   - Submit; success message appears. If offline, queue syncs when back online.
4. My Reports:
   - New incident should appear with status.

## 9) API Spot Checks (optional)
```powershell
# Backend health
curl http://localhost:4000/health

# AI classify test
curl -X POST http://localhost:8001/classify `
  -H "Content-Type: application/json" `
  -d "{\"title\":\"fire near bole\",\"description\":\"smoke from apartment\"}"
```

## 10) Data Validation (optional, via psql)
- Incident count:
```powershell
docker exec -it georisem-db psql -U georisem -d georisem_db -c 'SELECT COUNT(*) FROM "Incident";'
```
- Demo incidents:
```powershell
docker exec -it georisem-db psql -U georisem -d georisem_db -c 'SELECT COUNT(*) FROM "Incident" WHERE "isDemo"=true;'
```
- Geometry column:
```powershell
docker exec -it georisem-db psql -U georisem -d georisem_db -c '\d "Incident"'
```
Look for `location | geometry(Point,4326)` and index `incident_location_geom_idx`.

## 11) Stop Services
- Stop backend/frontend/AI by closing their terminals.
- Stop DB (if needed):
```powershell
cd infra
docker compose down
```

## 12) Troubleshooting
- CORS: keep frontend pointing to `http://localhost:4000/api` in dev.
- Ports busy: stop other services on 4000/8001/5173.
- Agency 403: ensure the agency staff user has an `agencyStaff` row pointing to an agency.

This guide is purely for local dev mode (no production compose). Follow in order for a predictable setup and demo. 
