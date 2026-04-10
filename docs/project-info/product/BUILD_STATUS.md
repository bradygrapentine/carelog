# Carelog — Build Status

Last updated: 2026-04-09 (Phase 3 complete)

## Completed and working

### Infrastructure
- [x] Turborepo monorepo — Next.js 16 + Expo SDK 55 + shared packages
- [x] Supabase local dev — all 16 tables, RLS, indexes, helper functions
- [x] Repository pattern — identity, events, orgs, memberships, medications
- [x] tRPC router — 13 routers, 40+ procedures, protected procedures
- [x] Service role key isolation — runtime guard + ESLint rule

### Auth
- [x] OTP sign-in — 6-digit code via Mailpit (local) / Resend (prod)
- [x] Session management — client-side pattern (see TECH_DEBT.md)
- [x] Sign out
- [x] Proxy (Next.js 16 middleware replacement)

### Onboarding
- [x] Create org + identity vault entry + care recipient + coordinator membership
- [x] Dashboard showing real care teams from Supabase

### Care journal
- [x] Entry form with mood tags (good/okay/difficult/crisis)
- [x] Live timeline — human entries styled differently from system events
- [x] Writes to Supabase via service role API route
- [x] Flag for doctor — PATCH /api/journal/[eventId]/flag, role-enforced (supporters blocked)
- [x] Supporter reactions — heart/thinking_of_you/strong/grateful, toggle, optimistic UI
- [x] Writing prompts — 12 prompts, 3 shown randomly on focus, tap to fill
- [x] Role-based UI — supporters read-only, coordinators invite, caregivers/aides post+flag

### Team coordinator
- [x] Team panel on journal page — shows members with role badges
- [x] Invite form — email + role selector (coordinator only)
- [x] POST /api/invite — creates membership + invite token
- [x] GET /api/invite/[token] — looks up invite details
- [x] POST /api/invite/[token]/accept — atomic Postgres function, validates + consumes + activates
- [x] /invite/[token] page — shows invite details, accept button
- [x] Pending invite redirect — sessionStorage bridge, DashboardClient bounces to invite URL
- [x] Entry detail view — full entry + reactions + flag status
- [ ] Team member display names (partially done — `/api/members` resolves names, UI shows them)

### Weekly digest
- [x] Inngest wired — client at `apps/web/inngest/client.ts`, serve at `/api/inngest`
- [x] Resend wired — `apps/web/server/resend.server.ts` (null-safe for local dev)
- [x] Weekly digest function — cron Mon 8am UTC, per-org steps, HTML email

### Testing
- [x] Vitest unit tests — 587 tests (all passing)
- [x] pgTAP RLS tests — 11 test files, all passing
- [x] Playwright E2E — journal flow, reactions, flagging, roles, invites (25+ tests)

## Phase 1 remaining

- [ ] Display name resolution — show actual names not "Team member" (API ready, UI wiring partial)

## Phase 2 — Scheduler

- [x] Shift model + tRPC router — `server/routers/shifts.ts`
- [x] Shift creation UI — `ShiftForm.tsx`
- [x] Shift list / caregiver view — `ShiftList.tsx`
- [x] Coverage settings — `CoverageSettings.tsx`, `server/routers/coverageWindows.ts`
- [x] Gap detector — `inngest/functions/gapDetector.ts` (daily 6am UTC)
- [x] Recurring shifts — ShiftForm "Repeat weekly for N weeks" toggle, bulk insert, cancel series
- [x] Weekly digest shift section — "Here's who's helping this week" with assignee names

## Phase 3 — Medical

- [x] Medication catalog UI — `MedicationPanel.tsx`, tRPC medications router (list/create/update/delete)
- [x] Schedule + administration log — `MedicationChecklist.tsx`, listScheduled/todayLog/logAdministration
- [x] Prescription label scan — OCR pipeline via Inngest (`ocrPrescription.ts`, `OcrReviewPanel.tsx`)
- [x] Refill alert — Inngest daily cron 7am UTC (`refillAlert.ts`, idempotent, 5 tests)

## Phase 3 — Outer circle + care brief

- [x] Volunteer request board — `OuterCirclePanel.tsx`, tRPC outerCircle router, public `/care/[token]`
- [x] Share link — no account required (`claim_outer_circle_slot()` atomic fn, 409 on slot full)
- [x] Care brief generator — `POST /api/brief`, vault de-tokenized once, public `/brief/[token]`, revoke

## Phase 4 — Depth and retention

- [x] Symptom tracker — `SymptomPanel.tsx`, tRPC symptoms router (list/log), RLS-enforced, coordinator+caregiver write
- [x] Burnout tracker — `BurnoutCheckin.tsx`, tRPC burnout router (checkIn/myHistory/orgSummary), weekly check-in idempotent via UNIQUE constraint, burnoutAlert Inngest cron (Mon 8am UTC)
- [x] Full history export — `POST /api/export`, exportRequestSchema, PDF + JSON formats, coordinator-only, identity vault de-tokenization, ExportButton in JournalClient

## Phase 5 — Finances + documents

