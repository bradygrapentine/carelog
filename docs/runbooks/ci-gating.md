# CI gating — conditional E2E (TD-195)

This repo uses `dorny/paths-filter@v3` (`.github/workflows/ci.yml` `changes` job) to skip the Playwright E2E suite on PRs whose diff cannot plausibly affect end-to-end user flows. Typecheck, lint, web-tests, supabase-tests still run on every PR.

## What gates E2E today

The E2E matrix job (`e2e`) and the `e2e-string-drift` job run when the PR diff matches any of:

- `e2e-required` filter (`ci.yml` `changes.filters.e2e-required`) — see allowlist below
- `deps` filter (`pnpm-lock.yaml`, `package.json`, `apps/*/package.json`, `apps/mobile/package-lock.json`, `.github/workflows/**`)
- `e2e` filter (`e2e/**`)

Plus unconditional runs on merge_queue and push to main.

## `e2e-required` allowlist

The current allowlist (canonical: `ci.yml`, `changes.filters.e2e-required`):

| Path | Why |
|---|---|
| `apps/web/app/**` | App Router pages, layouts, route handlers |
| `apps/web/middleware.ts` | Auth/PHI gating, redirects |
| `apps/web/lib/supabase/**` | Supabase client config — auth + RLS query shape |
| `apps/web/server/routers/**` | tRPC wire surface (incl. `__tests__/` — accepted false-positive) |
| `apps/web/server/repositories/**` | Data layer — can break end-to-end behavior |
| `apps/web/components/**` | UI components hit by E2E flows |
| `apps/web/instrumentation.ts` + `instrumentation-client.ts` | PostHog/Sentry init |
| `apps/web/sentry.*.config.ts` | Sentry client/server/edge configs |
| `apps/web/next.config.ts` | Middleware, headers, redirects, rewrites |
| `apps/web/app/globals.css` | Tailwind v4 `@theme` tokens + WCAG color tokens |
| `apps/web/postcss.config.mjs` | PostCSS pipeline (Tailwind v4 toolchain) |
| `e2e/**` | Playwright specs themselves |
| `supabase/migrations/**` | Schema changes can break UI flows |

## What does NOT trigger E2E

Backend-only or developer-tooling diffs whose only impact is on unit-test behavior:

- `apps/web/hooks/**` — React hooks (covered by web-tests)
- `apps/web/lib/**` (outside `lib/supabase/**`) — pure helpers
- `apps/web/eslint-rules/**` — custom ESLint rules
- `apps/web/server/services/**` (if added) — backend services unless they wire into routers/repositories
- Test-file-only PRs **outside** `__tests__/` subdirs under the allowlisted paths
- `docs/**`, `BACKLOG.md`, `*.md` — documentation

## When to add a path to the allowlist

Add a path to `e2e-required` when:

1. A NEW directory at `apps/web/<something>` carries code that can affect a user-visible flow (e.g., a new feature route, a new top-level component dir).
2. An EXISTING path that's not in the allowlist starts containing UI-affecting code (e.g., if `apps/web/lib/<helper>.ts` becomes the source of a UI string).
3. A NEW config file is introduced that affects build output or runtime (e.g., a new Sentry config variant, a Tailwind config if Tailwind regresses to needing one).

If you move a file currently in the allowlist (e.g., relocating `middleware.ts` to `apps/web/src/middleware.ts`), update the allowlist in the same PR.

## When E2E unexpectedly skips on a PR you think needed it

1. Run the workflow on the PR with `Re-run all jobs` from the Actions tab. This won't change gating logic — it re-runs the SAME conditional. Use only when you suspect a transient infra hiccup.
2. To FORCE a Playwright run on a PR that doesn't match the gate, append one of the gating paths to the diff (e.g., bump `apps/web/package.json` version or touch `e2e/_force.txt`).
3. If a category of PR consistently slips through, expand the allowlist (above).

## Backstops

- **Nightly E2E on main** (`e2e-streak-gate.yml`) catches any false-negative that lands.
- **Merge queue runs E2E unconditionally** — every merge-queue entry exercises the full suite.
- **Push to main runs E2E unconditionally** — direct pushes (hotfixes) exercise full suite.

## Acceptance verification

After any allowlist change, verify:

```bash
grep -nE "needs\.changes\.outputs\.e2e-required" .github/workflows/ci.yml
# Expect ≥ 2 hits (e2e matrix job + e2e-string-drift job)

grep -nE "\.web\s*==" .github/workflows/ci.yml
# Expect EXACTLY 1 hit (web-tests job — legitimately keeps `web ==` gate)
```

And open a single backend-only PR to confirm E2E shows as `skipped` in the run details, and a single UI PR to confirm E2E runs.
