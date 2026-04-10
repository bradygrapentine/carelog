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

### 13. `docs/project-info/technology/BUILD_STATUS.md`

What's done, what's in progress, what's remaining before launch. Organized by phase (Phase 1–5). Check here before picking up a task — it may already be done or blocked.

### 14. `docs/project-info/technology/TECH_DEBT.md`

Known issues with file locations and fix descriptions. Check here if something feels wrong — it may be a documented workaround.

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
  web/           Next.js 16 — the main app
    app/         Pages (App Router)
    components/  UI components
    server/      tRPC routers, Supabase server client, Resend
    lib/         Shared utilities (rateLimit, trpc client)
    inngest/     Background job functions + client
  mobile/        Expo SDK 52 — not yet fully wired
packages/
  shared/        Shared types and utilities
supabase/
  migrations/    Ordered SQL migrations — never edit applied ones
  tests/         pgTAP RLS tests
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
pnpm test              # Vitest unit tests (279 tests)
supabase test db       # RLS pgTAP tests
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