- [x] Shared expense log — `ExpensePanel.tsx`, tRPC expenses router (list/add), RLS-enforced, all org members
- [x] Benefits navigator — `BenefitsNavigator.tsx`, tRPC benefits router, eligibility screening for 5 programs, coordinator-only
- [x] Document vault — `DocumentVault.tsx`, `POST /api/documents/upload`, `GET /api/documents/[id]/download`, tRPC documentsRouter (list/delete), private `care-documents` Supabase Storage bucket, signed URLs (180s), coordinator upload/delete + all members read, MIME allowlist (PDF/JPEG/PNG/HEIC), 10 MB limit
- [x] End-of-life planner — `EolPlanner.tsx`, tRPC eolPlanRouter (get/upsert), coordinator-only RLS (completely invisible to other roles), advance directive links from document vault, upsert on recipient_id

## Marketing Shell

- [x] Landing page — HeroSection + FeatureGrid
- [x] About page
- [x] Pricing page — PricingCards component, $14/mo plan
- [x] Contact page — form via Resend /api/contact
- [x] Privacy + Terms pages with LegalPageLayout

## UI Redesign

- [x] Violet & Plum design system — token system replacing blue palette in globals.css

## Mobile App

### Wave 1 — Foundation
- [x] Expo SDK 55 (canary) + Expo Router (file-based navigation)
- [x] OTP auth screens — sign-in, verify, secure session via expo-secure-store
- [x] tRPC client — httpBatchLink with superjson transformer + Bearer auth injection
- [x] Journal screen — read timeline + write entries with mood tags, offline-first
- [x] Medications screen — today's scheduled doses, mark as given
- [x] Schedule screen — next 7 days of shifts
- [x] Settings screen — push notification permission + sign out
- [x] Offline queue — SecureStore persistence, flushQueue wired to careEvents.insert with idempotencyKey
- [x] Sync status hook — 'synced' | 'pending' | 'offline' banner in journal
- [x] Org selector + invite accept screens

### Wave 2 — Push Notifications
- [x] push_tokens table — Supabase migration, RLS owner-only
- [x] POST /api/push/register — upserts Expo push token (web API route)
- [x] pushNotification.ts — sendExpoPush + sendPushToOrgCoordinators helper
- [x] journalFlagAlert — Inngest event-driven function (journal/flagged → coordinator push)
- [x] gapDetector — sends coordinator push on each new coverage gap detected
- [x] burnoutAlert — sends coordinator push on each burnout alert created
- [x] Settings screen — expo-notifications permission prompt + token registration

### Wave 3 — Apple Watch
- [x] CarelogWatch Expo Native Module — Swift WCSession phone-side (updateApplicationContext)
- [x] watchOS SwiftUI app — ContentView + WatchViewModel, receives WCSession context
- [x] Config plugin — withCarelogWatch.ts adds Watch target + App Group entitlement via expo prebuild
- [x] watchBridge.ts — re-exports from real native module (was no-op stub)
=======
## Mobile (in progress)

- [ ] Wave 1 — Expo Router, auth, tRPC, core screens, offline flush — plan: `docs/superpowers/plans/2026-04-10-mobile-wave1-foundation.md`
- [ ] Wave 2 — Push notifications (APNs + FCM, push_tokens, Inngest wiring) — plan: `docs/superpowers/plans/2026-04-10-mobile-wave2-notifications.md`
- [ ] Wave 3 — Apple Watch complications (WidgetKit, CarelogWatch target) — plan: `docs/superpowers/plans/2026-04-10-mobile-wave3-watch.md`

## Web UI Redesign (in progress)

- [ ] Design token layer (Tailwind v4 @theme), shadcn/ui, icon sidebar, responsive mobile layout — plan: `docs/superpowers/plans/2026-04-10-ui-redesign.md`

## Before launch (any phase)

- [ ] Supabase cloud project
- [ ] Vercel deploy + environment variables
- [ ] Server-side auth fix (auto-resolves on Supabase cloud)
- [ ] Domain + SSL
- [ ] Stripe billing — $14/mo or $120/yr family plan (`stripe` SDK installed; `/api/stripe/webhook` route not yet created)
- [ ] Inngest cloud setup
- [ ] Resend transactional email
- [ ] Sentry error tracking — @sentry/nextjs installed; server+edge configs exist but sentry.client.config.ts missing; sendDefaultPii: true is a PHI risk that must be fixed before launch
- [ ] PostHog analytics (`posthog-js` not installed; no provider exists)
- [x] Mobile app offline queue wired to tRPC — careEvents.insert with idempotencyKey, NetInfo-triggered flush
- [x] Error boundaries — ErrorBoundary.tsx wraps DashboardClient and JournalClient

## Runbooks

Operational runbooks live in `docs/project-info/runbooks/`:
- `DEPLOY.md` — production deploy guide
- `MANUAL_TESTING.md` — QA testing checklist for web + mobile
- `THIRD_PARTY_SETUP.md` — external service accounts and configuration
- `CODEBASE_EDUCATION.md` — reading path for new contributors
