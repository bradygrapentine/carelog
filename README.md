# Carelog

Family caregiving coordination platform. $14/mo family plan.

**Monorepo:** `apps/web` (Next.js), `apps/mobile` (Expo), `packages/`, `supabase/`.

## Getting started

New machine or fresh account? Start here: **[`SETUP.md`](./SETUP.md)** — complete tooling prereqs, first-run walkthrough, and a master checklist you can copy into a GitHub issue.

## Start

```sh
supabase start          # must run first
pnpm install
pnpm web                # localhost:3000
```

## Documentation

- [`SETUP.md`](./SETUP.md) — **fresh-machine setup guide** (entry point)
- [`BACKLOG.md`](./BACKLOG.md) — active + overnight + shipped log
- [`docs/INDEX.md`](./docs/INDEX.md) — doc map
- [`.claude/CLAUDE.md`](./.claude/CLAUDE.md) — project config / agent rules
- [`docs/project-info/runbooks/THIRD_PARTY_SETUP.md`](./docs/project-info/runbooks/THIRD_PARTY_SETUP.md) — third-party accounts + env vars
- [`docs/project-info/runbooks/ENV_VARS.md`](./docs/project-info/runbooks/ENV_VARS.md) — every env var reference
- [`docs/project-info/runbooks/DEPLOYMENT.md`](./docs/project-info/runbooks/DEPLOYMENT.md) — production deploy runbook

## Common commands

```sh
pnpm test                        # Vitest
supabase test db                 # pgTAP RLS tests
pnpm exec playwright test        # E2E
./scripts/mobile-ui.sh -p ios doctor   # mobile UI investigation
```
