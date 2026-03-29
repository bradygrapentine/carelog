# Carelog — Build Status

Last updated: session 7 (team coordinator in progress)

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

### Team coordinator (in progress)
- [x] Team panel on journal page — shows members with role badges
- [x] Invite form — email + role selector
- [x] POST /api/invite — creates membership + invite token
- [x] GET /api/invite/[token] — looks up invite details
- [x] POST /api/invite/[token]/accept — validates + consumes + activates
- [x] /invite/[token] page — shows invite details, accept button
- [ ] Pending invite redirect after sign-in (partially done — sessionStorage approach)
- [ ] Team member display names (currently shows "You" / "Team member")

### Testing
- [x] Vitest unit tests — Zod schemas, utility functions (all passing)
- [x] pgTAP RLS tests — 8 tests, all passing
- [x] Playwright E2E — auth flow + journal entry (5 tests, all passing)

## In progress this session

Team coordinator invite flow. The invite is created and the accept page renders.
The outstanding issue is email matching when the user is already signed in as a
different account. The fix is partially implemented — see invite/[token]/page.tsx
handleAccept function.

## Phase 1 remaining (the spine)

### Journal depth
- [ ] Flag for doctor button — marks entry, shows badge
- [ ] Supporter reactions — heart/thinking_of_you/strong/grateful + 280-char note
- [ ] Writing prompts — context-aware suggestions on empty text area
- [ ] Entry detail view — full entry + reactions + flag status

### Team coordinator (finish)
- [ ] Pending invite redirect — after sign-in, auto-redirect back to invite URL
- [ ] Display name resolution — show actual names not "Team member"
- [ ] Role-based UI — coordinators see admin controls, supporters see read-only

### Weekly digest
- [ ] Inngest job setup and local testing
- [ ] Resend email template — weekly summary
- [ ] Digest content — journal highlights, team activity, flags
- [ ] Stagger scheduling — digestMinuteOffset() already written

## Phase 2 — Scheduler

- [ ] Shift creation + assignment
- [ ] Coverage request board
- [ ] Gap detector — coverage_windows table already exists
- [ ] Recurring shifts

## Phase 3 — Medical

- [ ] Medication catalog UI (table already exists)
- [ ] Schedule + administration log
- [ ] Prescription label scan — OCR pipeline via Inngest (ocr_jobs table exists)
- [ ] Refill alert — Inngest background job

## Phase 3 — Outer circle + care brief

- [ ] Volunteer request board
- [ ] Share link — no account required (claim_outer_circle_slot() atomic fn exists)
- [ ] Care brief generator + shareable snapshot

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
