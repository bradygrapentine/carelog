# Carelog

Family caregiving coordination platform. $14/mo family plan.

**Monorepo:** `apps/web` (Next.js), `apps/mobile` (Expo), `packages/`, `supabase/`.

## Start

```sh
supabase start          # must run first
pnpm install
pnpm web                # localhost:3000
```

## Documentation

- [`BACKLOG.md`](./BACKLOG.md) — active + overnight + shipped log
- [`docs/INDEX.md`](./docs/INDEX.md) — doc map
- [`.claude/CLAUDE.md`](./.claude/CLAUDE.md) — project config / agent rules
- [`docs/project-info/runbooks/THIRD_PARTY_SETUP.md`](./docs/project-info/runbooks/THIRD_PARTY_SETUP.md) — third-party accounts + env vars

## Common commands

```sh
pnpm test                        # Vitest
supabase test db                 # pgTAP RLS tests
pnpm exec playwright test        # E2E
./scripts/mobile-ui.sh -p ios doctor   # mobile UI investigation
```
