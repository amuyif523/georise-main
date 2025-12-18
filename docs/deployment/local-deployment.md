# Local Deployment Guide

Prereqs: Node 20+, Python 3.10+, Docker Desktop (PostGIS), Git, npm, pip.

1. Infra

```
cd infra
docker compose up -d
```

2. Backend

```
cd ../backend
cp .env.example .env
npm install
npx prisma migrate dev
npm run dev
```

3. AI Service

```
cd ../ai-service
cp .env.example .env
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

4. Frontend

```
cd ../frontend
cp .env.example .env
npm install
npm run dev
```

Optional: seed demo data

```
cd backend
npx prisma db seed
```

Demo logins

- Admin: admin@example.com / password123
- Agency (Police): police1@example.com / password123
- Citizen: citizen1@example.com / password123
