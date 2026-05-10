# Carelog — Documentation Index

`.claude/CLAUDE.md` at the repo root is the canonical entry point for how the harness behaves. This file indexes the on-demand reference docs under `docs/`.

## Quick start

```sh
supabase start                                    # must be first
pnpm web                                          # localhost:3000
pnpm test                                         # Vitest unit tests (173 tests at monorepo root)
cd apps/web && npx vitest run                     # full web suite (~1900 tests across 240+ files)
cd apps/web && npx tsc --noEmit                   # web typecheck
supabase test db                                  # RLS pgTAP tests
pnpm exec playwright test                         # E2E
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
./scripts/mobile-ui.sh -p ios doctor              # mobile UI investigation
```

Local URLs: app=3000, Supabase API=54321, Studio=54323, Mailpit=54324.

## Source of truth

- **`BACKLOG.md`** (repo root) — every planned feature, bug, tech-debt item, a11y task, polish story, with lifecycle status. **Read before any work.** See §0 status board, §1–§6 active rows, §7 shipped log.
- **`.claude/CLAUDE.md`** — harness behavior: routing, parallel work, subagent scope contract, PHI rules, hooks, skills.
- **`apps/web/CLAUDE.md`** — Next.js 16 rules, Turbopack, auth, `proxy.ts` vs `middleware.ts`.
- **`apps/mobile/CLAUDE.md`** — Expo/React Native, offline queue, env vars.
- **`supabase/CLAUDE.md`** — RLS, migration, pgTAP patterns.
- **`e2e/CLAUDE.md`** — Playwright E2E conventions.
- **`.claude/rules/ui-standards.md`** — Tailwind tokens, WCAG AA, responsive breakpoints, panel/form patterns. Load before any work under `apps/web/app/` or `apps/web/components/`.

## Product

| File | Purpose |
|------|---------|
| `project-info/product/OVERVIEW.md` | Three-tier architecture overview, client decision tree |
| `project-info/product/PRODUCT_STRATEGY.md` | Business model, GTM, moats, competitive positioning |
| `project-info/product/ROADMAP.md` | Feature sequencing with reasoning |
| `project-info/product/PLATFORM_PARITY.md` | Web/iOS/Android feature delta (story sources for PP-*) |
| `project-info/product/UX_DECISIONS.md` | Language, tone, and design philosophy |
| `project-info/product/HUMAN_DESIGN_INPUT.md` | Raw design input from the founder |

## Technology

| File | Purpose |
|------|---------|
| `project-info/technology/ARCHITECTURE.md` | Directory tree, DB schema, tRPC router, RLS design, design rationale |
| `project-info/technology/CODE_STANDARDS.md` | Coding rules, conventions, anti-patterns, testing conventions |
| `project-info/technology/AUTH_FLOW.md` | OTP sign-in, invite acceptance, session storage by layer |
| `project-info/technology/DATA_FLOW.md` | Care event write/read, identity resolution, invite paths |
| `project-info/technology/SECURITY_MODEL.md` | PHI boundary, service role isolation, RLS design, token security |
| `project-info/technology/INFRASTRUCTURE.md` | Why each third-party service was chosen |
| `project-info/technology/ACCESSIBILITY.md` | A11y tooling plan (story sources for A11Y-*) |
| `project-info/technology/ANALYTICS_EVENTS.md` | PostHog event catalog with PHI-safe property list |
| `project-info/technology/OFFLINE_BEHAVIOR.md` | IndexedDB write-queue, reconnect sync, retry semantics |
| `project-info/technology/TROUBLESHOOTING.md` | Every local dev issue hit + exact fixes |

## Runbooks

| File | Purpose |
|------|---------|
| `project-info/runbooks/USING_THE_HARNESS.md` | Operational workflow guide — skills, hooks, model routing, session rituals |
| `project-info/runbooks/DEPLOY.md` | Production deploy guide |
| `project-info/runbooks/MANUAL_TESTING.md` | QA testing checklist for web + mobile |
| `project-info/runbooks/THIRD_PARTY_SETUP.md` | External service accounts + configuration |
| `project-info/runbooks/CODEBASE_EDUCATION.md` | Reading path for new contributors |
| `project-info/runbooks/MOBILE_A11Y_AUDIT.md` | Manual device a11y audit procedure |
| `project-info/runbooks/TOKEN_DISCIPLINE.md` | Ollama dispatch patterns + handoff plan format |

## Critical rules

1. Never use template literals in JSX props — Turbopack rejects them.
2. Never import `supabaseAdmin` in client components.
3. Never prefix the service role key with `NEXT_PUBLIC_`.
4. Always read form values before any `await` in form handlers.
5. JSX files must use `.tsx` extension.
6. RLS policies use scalar boolean functions, not set-returning functions.
7. Never edit an applied migration — write a new one.
8. PHI (real names/emails) never leaves the identity vault; Sentry / PostHog / logs receive UUIDs only.
9. Never commit directly to `main` — the PreToolUse hook blocks it (override: `CLAUDE_ALLOW_MAIN_COMMIT=1`).

## Stack

Turborepo + pnpm · Next.js 16 · Expo SDK 55 · Supabase · tRPC · Zod · Tailwind v4
Vitest · pgTAP · Playwright · Inngest · Resend · Stripe · Upstash Redis · Sentry · PostHog

## Business context

Family caregiving coordination platform. $14/mo family plan. Bootstrapped.
GTM: personal network → professional referrers → content/SEO.
Four moats: accumulated family data, multi-person team lock-in, referrer relationships, trust.

**Not:** telehealth, clinical decision support, social network, aide marketplace, insurance billing.
