# Carelog — Workspace Context

## Stack (locked)
Turborepo + pnpm | Next.js 16 (App Router) | Expo SDK 55 + NativeWind 4 | Supabase (Postgres + RLS + Auth) | tRPC | Zod | Tailwind | Vitest + pgTAP + Playwright | Inngest + Resend + Stripe + Upstash Redis

## Monorepo layout
- `apps/web/` — Next.js app (App Router)
- `apps/mobile/` — Expo (not fully wired)
- `supabase/migrations/` — never edit applied migrations; always write new ones
- `supabase/tests/` — pgTAP RLS tests

## Key file locations
- Server Supabase client: `apps/web/lib/supabaseServer.ts`
- Admin client (service role): `apps/web/server/supabaseAdmin.server.ts`
- tRPC router root: `apps/web/server/trpc/router.ts`
- Auth proxy: `apps/web/proxy.ts`

## Rules that break things if ignored
1. No template literals in JSX props — Turbopack rejects them; compute as variables first
2. `supabaseAdmin` only in `server/` and `app/api/` — never client-side
3. `SUPABASE_SERVICE_ROLE_KEY` never prefixed with `NEXT_PUBLIC_`
4. Read form values before any `await` in form handlers
5. Cookie-writing + redirect ops → API routes, not server actions
6. RLS policies must use scalar boolean functions, not set-returning functions
7. Never edit an applied migration — write a new one
8. PHI (real names/emails) must never leave the identity vault; all external systems (Sentry, PostHog, logs) receive UUIDs only

## Test commands
- `pnpm test` — Vitest (528 tests, 57 test files)
- `supabase test db` — pgTAP RLS tests
- `pnpm exec playwright test` — E2E

## Current phase
Phase 5 complete (shared expense log, benefits navigator, document vault, end-of-life planner). Mobile Wave 1/2/3 plans written (`docs/superpowers/plans/2026-04-10-mobile-wave*.md`). UI redesign spec committed. Before-launch items: Sentry PHI fix (`sendDefaultPii: true` in server + edge configs), Stripe billing, PostHog, server-side auth migration.
