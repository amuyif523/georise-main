# I18n QA Checklist (Amharic/English)

Use this checklist for regression passes on language support and to catch missing strings.

## Setup

- Ensure `VITE_API_BASE_URL` and `VITE_VAPID_PUBLIC_KEY` are set; run frontend with `npm run dev`.
- Switch language via the UI toggle; ensure it persists after reload (localStorage).
- To inventory missing keys locally, check `localStorage["i18n_missing_keys"]` after navigating key flows.

## Citizen App

- Login/logout: headers, errors, buttons localized.
- Report Incident wizard: guidance text, placeholders, validation errors, crisis banner localized; errors render with proper wrapping.
- My Reports: table headers, statuses, empty states localized.
- Crisis mode banner localized when active.

## Admin/Agency

- Dashboard cards and nav labels localized.
- Agencies page: boundary editor instructions localized.
- Analytics: filters, export buttons, KPIs, chart titles localized.
- Review/Verification queues: table headers, empty/error states localized.
- System status/health: labels and statuses localized.

## Auth Recovery

- Forgot password: headings, helper text, button states, error/success alerts localized.
- Reset password: labels, placeholders, helper text, error/success alerts localized.

## Responder App (if enabled for i18n)

- Login form labels, errors, status messages localized.
- Assignment/arrival/resolution messages localized.
- Offline banners and install prompts localized.

## Accessibility

- Verify `<html lang>` updates when switching language.
- Screen reader alerts: important errors use `role="alert"` and `aria-live="assertive"`; successes use `role="status"` / `aria-live="polite"`.

## Missing Keys

- After exploring flows, inspect `localStorage["i18n_missing_keys"]` in DevTools for any keys to translate.

## Reporting

- Record screenshots (en/am) for key flows: login, report wizard (step 1–3), analytics, forgot/reset password.
- Log any truncation/overflow; note which component and locale.\*\*\*
