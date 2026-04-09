# Carelog — Documentation Index

See `docs/project-info/HARNESS.md` for the Claude Code harness map (entry points, skills, linked docs).

All docs are in `docs/project-info/`.

## Core docs (load when needed)

| File | Purpose | Read when |
|------|---------|-----------|
| `project-info/ARCHITECTURE.md` | Directory tree, DB schema, tRPC router, RLS design, design rationale | Before touching data layer |
| `project-info/BUILD_STATUS.md` | What's done, in progress, full phase roadmap | Planning work |
| `project-info/TECH_DEBT.md` | Known issues with file locations and fix descriptions | Before production |
| `project-info/ENTERPRISE_PRINCIPLES.md` | 12 principles discovered through hard experience | Before writing code |
| `project-info/PATTERNS.md` | Code conventions, anti-patterns, testing conventions | Before writing code |
| `project-info/UX_DECISIONS.md` | Language choices, emotional framing, design philosophy | Before UI changes |
| `project-info/TROUBLESHOOTING.md` | Every local dev issue hit + exact fixes | When something breaks |

## Deep reference

| File | Purpose |
|------|---------|
| `project-info/OVERVIEW.md` | Three-tier architecture diagram, Supabase client decision tree |
| `project-info/AUTH_FLOW.md` | OTP sign-in, invite acceptance, session storage by layer |
| `project-info/DATA_FLOW.md` | Care event write/read, identity resolution, invite paths |
| `project-info/SECURITY_MODEL.md` | PHI boundary, service role isolation, RLS design, token security |
| `project-info/INFRASTRUCTURE.md` | Why each third-party service was chosen |
| `project-info/DEPLOY.md` | Production deploy guide |
| `project-info/PRODUCT_STRATEGY.md` | Business model, GTM, moats, competitive positioning |
| `project-info/ROADMAP.md` | Feature sequencing with reasoning |
| `project-info/BACKLOG_PHASE2.md` | Phase 2 scheduler backlog |
| `project-info/AGENT_WORKFLOW.md` | Agent and session workflow |

## Quick reference

```bash
supabase start                                    # must be first
pnpm web                                          # localhost:3000
pnpm test                                         # Vitest unit tests
supabase test db                                  # RLS pgTAP tests
pnpm exec playwright test                         # E2E tests
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Local URLs: app=3000, Supabase API=54321, Studio=54323, Mailpit=54324

## Critical rules

1. Never use template literals in JSX props — Turbopack rejects them
2. Never import `supabaseAdmin` in client components
3. Never prefix service role key with `NEXT_PUBLIC_`
4. Always read form values before any `await` in form handlers
5. JSX files must use `.tsx` extension
6. RLS policies use scalar boolean functions, not set-returning functions
7. Never edit an applied migration — write a new one
8. Never use `cat >>` for config files — use VS Code or the Write tool
9. All protected pages use client-side auth (`useEffect` pattern) in local dev
10. Never try to fix the `sb-127-auth-token` cookie issue locally — resolves in prod

## Stack (locked)

Turborepo + pnpm | Next.js 16 | Expo SDK 52 | Supabase | tRPC | Zod | Tailwind
Vitest + pgTAP + Playwright | Inngest + Resend + Stripe + Upstash Redis

## Business context

Family caregiving coordination platform. $14/mo family plan. Bootstrapped.
3.5M CareZone users abandoned by Walmart — immediate acquisition opportunity.
GTM: personal network → professional referrers → content/SEO.
Four moats: accumulated family data, multi-person team lock-in, referrer relationships, trust.

**Not:** telehealth, clinical decision support, social network, aide marketplace, insurance billing.
