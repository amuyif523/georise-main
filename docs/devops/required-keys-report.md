# Required External API Keys

This document lists all third-party API keys and secrets required to run the GeoRise platform in a production environment.

## 1. Mapbox (Frontend)

- **Variable**: `VITE_MAPBOX_TOKEN`
- **File**: `frontend/.env`
- **Purpose**: Rendering interactive maps in the Citizen Dashboard.
- **Action**: Create an account at [Mapbox](https://www.mapbox.com/), generate a public access token, and add it.

## 2. Twilio (Backend - SMS)

- **Variables**:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_FROM_NUMBER`
- **File**: `backend/.env`
- **Purpose**: Sending emergency SMS alerts and verification codes.
- **Action**: Create an account at [Twilio](https://www.twilio.com/), purchase a number, and obtain credentials.

## 3. Email / SMTP (Backend - Email)

- **Variables**:
  - `EMAIL_SERVER_HOST`
  - `EMAIL_SERVER_PORT`
  - `EMAIL_SERVER_USER`
  - `EMAIL_SERVER_PASSWORD`
  - `EMAIL_FROM`
- **File**: `backend/.env`
- **Purpose**: Sending authentication emails and system notifications.
- **Action**: Use a provider like SendGrid, AWS SES, or a standard SMTP server.

## 4. Google Routes (Backend - Optional)

- **Variable**: `GOOGLE_ROUTES_API_KEY`
- **File**: `backend/.env`
- **Purpose**: Fallback or primary routing provider if OSRM is not used.
- **Action**: Enable Routes API in Google Cloud Console and generate a key.

## 5. VAPID Keys (Push Notifications)

- **Variables**:
  - `VAPID_PUBLIC_KEY` (Backend & Frontend)
  - `VAPID_PRIVATE_KEY` (Backend)
  - `VAPID_SUBJECT` (Backend)
- **File**: `backend/.env`, `frontend/.env`
- **Purpose**: Web Push Notifications.
- **Action**: Generate these using `npx web-push generate-vapid-keys` if the dev keys are not suitable for production.

## 6. HuggingFace (AI Service - Optional)

- **Variable**: `HF_TOKEN`
- **File**: `ai-service/.env`
- **Purpose**: Downloading gated models or using their inference API.
- **Action**: Generate a token in HuggingFace settings.
