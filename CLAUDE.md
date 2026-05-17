# CLAUDE.md — carelog

This file is read on every Claude Code session opened in this repo.
The universal context at `~/.claude/CLAUDE.md` applies first; the deeper
project rules live in `.claude/CLAUDE.md` (harness behavior, PHI, backlog
discipline). This file is the lightweight orientation layer.

## What this project is

Carelog (user-facing brand: **CareSync**) is a family caregiving coordination
platform — shared journal, medications, shifts, and care plans for the people
looking after an aging or ill relative. Bootstrapped, single $14/month family
plan.

## Stack

- **Monorepo:** pnpm workspaces + Turborepo (`turbo.json`).
- **Web:** Next.js 16 (App Router, Turbopack) in `apps/web/` — React 19, TypeScript, Tailwind v4, shadcn/ui on `@base-ui/react`, tRPC.
- **Mobile:** Expo / React Native in `apps/mobile/`.
- **Backend:** Supabase (Postgres + Auth + RLS + Storage); migrations + pgTAP tests in `supabase/`.
- **Jobs / cron:** Inngest (`api/inngest` route, local dev via `inngest-cli`).
- **Email:** Resend. **Payments:** Stripe. **Analytics:** PostHog (UUID-only — see ADR-0001).
- **Testing:** Vitest (~1980 web tests across 245+ files), Playwright E2E in `e2e/`, pgTAP for RLS in `supabase/tests/`.
- **Deploy:** Vercel (web). EAS for mobile.

## Links

- **Repo** — https://github.com/bradygrapentine/carelog
- **Vercel** — project `carelog` (id `prj_cmiP2qZHimzrYb74cYRB6DACrSrW`, team `team_uvWGawgf71BLTKkINnhHhl9M`). Dashboard: https://vercel.com/bradygrapentines-projects/carelog
- **Sentry** — org id `o4511181211369472`, project id `4511192928157696`. DSN configured in `apps/web/sentry.{client,server,edge}.config.ts` + `instrumentation-client.ts`. `SENTRY_ORG` / `SENTRY_PROJECT` env vars are empty — fill them locally for source-map uploads.
- **PostHog** — host `https://us.i.posthog.com`. Anonymous UUID identification only; PHI rule enforced by `carelog/no-phi-in-analytics` ESLint rule. See ADR-0001.
- **tmux session** — `cc-carelog`

## Layout

Top-level:

- `apps/web/` — Next.js app. Source in `app/`, `components/`, `lib/`. Tests colocated as `*.test.ts(x)`.
- `apps/mobile/` — Expo app. See `apps/mobile/CLAUDE.md`.
- `packages/` — shared TS packages (types, utilities).
- `supabase/` — migrations, seed, RLS pgTAP tests (`supabase/tests/`). See `supabase/CLAUDE.md`.
- `e2e/` — Playwright specs. See `e2e/CLAUDE.md`.
- `scripts/` — dev/ops scripts (`migration-check.sh`, `a11y-contrast.mjs`, `mobile-ui.sh`, etc.).
- `docs/` — committed project knowledge. `docs/INDEX.md` is the canonical map. `docs/adr/` for decisions, `docs/runbooks/` for procedures, `docs/research/` and `docs/plans/` for in-flight work.
- `BACKLOG.md` (root) — single source of truth for work (see ADR-0002).
- `.claude/CLAUDE.md` — harness behavior, PHI rules, parallel/subagent contracts, slash commands.
- `.claude/rules/ui-standards.md` — Tailwind tokens, WCAG AA, panel/form patterns. Load before any `apps/web/app/` or `apps/web/components/` work.
- `.claude/sessions/` — session logs (gitignored).
- `.claude/scratch/` — throwaway notes (gitignored).
- `.mcp.json` — project-scoped MCP config (RAG over `docs/`).

## Project conventions

- **Backlog is the SoT.** Feature/fix PRs do NOT touch `BACKLOG.md`; new TD/ON/A11Y rows go in dedicated `chore(backlog): …` PRs. `/backlog-sync` rebuilds status from git log. (ADR-0002)
- **PHI rule (hard).** `posthog.identify()` and `posthog.capture()` use anonymous UUID only — never email, name, phone. ESLint-enforced. (ADR-0001 / ADR-0003)
- **PRs:** GitHub native auto-merge — `gh pr merge <num> --auto --squash` after `gh pr create`. No Mergify, no `queue` label. Squash-merge only.
- **Pre-commit:** related-files vitest only (fast). Full suite via `cd apps/web && npx vitest run` before flipping a PR ready. CI runs the full suite, typecheck, and lint.
- **Migrations:** `pnpm migration-check` before opening migration PRs. RLS pgTAP tests required for new policies (`supabase test db`).
- **Codex disabled until 2026-05-16** — adversarial-review gates route to Sonnet subagents (`/grill`). See global CLAUDE.md.
- **Code style:** `type` over `interface`; no `enum` — string-literal unions only.

Deeper rules in `.claude/CLAUDE.md` (load-bearing constants, parallel-work contract, slash commands, gotchas list).

## Decision docs

Two canonical surfaces — do not consolidate them:
- **`docs/adr/`** — architecture and system-design decisions (audience: engineers reading code). See [`docs/adr/README.md`](docs/adr/README.md).
- **`docs/project-info/product/UX_DECISIONS.md`** — product language, tone, and UX decisions (audience: engineers writing copy + product folk).

Plan-embedded "guiding decisions" sections are execution artifacts, not canonical. Migrate load-bearing rules here or to `.claude/CLAUDE.md`; strike the rest.

## Current focus

- Recent: ON-76 closed (Inngest on Hobby tier, 0 events/24h — cron-firing audit seeded as TD-146).
- In-flight research: Inngest vs. Vercel Queues (`docs/research/2026-05-15-inngest-vs-queues.md`).
- Security cycle: 2026-05-14 OWASP audit landed; SEC-001 secrets-rotation runbook refreshed for 2026-05-15.
- Next chunk: pick via `/next-best-backlog-items` against `BACKLOG.md` §1 Ready.
