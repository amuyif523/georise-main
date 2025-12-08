# Security Design (Snapshot)

- Auth: JWT access (short-lived) + refresh (tokenVersion), RBAC middleware.
- Lockout: failedLoginAttempts + lockedUntil persisted in DB; rate limits on auth + global.
- Validation: Zod on auth/register/login, incident create; admin/boundary params validated.
- Headers/Transport: helmet, CORS restricted to CLIENT_ORIGIN, compression, JSON size limit.
- Abuse: per-user incident burst limit, audit logs on critical actions, admin confirmations in UI.
- Offline: incident queue in localStorage; caution noted about moving to httpOnly cookies in production.
