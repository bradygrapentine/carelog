# Carelog — Codebase Education Runbook

Structured reading path for getting up to speed on the Carelog codebase. Follow the sections in order — each one builds on the last.

---

## Orientation (start here — 20 min)

Read these two documents before touching any code.

### 1. `docs/INDEX.md`

The master index. Gives you:

- The full doc map with "read when" guidance
- Quick reference commands
- 10 critical rules that apply everywhere (Turbopack constraints, auth patterns, etc.)
- The locked stack

### 2. `docs/project-info/product/OVERVIEW.md`

The three-tier architecture diagram and the Supabase client decision tree. Answers: "which Supabase client do I use where?" — a question you'll hit on day one.

**After these two docs you should know:**

- What the app does and who it's for
- Which commands to run locally
- The three tiers (browser, API routes, Supabase) and why they exist
- When to use `createClient()` vs `createServerSupabase()` vs `supabaseAdmin`

---

## Business Context (10 min)

Read before making any product decisions.

### 3. `docs/project-info/product/PRODUCT_STRATEGY.md`

Business model, GTM, competitive moats. Understand why features exist before building them.

### 4. `docs/project-info/product/UX_DECISIONS.md`

Language rules and emotional framing. This is a caregiving platform — word choices matter. Read this before writing any UI copy.

---

## Technical Architecture (30 min)

Read before touching the data layer or auth.

### 5. `docs/project-info/technology/ARCHITECTURE.md`

- Directory tree for the monorepo
- Full DB schema (16 tables with column-level detail)
- tRPC router map
- RLS design
- Identity vault (tokenization pattern for PHI)

**This is the most important technical document.** Return to it constantly.

### 6. `docs/project-info/technology/AUTH_FLOW.md`

OTP sign-in sequence, invite acceptance flow, session storage by layer. Read before touching auth, middleware, or the invite system.

### 7. `docs/project-info/technology/DATA_FLOW.md`

Care event write/read path, identity resolution, invite paths. Shows how data moves from UI → API route → Supabase and back.

### 8. `docs/project-info/technology/SECURITY_MODEL.md`

PHI boundary, service role isolation, RLS design, token security. **Read before writing any code that touches user data.** Understand what must never cross the PHI boundary.

---

## Coding Standards (15 min)

Read before writing any code.

### 9. `docs/project-info/technology/ENTERPRISE_PRINCIPLES.md`

12 principles discovered through hard experience. Covers Supabase gotchas, form handling, auth edge cases, RLS design, migration discipline. These rules exist because something broke without them.

### 10. `docs/project-info/technology/PATTERNS.md`

Code conventions and anti-patterns for:

- TypeScript (`type` over `interface`, no `enum`)
- JSX (no template literals in props)
- tRPC procedures
- Supabase queries
- Testing conventions (unit, RLS, E2E)
- Git commit format

---

## Infrastructure (10 min)

Read before deploying or adding new services.

### 11. `docs/project-info/technology/INFRASTRUCTURE.md`

Why each third-party service was chosen. Answers "why not X?" for services that were considered and rejected.

### 12. `docs/project-info/runbooks/DEPLOY.md`

Step-by-step production deployment guide. Follow in order — Supabase → Vercel → Inngest → Resend → Upstash → Stripe → Sentry → PostHog → domain.

---

## Current State (5 min)

Read before starting any feature work.

### 13. `docs/project-info/product/BUILD_STATUS.md`

What's done, what's in progress, what's remaining before launch. Organized by phase (Phase 1–5 + mobile waves). Check here before picking up a task — it may already be done or blocked.

### 14. `docs/project-info/technology/TECH_DEBT.md`

Known issues with file locations and fix descriptions. Check here if something feels wrong — it may be a documented workaround.

---

## Developer Harness (15 min)

Read before your first coding session — the harness catches issues automatically.

### 16. `docs/project-info/runbooks/HARNESS.md`

