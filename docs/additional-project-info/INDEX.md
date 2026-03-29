# Carelog — Documentation Index

Copy all files from this directory into the root of the carelog repo.
Then open Claude Code and start with:

  "Read CLAUDE.md, then SESSION_STATE.md before doing anything."

## Files — what each covers

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
| `TROUBLESHOOTING.md` | Every local dev issue hit + exact fixes | When something breaks |
| `UX_DECISIONS.md` | Language choices, emotional framing, design philosophy | Before UI changes |
| `INFRASTRUCTURE.md` | Why each third-party service was chosen | Service/infra decisions |

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

### Critical rules — never break these
1. Never use template literals in JSX props — Turbopack rejects them
2. Never import supabaseAdmin in client components
3. Never prefix service role key with NEXT_PUBLIC_
4. Always read form values before any await in form handlers
5. JSX files must use .tsx extension
6. RLS policies use scalar boolean functions, not set-returning functions
7. Never edit an applied migration — write a new one
8. Never use cat >> for config files — use VS Code instead
9. All protected pages use client-side auth (useEffect pattern) in local dev
10. Never try to fix the sb-127-auth-token cookie issue locally — resolves in prod

### Current session focus
Team coordinator invite flow — 90% complete.
See SESSION_STATE.md for the exact next step and the 10-step test script.

### Stack (locked)
Turborepo + pnpm | Next.js 16 | Expo SDK 52 | Supabase | tRPC | Zod | Tailwind
Vitest + pgTAP + Playwright for testing
Inngest (jobs) + Resend (email) + Stripe (billing) + Upstash Redis — not yet wired

### Business context (60 seconds)
Family caregiving coordination platform. $14/mo family plan. Bootstrapped.
3.5M CareZone users abandoned by Walmart — immediate acquisition opportunity.
GTM: personal network → professional referrers (discharge planners, social workers,
elder law attorneys) → content/SEO. No paid ads except $200/mo "CareZone alternative."
Four moats: accumulated family data, multi-person team lock-in, referrer relationships, trust.
Do not sell to the wrong acquirer. Publish data stewardship commitment before launch.

### What this is NOT
Not telehealth. Not clinical decision support. Not a social network.
Not connecting families to aides for hire. Not insurance billing.
Coordination only. The daily infrastructure of caregiving.
