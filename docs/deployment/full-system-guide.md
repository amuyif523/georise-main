# GEORISE Full-System Runbook (Local Dev)

This runbook covers bringing up all services (PostGIS, Redis, backend, AI, citizen/admin UI, responder UI) and how to validate them with manual and automated tests.

## Prerequisites

- Docker Desktop running (PostGIS + Redis)
- Node.js 20+
- Python 3.10+
- npm and pip
- Open ports: DB `54320`, Redis `6379`, backend `4000`, frontend `5173`, responder UI `5174`, AI `8001`

## Environment Files (one-time)

- Backend: `cp backend/.env.example backend/.env`
- Frontend: `cp frontend/.env.example frontend/.env`
- Responder app: `cp responder-app/.env.example responder-app/.env`
- AI service: `cp ai-service/.env.example ai-service/.env`

Minimum values to verify locally:

- Backend `.env`: `DATABASE_URL`, `AI_ENDPOINT=http://localhost:8001/classify`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `REDIS_URL=redis://localhost:6379`
- Frontend `.env`: `VITE_API_BASE_URL=http://localhost:4000/api`, optional `VITE_VAPID_PUBLIC_KEY` for push
- Responder `.env`: `VITE_API_BASE_URL=http://localhost:4000/api`
- AI `.env`: defaults are fine unless you change model path/port

Optional for real messaging:

- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, set `SMS_PROVIDER=twilio`
- Web Push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- Secrets guidance: see `docs/deployment/production-secrets.md`

## Start Order (separate terminals)

1. **Infra (PostGIS + Redis)**

```powershell
cd infra
docker compose up -d
```

2. **Backend API**

```powershell
cd backend
npm install
npx prisma migrate deploy       # apply existing migrations only (no prompts)
npx prisma db seed              # demo data: agencies, staff, responders, incidents
npm run dev                     # serves http://localhost:4000
```

If you intentionally changed `prisma/schema.prisma` and need a new migration, run:

```powershell
npx prisma migrate dev --name your_migration_name
```

Otherwise, use `migrate deploy` to avoid interactive prompts.

3. **AI Service**

```powershell
cd ai-service
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

If you have fine-tuned AfroXLMR weights, place them under `ai-service/models/afroxlmr_incident_classifier`. Otherwise the service falls back to the base model.

4. **Citizen/Admin Frontend**

```powershell
cd frontend
npm install
npm run dev -- --host           # http://localhost:5173
```

5. **Responder PWA**

```powershell
cd responder-app
npm install
# script already includes --host; pass a value + port
npm run dev -- --host 0.0.0.0 --port 5174
```

## Seeded Demo Accounts

- Admin: `admin@example.com` / `password123`
- Agency: `police1@example.com` / `password123`
- Fire: `fire1@example.com` / `password123`
- Medical: `medical1@example.com` / `password123`
- Traffic: `traffic1@example.com` / `password123`
- Citizens: `citizen1@example.com`, `citizen2@example.com`, `citizen3@example.com` (all `password123`)

## Manual Smoke (all roles)

1. **Admin (http://localhost:5173)**
   - Login as admin; dashboard cards load.
   - Agencies page shows the boundary editor and multiple seeded agencies; saving a polygon should not 500.
   - Analytics charts render; Review/Verification queues load; Activity Feed renders; System Status shows DB/Redis/AI up.
2. **Citizen**
   - Login as citizen1; submit a new incident via the wizard (optionally attach a photo).
   - Verify success toast and the entry appears in My Reports.
3. **Agency staff (e.g., police1)**
   - Map loads with seeded incidents; list populates.
   - Open an incident, post a chat message, test merge/share controls.
   - If UI exposes simulation toggle, start it and observe responder markers moving.
4. **Responder PWA (http://localhost:5174)**
   - Login with an agency account; ensure location permission prompt appears.
   - Confirm assignments/updates render; watch console for socket connect.
5. **Crisis mode check**
   - Admin toggles crisis mode ON (System page); citizen tries a low-priority/hazard submission and sees the restriction message.
6. **Proximity/push check (optional)**
   - With VAPID keys and notification permission granted, create a high-severity approved incident near a user; expect a browser notification or socket alert.

## Automated Tests

**Backend** (DB/Redis containers up)

```powershell
cd backend
npm run test:db:reset   # migrate + seed test DB
npm run test            # unit/integration
npm run test:coverage   # coverage
```

Tip: adjust `backend/.env.test` if you want a separate test database.

**Frontend (unit/UI)**

```powershell
cd frontend
npm run test
npm run test:coverage
```

**Frontend E2E (Playwright)**

```powershell
cd frontend
# backend + DB seeded and running
E2E_BASE_URL=http://localhost:5173 npm run e2e     # headless
E2E_BASE_URL=http://localhost:5173 npm run e2e:ui  # interactive
```

**AI Service sanity**

```powershell
cd ai-service
.\venv\Scripts\activate
python -m pytest test_amharic.py                  # smoke UTF-8 + inference path
python training/validate_dataset.py --data data/incidents_labeled.csv --extra data/incidents_am_aug.csv
python training/evaluate_model.py --model models/afroxlmr_incident_classifier --data data/incidents_labeled.csv --extra_data data/incidents_am_aug.csv --batch 8 --save_report models/afroxlmr_incident_classifier/eval_report.json
python test_amharic_golden.py                     # golden-set regression (AI on :8001)
```

## Health & Troubleshooting

- Backend: `GET http://localhost:4000/system/health`
- AI: `GET http://localhost:8001/health`
- If login fails: ensure DB container is running and `DATABASE_URL` points to `localhost:54320`.
- If rate limits trigger unexpectedly: confirm Redis is up and `REDIS_URL` matches `redis://localhost:6379`.
- 429 Too Many Requests during `/auth/login` or `/auth/me`: the auth limiter (10 requests/hour/IP) is firing. In dev, either slow down login retries, restart the backend to reset in-memory counters, or flush Redis (`redis-cli flushall`) if using the Redis store.
- Push/SMS optional: without VAPID/Twilio keys the app logs/simulates notifications instead of sending.
- Prisma prompts for a migration when schema changes are detected; use `npx prisma migrate deploy` to apply existing migrations without creating new ones.
- I18n: language toggle persists via localStorage; during QA you can inspect `localStorage["i18n_missing_keys"]` to spot untranslated strings; run UI in Amharic and verify text fits (no overflow).
- AI eval: if `numpy`/PyTorch mismatch errors appear, pin `numpy<2` in the venv (`pip install 'numpy<2' --upgrade`), then rerun the AI tests above.

## Production Notes

- Use `infra/docker-compose.prod.yml` as a baseline and override with real secrets.
- Mount AI weights into `ai-service/models/` or the service falls back to base model.
- Backup/restore notes are in `docs/deployment/backup-restore.md`.

## Stopping Services

```powershell
cd infra
docker compose down
```