Complete guide to:
- All automated hooks (what they check, when they fire, why each guard exists)
- Local skills (`/create-migration`, `/frontend-design`, `/review`, `/expo`, etc.)
- Codex integration (commands, effort levels, background workflow)
- Worktree patterns for parallel agent work
- How to extend hooks and add new skills

**Key takeaway:** Don't fight the guards — they exist because specific things broke. If a hook blocks you, understand why before bypassing it.

---

## Troubleshooting (reference)

Keep this open in a tab during local dev.

### 15. `docs/project-info/technology/TROUBLESHOOTING.md`

Every local dev issue that has been hit, with exact fixes. Covers:

- Supabase port conflicts
- Auth token issues (`sb-127-auth-token` — do not try to fix locally)
- Turbopack build errors
- pnpm workspace issues
- Mailpit not receiving emails

---

## Codebase Tour (hands-on — 30 min)

After reading the docs, do a quick codebase walk-through.

### Monorepo structure

```
apps/
  web/              Next.js 16 — the main app
    app/            Pages (App Router)
    components/     UI components
    server/         tRPC routers, Supabase server client, Resend
    lib/            Shared utilities (rateLimit, trpc client)
    inngest/        Background job functions + client
  mobile/           Expo SDK 55 — in progress (Wave 1–3 plans in docs/superpowers/plans/)
    app/            Expo Router screens (file-based, mirrors Next.js App Router)
    components/     Shared React Native components
    constants/      Design tokens (tokens.ts — mirrors web globals.css)
    hooks/          useOfflineWrite — offline-first write hook
    store/          offlineQueue.ts — SecureStore-backed queue
    utils/          trpc.ts (tRPC client), watchBridge.ts (watch stub)
packages/
  shared/           Shared types and utilities
supabase/
  migrations/       Ordered SQL migrations — never edit applied ones
  tests/            pgTAP RLS tests
```

### Key files to read

| File                                              | Why                                                         |
| ------------------------------------------------- | ----------------------------------------------------------- |
| `apps/web/lib/supabaseServer.ts`                  | Server-side Supabase client factory                         |
| `apps/web/server/supabaseAdmin.server.ts`         | Admin client — ESLint rule prevents client-side import      |
| `apps/web/server/trpc/router.ts`                  | tRPC router root                                            |
| `apps/web/proxy.ts`                               | Auth proxy (replaces Next.js middleware pattern)            |
| `apps/web/app/api/invite/[token]/accept/route.ts` | Example of a correct API route (cookie-writing + redirect)  |
| `supabase/migrations/`                            | Read the last 3 migrations to understand schema conventions |

---

## Mobile App (Expo SDK 55)

The mobile app is built with Expo managed workflow and Expo Router (file-based navigation mirroring Next.js App Router).

### Key mobile files

| File | Purpose |
|------|---------|
| `apps/mobile/app/(auth)/` | Sign-in, OTP verify screens |
| `apps/mobile/app/(app)/` | Bottom tab bar: Journal · Medications · Schedule |
| `apps/mobile/constants/tokens.ts` | Design tokens — same hex values as web `globals.css` |
| `apps/mobile/hooks/useOfflineWrite.ts` | Offline-first write hook with SecureStore queue |
| `apps/mobile/store/offlineQueue.ts` | Persisted write queue (SecureStore) |
| `apps/mobile/utils/trpc.ts` | tRPC client with Bearer token header |
| `apps/mobile/utils/watchBridge.ts` | Apple Watch bridge stub (replaced in Wave 3) |

### NativeWind + design tokens

The mobile app uses NativeWind 4 (Tailwind classes on React Native). Colors, typography, and spacing are defined in `constants/tokens.ts` and mirror the web CSS variables exactly — same hex values, intentionally parallel not DRY.

```
Never use raw hex in screen files — always import from constants/tokens.ts
```

### Offline queue

Care events logged while offline are queued in SecureStore and flushed when connectivity returns:

1. `useOfflineWrite` hook queues a `QueuedWrite` (snake_case)
2. On reconnect, flush maps `QueuedWrite → tRPC careEvents.insert` (camelCase) with `idempotency_key`
3. Flush is idempotent — duplicate flushes are safe

