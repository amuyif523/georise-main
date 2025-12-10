# GEORISE Local Test Guide (Dev Stack)

This walks you through starting services locally, logging in with seeded accounts, and what to click on each page to verify the flows.

## 1) Prereqs
- Docker running
- Node installed
- Ports:
  - DB: host 54320
  - Backend: 4000
  - Frontend: 5173

## 2) Start the database
```powershell
cd infra
docker compose up -d db
docker ps   # confirm db is 0.0.0.0:54320->5432
```

## 3) Start backend
```powershell
cd backend
npm install
npm run dev
```
- Backend runs at http://localhost:4000

## 4) Start frontend
```powershell
cd ../frontend
npm install --legacy-peer-deps   # if npm install complains
npm run dev -- --host
```
- Frontend runs at http://localhost:5173
- Clear `georise_token` from localStorage before testing to avoid expired JWTs.

## 5) Seed data (if needed after a reset)
```powershell
cd ../backend
npx prisma db seed
```
Seeded accounts:
- Admin: admin@example.com / password123
- Agency: police1@example.com / password123
- Citizen: citizen1@example.com / password123

## 6) Test flows by role

### Admin (http://localhost:5173/login)
1) Login as admin@example.com / password123.
2) Dashboard: check cards load. Click:
   - Manage agencies (Agencies page loads)
   - Manage users (Users page loads)
   - Audit logs (Audit page loads)
   - Analytics (Analytics page loads)
3) Agencies: list renders; selecting an agency shows boundary editor; Save boundary should not crash.
4) Users: table renders; you can view details (no errors).
5) Verification: list of pending verifications; no errors on load.
6) Review Queue: incidents pending review list loads.
7) Activity Feed: should load without 500s.
8) Analytics: charts load; no blank/white screen.
9) Audit: table loads; no errors.
10) Demo Control: buttons render (don’t need to run them unless desired).

#### Boundary workflow (admin)
1) Go to Agencies.
2) Click an agency row; the map and “Select boundary” control appear.
3) On the map, draw a polygon using the drawing tool (rectangle or free polygon).
4) Click “Save boundary” (or equivalent) to persist. No errors should appear.
5) Validation: boundaries are stored in DB (geometry column on Agency). You can also hit backend GET `/api/gis/boundaries` (dev mode) to confirm it returns without 500s.
6) Extra check: ensure no 500s in browser console when selecting/drawing/saving; reload the page and verify the agency still shows the saved boundary (if the UI supports reloading the shape).

### Agency Staff (http://localhost:5173/login)
1) Login as police1@example.com / password123.
2) Dashboard: incidents list loads; no errors.
3) Map: loads without errors (even if no boundaries visible); incidents appear if seeded.
4) Analytics: loads charts; no errors.
5) Other links in sidebar: should not 404/500.

### Citizen (http://localhost:5173/login)
1) Login as citizen1@example.com / password123.
2) Dashboard: loads with buttons/links; no errors.
3) Report Incident: form loads; can submit (if backend running and logged in).
4) My Reports: table loads (seeded incidents may show).

## 7) Backend health checks
- Health: http://localhost:4000/health should return JSON {status: "ok", service: ...}
- If login fails with DB error, ensure db container is up and env DATABASE_URL points to localhost:54320.

## 8) Common fixes during testing
- Expired token: Clear `georise_token` in browser and re-login.
- Port in use (4000/54320/5173): stop conflicting process or change port in .env and restart.
- If boundaries request 500s: ensure DB has run all migrations and seed; GIS endpoints now use SubCity/Woreda tables.

## 9) Stop services
```powershell
cd infra
docker compose down
```
