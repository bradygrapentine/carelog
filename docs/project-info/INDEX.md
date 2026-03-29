# Carelog — Documentation Index

Copy all files from this directory into the root of the carelog repo.
Then open Claude Code and start with:

  "Read CLAUDE.md, then SESSION_STATE.md before doing anything."

## Files in this set

| File | Purpose | Read when |
|------|---------|-----------|
| `CLAUDE.md` | Project overview, how to run, critical auth pattern | Always first |
| `SESSION_STATE.md` | Where we left off, immediate next steps | Start of every session |
| `ARCHITECTURE.md` | Directory tree, DB schema, tRPC router, RLS design | Before touching data layer |
| `BUILD_STATUS.md` | What's done, what's in progress, full phase roadmap | Planning work |
| `TECH_DEBT.md` | 11 known issues with file locations and fix descriptions | Before production |
| `ROADMAP.md` | Feature sequencing with reasoning, what we won't build | Product decisions |
| `PRODUCT_STRATEGY.md` | Business model, GTM, moats, competitive positioning | Strategic decisions |
| `DATA_MODEL_DECISIONS.md` | WHY the schema is the way it is | Before schema changes |
| `PATTERNS.md` | Code conventions, anti-patterns, testing conventions | Before writing code |
| `ENTERPRISE_PRINCIPLES.md` | 12 principles discovered through hard experience | Before writing code |

## Quick reference

### Run the project
```bash
supabase start          # must be first
pnpm web                # localhost:3000
```

### Run tests
```bash
pnpm test               # unit tests (Vitest)
supabase test db        # RLS tests (pgTAP)
pnpm exec playwright test  # E2E tests (Playwright)
```

### Local URLs
- App:      http://localhost:3000
- Supabase: http://127.0.0.1:54321
- Studio:   http://127.0.0.1:54323
- Mailpit:  http://127.0.0.1:54324

### Critical rules (don't break these)
1. Never use template literals in JSX props — Turbopack rejects them
2. Never import supabaseAdmin in client components
3. Never prefix service role key with NEXT_PUBLIC_
4. Always read form values before any await in form handlers
5. JSX files must use .tsx extension
6. RLS policies use scalar boolean functions, not set-returning functions
7. Never edit an applied migration — write a new one

### Current session focus
Team coordinator invite flow — 90% complete.
See SESSION_STATE.md for the exact next step and the 10-step test script.

### Stack decisions (locked)
Turborepo + pnpm | Next.js 16 | Expo SDK 52 | Supabase | tRPC | Zod | Tailwind
Vitest + pgTAP + Playwright for testing
Inngest (jobs) + Resend (email) + Stripe (billing) — not yet wired

### Business context (30 seconds)
Family caregiving coordination platform. $14/mo family plan. Bootstrapped.
3.5M CareZone users were abandoned — immediate opportunity.
GTM: personal network → professional referrers → content/SEO.
No paid ads except $200/mo on "CareZone alternative."
Four moats: accumulated data, team lock-in, referrer relationships, trust.