### iOS native files

**Never edit `apps/mobile/ios/` directly.** These files are generated by `expo prebuild --clean`. The harness blocks direct edits. Exceptions:
- `Info.plist` — app metadata, safe to edit
- `*.entitlements` — capability declarations
- `CarelogWatch/` — hand-maintained Xcode target (Apple Watch)

### Mobile plans

| Wave | Plan file | Status |
|------|----------|--------|
| Wave 1 — Foundation (nav, auth, tRPC, screens, offline) | `docs/superpowers/plans/2026-04-10-mobile-wave1-foundation.md` | planned |
| Wave 2 — Push notifications (APNs + FCM, Inngest wiring) | `docs/superpowers/plans/2026-04-10-mobile-wave2-notifications.md` | planned |
| Wave 3 — Apple Watch complications (WidgetKit, CarelogWatch) | `docs/superpowers/plans/2026-04-10-mobile-wave3-watch.md` | planned |

---

## Background Jobs (Inngest)

Inngest handles asynchronous work that shouldn't block the request cycle.

### How Inngest works in this codebase

1. An API route or server action calls `inngest.send({ name: 'event/name', data: {...} })`
2. Inngest routes the event to the matching function in `apps/web/inngest/`
3. The function runs in the background — retries, step functions, delays all handled by Inngest

**Local dev:** Start the Inngest dev server:
```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```
This connects to `apps/web/app/api/inngest/route.ts` which registers all functions.

### Registered Inngest functions

| Function | Event | What it does |
|----------|-------|-------------|
| `weeklyDigest` | `inngest/weekly.digest` (scheduled) | Sends weekly care summary emails to coordinators |
| `gapDetector` | `carelog/shift.ended` | Detects schedule gaps after shifts; sends push + email alerts |
| `burnoutAlert` | `carelog/journal.flagged` + scheduled | Detects high-risk caregiver patterns; alerts coordinators |
| `journalFlagAlert` | `carelog/journal.flagged` | Immediate notification to coordinators when a journal entry is flagged |
| `sendEmail` (Resend) | Internal | Wraps Resend email sending with retry logic |

### PHI rules for Inngest functions

- Never log `payload` contents — `care_events.payload` is jsonb that may contain PHI
- Email templates receive UUIDs, not real names — identity resolution happens inside the function via `identity_vault` (service role only)
- All external systems (Sentry, PostHog, logs) receive UUIDs only

### Adding a new Inngest function

1. Create `apps/web/inngest/myFunction.ts`
2. Export from `apps/web/inngest/index.ts`
3. Add to the `functions` array in `apps/web/app/api/inngest/route.ts`
4. Write a unit test in `apps/web/inngest/__tests__/myFunction.test.ts`

---

## Quick Reference

### Local dev startup

```bash
supabase start                                     # must be first
pnpm web                                           # localhost:3000
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

### Local URLs

| Service         | URL                    |
| --------------- | ---------------------- |
| App             | http://localhost:3000  |
| Supabase API    | http://localhost:54321 |
| Supabase Studio | http://localhost:54323 |
| Mailpit (email) | http://localhost:54324 |

### Run tests

```bash
pnpm test              # Vitest unit tests (528 tests, 57 files)
supabase test db       # RLS pgTAP tests (11 test files)
pnpm exec playwright test  # E2E tests
```

### Rules you must not break

1. No template literals in JSX props (Turbopack rejects them — compute as variables first)
2. Never import `supabaseAdmin` in client components
3. Never prefix `SUPABASE_SERVICE_ROLE_KEY` with `NEXT_PUBLIC_`
4. Read form values before any `await` in form handlers
5. JSX files use `.tsx` extension
6. RLS policies use scalar boolean functions, not set-returning functions
7. Never edit an applied migration — write a new one
8. API routes for cookie-writing + redirect operations (not server actions)
9. Protected pages use client-side auth (`useEffect` pattern) in local dev
10. Never try to fix the `sb-127-auth-token` cookie issue locally — resolves in production
