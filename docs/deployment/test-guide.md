# GEORISE End-to-End Test & Demo Playbook (Local, Production-Style)

Use this as a literal checklist. Run commands in **PowerShell** from the repo root unless stated otherwise.

## 1) Prereqs
- Docker Desktop running.
- Ports free: 4000 (backend), 8001 (AI), 4173 (frontend preview).
- Model files present on host at `ai-service/models/afroxlmr_incident_classifier/` (mounted into the AI container).

## 2) Build Apps (one-time, optional if already green)
```powershell
# Backend TypeScript build
cd backend
npm run build

# Frontend Vite build
cd ../frontend
npm run build
```

## 3) Start the Production Stack (Docker Compose)
Run from repo root:
```powershell
cd infra
docker compose -f docker-compose.prod.yml up -d --build
```
Notes:
- Backend image builds quickly.
- AI service downloads PyTorch; allow time. If it times out, rerun the same command; downloads are cached.
- The AI model is not baked into the image; it is mounted from `../ai-service/models`.

## 4) Verify Containers
```powershell
docker ps
```
You should see services: `georisem-db`, `infra-backend`, `infra-ai-service`.

## 5) Health Checks
- Backend: in browser or curl `http://localhost:4000/health`
- AI service: `http://localhost:8001/health`
- DB tables (optional):
```powershell
docker exec -it georisem-db psql -U georisem -d georisem_db -c "\dt"
```

## 6) Frontend Preview (local)
```powershell
cd ../frontend
npm run preview
```
Open the printed URL (usually `http://localhost:4173`). Frontend uses `VITE_API_URL=http://localhost:4000/api` from `.env.production`.

## 7) Demo Accounts (check in DB)
List users:
```powershell
docker exec -it georisem-db psql -U georisem -d georisem_db -c 'SELECT id,email,role FROM "User";'
```
Typical demo creds (adjust if your DB differs):
- Admin: `admin@example.com` / `password123`
- Agency staff: `police1@example.com` / `password123`
- Citizen: `citizen@example.com` / `password123`

## 8) Admin Flow (Command Theme)
1. Log in as Admin (`admin@example.com`).
2. Demo Control:
   - Go to Admin Demo page (route might be `/admin/demo` in the command layout).
   - Click “Reset Demo Data”.
   - Click “Seed Addis Scenario 1”.
   - Purpose: populate incidents, responder units, assignments for a clean demo.
3. Analytics:
   - Go to Admin Analytics (`/admin/analytics`).
   - Confirm KPI cards show numbers; trend/status/category charts render.
4. (Optional) Audit/Users/Agencies pages:
   - Confirm tables load; badges/roles display.

## 9) Agency Flow (Command Theme)
1. Log in as agency staff (`police1@example.com`).
2. Dashboard/Queue:
   - See incident table with Severity badges.
   - If seeded, you’ll see demo incidents; otherwise, create one as citizen first.
3. Map:
   - Open Agency Map (e.g., `/agency/map`).
   - Confirm markers; if boundaries loaded, polygons appear.
4. Dispatch suggestion:
   - Select an incident → “Suggested Dispatch” card should show a recommendation.
   - Click “Accept Recommendation” to assign.
5. Analytics:
   - Open Agency Analytics (`/agency/analytics`) and confirm KPIs/charts scoped to the agency.

## 10) Citizen Flow (Calm Theme)
1. Log in as Citizen (`citizen@example.com`).
2. Dashboard:
   - Light theme, “Report Emergency” entry point.
   - “My Reports” shows existing reports or an EmptyState if none.
3. Report Incident:
   - Submit a new incident (title/description/location). Success message appears.
   - If offline, the offline queue stores it; when back online, it syncs automatically.
4. My Reports:
   - Confirm the new incident appears with status.

## 11) API Spot Checks (optional, from PowerShell)
```powershell
# Backend health
curl http://localhost:4000/health

# AI classify test
curl -X POST http://localhost:8001/classify ^
  -H "Content-Type: application/json" ^
  -d "{\"title\":\"fire near bole\",\"description\":\"smoke from apartment\"}"
```
Expect JSON with `predicted_category`, `severity_score`, `confidence`.

## 12) Data Validation (optional, via psql)
- Incidents count:
```powershell
docker exec -it georisem-db psql -U georisem -d georisem_db -c 'SELECT COUNT(*) FROM "Incident";'
```
- Demo incidents:
```powershell
docker exec -it georisem-db psql -U georisem -d georisem_db -c 'SELECT COUNT(*) FROM "Incident" WHERE "isDemo"=true;'
```
- Check geometry column:
```powershell
docker exec -it georisem-db psql -U georisem -d georisem_db -c '\d "Incident"'
```
Look for `location | geometry(Point,4326)` and index `incident_location_geom_idx`.

## 13) Stopping/Reset
- Stop stack:
```powershell
cd infra
docker compose -f docker-compose.prod.yml down
```
- Wipe demo data (Admin UI → Demo Control → Reset Demo Data).

## 14) Common Troubleshooting
- AI build slow: it downloads Torch; rerun compose if timeout. The model is mounted, not built-in.
- CORS: If you host frontend elsewhere, set backend CORS origins in app.ts.
- Ports busy: stop other services on 4000/8001/4173.
- Missing agency for staff: ensure an `agencyStaff` row links the user to an agency; otherwise, agency routes may 403.

## 15) Deployment Reminder
- `backend/.env.production`: keep a long `JWT_SECRET`, correct `DATABASE_URL`, `AI_SERVICE_URL`.
- `frontend/.env.production`: set `VITE_API_URL` to your deployed API URL when you have one.
- Use `docker-compose.prod.yml` for prod-like runs; mount the AI model via the volume already defined.

This playbook covers: building, running, health checks, logins, core UI flows (admin/agency/citizen), API checks, and demo seeding. Follow in order for a smooth, “idiot-proof” demo. 
