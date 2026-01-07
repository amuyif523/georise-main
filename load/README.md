# Load Testing (Sprint D)

This folder contains lightweight smoke + regression load scenarios.

## Artillery (smoke)

Prereqs:

- Backend running at `http://localhost:4000`
- Admin + agency staff users created (see `backend/scripts/seedLoadUsers.ts`)

Run:

```
set ADMIN_EMAIL=admin_load@example.com
set ADMIN_PASSWORD=loadpass123
set AGENCY_EMAIL=agency_load@example.com
set AGENCY_PASSWORD=loadpass123
npx artillery run load/artillery.smoke.yml
```

## Locust (richer flows)

Prereqs:

- Same users as above

Run:

```
set ADMIN_EMAIL=admin_load@example.com
set ADMIN_PASSWORD=loadpass123
set AGENCY_EMAIL=agency_load@example.com
set AGENCY_PASSWORD=loadpass123
locust -f load/locustfile.py --headless -u 30 -r 5 -t 5m --host http://localhost:4000
```

## Baselines

Store run outputs in `load/baselines/` with a short note about DB/Redis settings and schema version.
