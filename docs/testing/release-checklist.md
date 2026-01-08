# Release Validation Checklist

Use this checklist for final release validation and log outcomes in `docs/testing/bugs.md`.

## Auth & Core Flows

- [ ] Admin login + refresh token rotation
- [ ] Citizen OTP login and verification
- [ ] Agency staff login and incident list access

## Notifications

- [ ] Twilio SMS send (OTP + high-severity alert)
- [ ] Web push (VAPID) permission + receive notification
- [ ] Fallback behavior when keys are missing (logs, no crash)

## AI & GIS

- [ ] AI `/health` returns `model` + metadata
- [ ] AI classify returns category + summary
- [ ] GIS boundaries load for admin, scoped for agency staff
- [ ] Duplicate check returns results and respects auth

## Admin Console & Dispatch

- [ ] Agency activation/deactivation guards
- [ ] User deactivation respects responder assignment constraints
- [ ] Incident dispatch, respond, resolve emit audit logs

## Offline/PWA

- [ ] Responder PWA loads, syncs, and reconnects after offline
- [ ] Notifications handled after reconnect (if enabled)

## Performance Targets (post-tuning)

- [ ] Request p95 <= 800ms, p99 <= 2500ms under smoke load
- [ ] DB p95 <= 300ms, p99 <= 800ms
- [ ] AI p95 <= 1500ms, p99 <= 2500ms
- [ ] Request 5xx error rate <= 0.2%
