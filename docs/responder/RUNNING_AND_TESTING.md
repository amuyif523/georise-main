# Responder System: Running & Testing Guide

This comprehensive guide covers how to set up the environment, seed the database, start the application, and verify the Interactive Dispatch and Responder Tracking features.

## 1. Environment Setup

### Prerequisites

- Node.js (v18+)
- Docker & Docker Compose
- Python 3.8+
- PostgreSQL Client (optional)

### Step 1: Configuration (.env)

We have pre-filled `backend/.env` with development secrets.

**To regenerate VAPID keys (for Push Notifications):**

```bash
cd backend
npx web-push generate-vapid-keys
# Copy Output Public and Private keys to .env
```

**To enable Real SMS (Optional):**

1. Get Twilio Account SID & Auth Token.
2. Update `.env`:
   - `SMS_PROVIDER=twilio`
   - `TWILIO_ACCOUNT_SID=...`
   - `TWILIO_AUTH_TOKEN=...`
   - `TWILIO_FROM_NUMBER=...`

### Step 2: Start Infrastructure (DB & Redis)

The backend requires PostgreSQL (Port 54320) and Redis (Port 6379).

```bash
cd infra
docker-compose up -d
```

### Step 2: Start AI Service

The backend relies on the AI service (Port 8001) for incident classification.

```bash
cd ai-service
# First time setup:
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# Run service
uvicorn main:app --reload --port 8001
# Health check: http://localhost:8001/health
```

### Step 3: Backend Setup & Seeding

Initialize the database schema and populate it with test data.

```bash
cd backend
npm install

# 1. Push Schema to Database (Syncs models)
npx prisma db push

# 2. Seed Database (Creates Users, Agencies, Responders, Incidents)
npx prisma db seed

# 3. Start Backend Server (Port 4000)
npm run dev
```

### Step 4: Start Agency Portal (Frontend)

```bash
cd frontend
npm install
npm run dev
# Access at http://localhost:5173
```

### Step 5: Start Responder App

```bash
cd responder-app
npm install
npm run dev
# Access at http://localhost:5174 (Switch browser to mobile view)
```

---

## 2. Login Credentials

The seeding script populates the database with the following accounts. The password for all accounts is **`password123`**.

| Role                  | Email                         | Notes                                    |
| :-------------------- | :---------------------------- | :--------------------------------------- |
| **Super Admin**       | `admin@georise.com`           | Full system access.                      |
| **Police Admin**      | `police.admin@georise.com`    | Manages Police agency.                   |
| **Police Dispatcher** | `police.dispatch@georise.com` | Primary account for testing dispatch.    |
| **Fire Dispatcher**   | `fire.dispatch@georise.com`   | Fire department dispatch.                |
| **Medic Dispatcher**  | `medic.dispatch@georise.com`  | Ambulance dispatch.                      |
| **Gold Citizen**      | `dawit@gmail.com`             | Verified reporter with high trust score. |

---

## 3. Running Verification Scripts

Run these scripts from the `backend/` directory to verify core logic without the UI.

### A. Decline Re-Routing (Task 4)

Verifies that declining an incident triggers immediate re-recommendation.

```bash
npx tsx scripts/test-decline-rerouting.ts
```

### B. SLA Safety Net (Task 3)

Verifies that unacknowledged assignments are auto-declined after 90 seconds.

```bash
npx tsx scripts/test-sla-requeue.ts
```

### C. Dispatch Flow (Task 1 & 2)

Verifies the `acknowledge` and `decline` API endpoints.

```bash
npx tsx scripts/test-dispatch-flow.ts
```

### D. Workload Release (Task 8)

Verifies that resolving an incident resets the responder status to `AVAILABLE`.

```bash
npx tsx scripts/test-resolve-incident.ts
```

---

## 4. Manual Verification Steps

### Spatial Jitter Filter

1. **Setup**: Open Responder App (`http://localhost:5174`) and login as a responder (or create one).
2. **Action**: Use Chrome DevTools > Sensors to simulate small (<15m) and large (>15m) movements.
3. **Verify**: Check the Console. `responder:locationUpdate` events should **only** fire for large movements or after 60 seconds.

### Connection Heartbeat

1. **Setup**: Login as a Dispatcher on Frontend (`http://localhost:5173`) and open the Agency Map.
2. **Action**: Open Responder App in another tab, verify the responder status is `AVAILABLE` (Green).
3. **Action**: Close the Responder App tab.
4. **Verify**: Wait 5 minutes (or trigger `heartbeat.job.ts` manually). The status on the map should turn `OFFLINE` (Grey).

### Trajectory Visualization

1. **Setup**: Ensure a responder is active and moving (simulate via scripts or manual updates).
2. **Action**: Select the responder on the Agency Map.
3. **Verify**: A blue dotted line (breadcrumb trail) should appear behind the marker, showing the last 5 locations.
