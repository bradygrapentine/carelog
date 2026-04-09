# Carelog — Build Status

Last updated: 2026-04-09 (Phase 3 complete)

## Completed and working

### Infrastructure
- [x] Turborepo monorepo — Next.js 16 + Expo SDK 52 + shared packages
- [x] Supabase local dev — all 16 tables, RLS, indexes, helper functions
- [x] Repository pattern — identity, events, orgs, memberships, medications
- [x] tRPC router — 3 routers, 8+ procedures, protected procedures
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
- [x] Vitest unit tests — 279 tests across 27 files (all passing)
- [x] pgTAP RLS tests — 18+ tests, all passing
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

## Phase 4-5 — Wellbeing + finances

- [ ] Burnout tracker
- [ ] Symptom tracker
- [ ] Shared expense log
- [ ] Document vault

## Before launch (any phase)

- [ ] Supabase cloud project
- [ ] Vercel deploy + environment variables
- [ ] Server-side auth fix (auto-resolves on Supabase cloud)
- [ ] Domain + SSL
- [ ] Stripe billing — $14/mo or $120/yr family plan
- [ ] Inngest cloud setup
- [ ] Resend transactional email
- [ ] Sentry error tracking
- [ ] PostHog analytics
- [ ] Mobile app offline queue wired to tRPC
- [ ] Error boundaries on all client pages
