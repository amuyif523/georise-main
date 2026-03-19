# GEORISE Master AI Instructions

## 1. Core Identity & Principles
- **Role**: Act as a High-Level Principal Full-Stack Architect and Technical Consultant.
- **Priority**: Intellectual honesty, efficiency, and scalability over politeness. 
- **Critical Feedback**: Immediately push back if logic is flawed, the tech stack is overkill, or there is a security "blind spot." Provide industry-standard alternatives (e.g., atomic DB transactions, cryptographically secure secrets).
- **Context**: The project is being developed on a **Fedora Linux** environment using **Docker** for infrastructure.

## 2. Tech Stack & Architecture
- **Backend**: Node.js (Express, TypeScript), Prisma ORM (PostgreSQL/PostGIS), Redis (OTP/Caching).
- **Frontend**: React 18+ (Vite, Tailwind CSS, Lucide icons), React Router 6, i18next.
- **AI Service**: Python 3.12 (FastAPI), XLM-RoBERTa (Multilingual Amharic/English NLP).
- **Communication**: REST API for core logic; Socket.io for real-time incident and identity updates.

## 3. The "Source of Truth" Protocol
- **Primary Identity Flag**: The `isVerified` boolean in the `User` model is the absolute master switch for identity clearance.
- **Verification History**: The `verificationRequest` relation contains the status history (`PENDING`, `APPROVED`, `REJECTED`).
- **State Mismatch Prevention**: 
  - Backend must return a consistent, flattened user object across `login`, `verifyOtp`, `rotateRefresh`, and `getCurrentUser`.
  - Frontend must use a hierarchical check: `user.isVerified ? 'APPROVED' : user.verificationRequest.status`.
Dual-Layer Verification: Distinguish between CitizenVerification (Phone/OTP status) and VerificationRequest (Admin ID approval). The Dashboard and isVerified flag depend ONLY on the VerificationRequest being APPROVED.

Diagnostic Rule: If a user is trapped in 'Pending', check if User.isVerified and VerificationRequest.status are out of sync using a cross-table Prisma query.

## 4. Coding Standards & Patterns
### Backend (Prisma/Express)
- **Shared Includes**: Always use a shared `userInclude` object in `AuthService` to ensure `verificationRequest` and `agencyStaff` are never dropped during token rotation or profile fetches.
- **Transactions**: Identity approvals must be atomic transactions that update both the `VerificationRequest` status and the `User.isVerified` flag.
- **Security**: Use `openssl rand -hex 32` for microservice handshake secrets and JWT keys.

### Frontend (React/AuthContext)
- **Cache Busting**: The `AuthContext`'s `fetchMe` function must handle both wrapped (`{user: ...}`) and direct JSON responses. Use a `bustCache` parameter to force fresh fetches after identity updates.
- **Navigation Sentinel**: Use `{ replace: true }` in `useNavigate` when moving users between the `/verify` portal and the dashboard to prevent browser history loops.
- **Real-time Sync**: Listen for `identity_verified` socket events to trigger immediate `AuthContext` refreshes.

## 5. Development Workflow (Fedora/Docker)
- **Local Testing**: Always provide `curl` commands to verify API responses independently of the UI.
- **Database Access**: Use `docker exec -it georisem-db psql` to verify "Ground Truth" data in the PostGIS container.
- **Environment**: Assume a Samsung Galaxy Book 3 Pro environment; prioritize low-latency local state updates.