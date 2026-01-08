# Production Secrets & Credentials

Use a secrets manager (AWS SSM, Vault, Doppler, GitHub Actions Secrets). Do not commit real keys.

## Twilio (SMS/OTP)

Required:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `SMS_PROVIDER=twilio`

Notes:

- Use a messaging service SID if you prefer rate control.
- Validate OTP delivery against production numbers.

## Web Push (VAPID)

Generate keys once per environment:

```
npx web-push generate-vapid-keys
```

Store:

- `VAPID_PUBLIC_KEY` (frontend: `VITE_VAPID_PUBLIC_KEY`)
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (e.g., `mailto:ops@yourdomain.com`)

## FCM / Mobile Push

Decision: FCM is not wired yet. Track as a future enhancement and keep placeholders in env files for planning.

## JWT + DB

- `JWT_SECRET`, `JWT_REFRESH_SECRET`: 64+ char random strings.
- `DATABASE_URL`: rotate credentials on release; store in secrets manager.

## Rotation Plan

- Rotate Twilio auth tokens quarterly.
- Rotate JWT secrets when required and invalidate refresh tokens.
- Document any rotation in the QA log.
