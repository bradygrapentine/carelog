@ENTERPRISE_PRINCIPLES.md
@../additional-project-info/UX_DECISIONS.md
@ARCHITECTURE.md
@TECH_DEBT.md

# Carelog — Claude Code Context

## What this is

Carelog is a family caregiving coordination platform. One subscription, one source
of truth for scheduling, medications, journaling, documents, and caregiver wellbeing.

Target: $14/mo or $120/yr family plan. Bootstrapped. No marketing budget.

## Repository location

The monorepo lives at whatever path the user has it checked out.
Run `ls` to confirm you're in the root — you should see `apps/`, `packages/`,
`supabase/`, `turbo.json`, `pnpm-workspace.yaml`.

## How to start local dev

```bash
# Terminal 1 — Supabase (must be running first)
supabase start

# Terminal 2 — Web app
pnpm web          # runs Next.js on localhost:3000

# Terminal 3 — Inngest Dev Server (for background jobs)
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest

# Terminal 4 — Tests
pnpm test         # Vitest unit tests
supabase test db  # RLS policy tests
pnpm exec playwright test  # E2E tests
```

Local URLs:
- Web app:       http://localhost:3000
- Supabase API:  http://127.0.0.1:54321
- Studio:        http://127.0.0.1:54323
- Mailpit:       http://127.0.0.1:54324

## Docs index

Auto-imported every session:
- `ENTERPRISE_PRINCIPLES.md` — coding rules discovered through hard experience
- `UX_DECISIONS.md` — language, tone, and design decisions
- `ARCHITECTURE.md` — data model, system design, key decisions
- `TECH_DEBT.md` — known issues that must be resolved before production

Load on demand:
- `BUILD_STATUS.md` — what's done, what's in progress, what's next
- `PATTERNS.md` — code conventions, testing patterns, git format

## Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo + pnpm workspaces |
| Web | Next.js 16 App Router + Vercel |
| Mobile | Expo SDK 52 (React Native) |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth — OTP email code |
| API | tRPC + Next.js API routes |
| Styling | Tailwind CSS |
| Validation | Zod — shared schemas package |
| Background jobs | Inngest — `apps/web/inngest/` |
| Email | Resend — `apps/web/server/resend.server.ts` (Mailpit locally) |
| Billing | Stripe (not yet wired) |
| Testing | Vitest + pgTAP + Playwright |

## Environment variables

**`apps/web/.env.local`**
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=REDACTED_LOCAL_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=REDACTED_LOCAL_SERVICE_ROLE_KEY
```

**`apps/mobile/.env.local`**
```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=REDACTED_LOCAL_ANON_KEY
```

## Auth pattern — IMPORTANT

Auth is client-side in local dev. This is intentional.

The Supabase session cookie in local dev is named `sb-127-auth-token` which doesn't
match what `@supabase/ssr` expects. Rather than fighting this, all protected pages
use `createClient()` (browser client) in a `useEffect` to check auth.

**Do not use `createServerSupabase()` in page components for auth checks.**
Use `createClient()` client-side instead.

This resolves automatically in production where Supabase sets cookies correctly.

## Service role key rule

`supabaseAdmin` (service role) is used ONLY in:
- `apps/web/server/` directory
- `apps/web/app/api/` routes

Never import it in client components or page components.
The file has a runtime window guard that will throw if accidentally imported client-side.

## Testing

See `.claude/skills/test/SKILL.md` for pgTAP patterns, Vitest setup, and Playwright rules.

When writing tests: create a todo list with expected test counts per file, show the plan before writing any code, and check off each item as you complete it.

## General

When asked to read docs or reference files, ALWAYS read them first before exploring the codebase. Do not autonomously explore code when documentation has been specified as the source of truth.