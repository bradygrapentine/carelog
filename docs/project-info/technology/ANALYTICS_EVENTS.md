# Carelog — PostHog Analytics Events

Audit date: 2026-04-14. Source: `grep -rn "posthog.capture" apps/web/ apps/mobile/`.

> **PHI rule:** `distinctId` must be a UUID or opaque token. `contact_form_submitted` previously used `email` as `distinctId` — ✅ Fixed in PR #44 (now uses `crypto.randomUUID()` as `distinctId`).

---

## Event inventory

| Event name | Web | Mobile | Notes |
|---|---|---|---|
| `sign_in_otp_requested` | ✅ | ❌ | `apps/web/app/signin/SignInForm.tsx` |
| `sign_in_completed` | ✅ | ❌ | `apps/web/app/signin/SignInForm.tsx` |
| `care_team_created` | ✅ | ❌ | `apps/web/app/onboarding/OnboardingForm.tsx` (client-side) |
| `care_team_created_server` | ✅ | ❌ | `apps/web/app/api/onboarding/create/route.ts` (server-side duplicate) |
| `dashboard_viewed` | ✅ | ❌ | `apps/web/app/(app)/dashboard/DashboardViewTracker.tsx` |
| `daily_brief_viewed` | ✅ | ❌ | `apps/web/app/brief/[shareToken]/page.tsx` |
| `journal_entry_submitted` | ✅ | ❌ | `apps/web/app/(app)/journal/[recipientId]/JournalEntryForm.tsx` |
| `burnout_checkin_submitted` | ✅ | ❌ | `apps/web/app/(app)/journal/[recipientId]/BurnoutCheckin.tsx` |
| `care_history_exported` | ✅ | ❌ | `apps/web/app/(app)/journal/[recipientId]/ExportButton.tsx` |
| `document_uploaded` | ✅ | ❌ | `apps/web/app/api/documents/upload/route.ts` |
| `ocr_job_started` | ✅ | ❌ | `apps/web/app/api/ocr/upload/route.ts` |
| `ocr_review_confirmed` | ✅ | ❌ | `apps/web/app/api/ocr/confirm/route.ts` |
| `invite_sent` | ✅ | ❌ | `apps/web/app/api/invite/route.ts` |
| `invite_accepted` | ✅ | ❌ | `apps/web/app/api/invite/[token]/accept/route.ts` |
| `push_notification_registered` | ✅ | ❌ | `apps/web/app/api/push/register/route.ts` |
| `checkout_started` | ✅ | ❌ | `apps/web/app/api/stripe/checkout/route.ts` |
| `checkout_completed` | ✅ | ❌ | `apps/web/app/api/stripe/webhook/route.ts` |
| `subscription_updated` | ✅ | ❌ | `apps/web/app/api/stripe/webhook/route.ts` |
| `subscription_cancel_initiated` | ✅ | ❌ | `apps/web/app/(app)/subscriptions/page.tsx` |
| `billing_portal_opened` | ✅ | ❌ | `apps/web/app/api/stripe/portal/route.ts` |
| `contact_form_submitted` | ✅ | ❌ | `apps/web/app/api/contact/route.ts` — ✅ PHI fixed in PR #44 |
| `$exception` | ✅ | ❌ | Stripe webhook, onboarding create, invite routes |

**Total: 22 event types** — all Web-only; Mobile has zero PostHog instrumentation.

---

## Web-only events (no mobile equivalent)

All 22 events above are web-only.

## Mobile-only events

None — mobile has no PostHog calls.

## Events in both platforms

None — mobile has no PostHog instrumentation.

---

## Known issues / action items

| Severity | Issue | File | Suggested fix |
|---|---|---|---|
| ✅ Fixed (PR #44) | `contact_form_submitted` used `email` as `distinctId` | `apps/web/app/api/contact/route.ts:59` | Now uses `crypto.randomUUID()` as `distinctId` |
| 🟡 Duplicate | `care_team_created` fires on both client and server | `OnboardingForm.tsx` + `api/onboarding/create/route.ts` | Remove the client-side fire; server-side is authoritative |
| 🟡 Gap | Mobile has zero analytics coverage | `apps/mobile/` | Add PostHog React Native SDK and port key events (sign_in, journal_entry_submitted, burnout_checkin_submitted) |
