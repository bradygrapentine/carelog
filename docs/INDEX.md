# Carelog — Documentation Index

See `docs/setup/HARNESS.md` for the Claude Code harness map (entry points, skills, linked docs).

## Core docs (load when needed)

| File | Purpose | Read when |
|------|---------|-----------|
| `project-info/technology/ARCHITECTURE.md` | Directory tree, DB schema, tRPC router, RLS design, design rationale | Before touching data layer |
| `project-info/product/BUILD_STATUS.md` | What's done, in progress, full phase roadmap | Planning work |
| `project-info/technology/TECH_DEBT.md` | Known issues with file locations and fix descriptions | Before production |
| `project-info/technology/CODE_STANDARDS.md` | Coding rules, conventions, anti-patterns, testing conventions | Before writing code |
| `project-info/product/UX_DECISIONS.md` | Language choices, emotional framing, design philosophy | Before UI changes |
| `project-info/technology/TROUBLESHOOTING.md` | Every local dev issue hit + exact fixes | When something breaks |
| `BACKLOG.md` (repo root) | Master backlog — active, overnight queue, shipped log, deferred | Picking up work |

## Product

| File | Purpose |
|------|---------|
| `project-info/product/OVERVIEW.md` | Three-tier architecture diagram, client decision tree |
| `project-info/product/PRODUCT_STRATEGY.md` | Business model, GTM, moats, competitive positioning |
| `project-info/product/ROADMAP.md` | Feature sequencing with reasoning |
| `project-info/product/PLATFORM_PARITY.md` | Web/iOS/Android feature delta — expected vs gap (story sources for PP-*) |

## Technology

| File | Purpose |
|------|---------|
| `project-info/technology/AUTH_FLOW.md` | OTP sign-in, invite acceptance, session storage by layer |
| `project-info/technology/DATA_FLOW.md` | Care event write/read, identity resolution, invite paths |
| `project-info/technology/SECURITY_MODEL.md` | PHI boundary, service role isolation, RLS design, token security |
| `project-info/technology/INFRASTRUCTURE.md` | Why each third-party service was chosen |
| `project-info/technology/ACCESSIBILITY.md` | A11y tooling plan + story sources for A11Y-* |

## Runbooks

| File | Purpose |
|------|---------|
| `project-info/runbooks/DEPLOY.md` | Production deploy guide |
| `project-info/runbooks/MANUAL_TESTING.md` | QA testing checklist for web + mobile |
| `project-info/runbooks/THIRD_PARTY_SETUP.md` | External service accounts + configuration (merged former HUMAN_BACKLOG content) |
| `project-info/runbooks/CODEBASE_EDUCATION.md` | Reading path for new contributors |
| `project-info/runbooks/MOBILE_A11Y_AUDIT.md` | Manual device a11y audit procedure (complements ACCESSIBILITY.md) |
| `project-info/runbooks/USING_THE_HARNESS.md` | Operational workflow guide for the Claude harness |
| `project-info/runbooks/TOKEN_DISCIPLINE.md` | Ollama dispatch patterns and handoff plan format |

## Setup

| File | Purpose |
|------|---------|
| `setup/HARNESS.md` | Harness reference map (entry points, skills, hooks) |
| `setup/AGENT_WORKFLOW.md` | Agent and session workflow |

## Quick reference

```bash
supabase start                                    # must be first
pnpm web                                          # localhost:3000
pnpm test                                         # Vitest unit tests
supabase test db                                  # RLS pgTAP tests
pnpm exec playwright test                         # E2E tests
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
./scripts/mobile-ui.sh -p ios doctor              # mobile UI investigation
```

Local URLs: app=3000, Supabase API=54321, Studio=54323, Mailpit=54324.

## Critical rules

1. Never use template literals in JSX props — Turbopack rejects them
2. Never import `supabaseAdmin` in client components
3. Never prefix service role key with `NEXT_PUBLIC_`
4. Always read form values before any `await` in form handlers
5. JSX files must use `.tsx` extension
6. RLS policies use scalar boolean functions, not set-returning functions
7. Never edit an applied migration — write a new one
8. PHI (real names/emails) never leaves the identity vault; Sentry / PostHog / logs receive UUIDs only

## Stack

Turborepo + pnpm · Next.js 16 · Expo SDK 55 · Supabase · tRPC · Zod · Tailwind v4
Vitest · pgTAP · Playwright · Inngest · Resend · Stripe · Upstash Redis

## Business context

Family caregiving coordination platform. $14/mo family plan. Bootstrapped.
GTM: personal network → professional referrers → content/SEO.
Four moats: accumulated family data, multi-person team lock-in, referrer relationships, trust.

**Not:** telehealth, clinical decision support, social network, aide marketplace, insurance billing.
