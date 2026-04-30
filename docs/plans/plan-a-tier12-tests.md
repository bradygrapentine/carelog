# Plan A — Tier 1/2 server testing sweep

## Goal

Close the highest-leverage PHI/auth/payment test gaps and restore the Lighthouse a11y CI gate. Each track is one new test file (or one workflow tweak); tracks own disjoint files, so they parallelize cleanly.

## Source rows (BACKLOG.md §1)

- **TD-77** identityRepository.ts (PHI vault)
- **TD-78** user.ts tRPC router (auth boundary)
- **TD-79** careEventsRepository.ts (core PHI write)
- **TD-80** lib/stripe.ts (payment infra singleton)
- **TD-81** organizationsRepository.ts (team isolation)
- **TD-82** care_events_client_id RLS stub
- **TD-87** Lighthouse a11y CI gating fix

## Tracks

| ID | Files (exclusive) | Owner | Notes |
|---|---|---|---|
| A1 / TD-77 | `apps/web/server/repositories/__tests__/identityRepository.test.ts` (new) | Sonnet, /tdd-ship | Cross-org token rejection, malformed token, expired token. Uses `supabaseAdmin` — assert org_id boundary. |
| A2 / TD-78 | `apps/web/server/routers/__tests__/user.test.ts` (new) | Sonnet, /tdd-ship | `ctx.user = null → 401`, IANA-timezone regex valid/invalid/`"../../../"`, dismissEducationTip date math, updateNotifications upsert idempotency. |
| A3 / TD-79 | `apps/web/server/repositories/__tests__/careEventsRepository.test.ts` (new) | Sonnet, /tdd-ship | Invalid payload throws before DB write; cross-recipient timeline returns empty; insertEvent respects org_id boundary. |
| A4 / TD-80 | `apps/web/lib/__tests__/stripe.test.ts` (new) | Haiku | Missing env throws clear error; singleton returns same instance; API version `"2026-03-25.dahlia"` is current. |
| A5 / TD-81 | `apps/web/server/repositories/__tests__/organizationsRepository.test.ts` (new) | Sonnet | Cross-org fixtures + org UUID assignment; cross-org query returns empty. |
| A6 / TD-82 | `supabase/tests/care_events_client_id.test.sql` (new) | Opus | RLS stub; minimal asserting client_id boundary. Schema-aware → kept in-house. |
| A7 / TD-87 | `.github/workflows/lighthouse-a11y.yml`, `scripts/lighthouse-a11y.mjs` | Opus | Restore the gate. Pick option (b): run Lighthouse against a Playwright-served local build inside the CI job. |

## Sequencing

- All 7 tracks are file-disjoint. Dispatch in parallel.
- Opus owns A6 (pgTAP / RLS) and A7 (CI infra). Subagents take A1–A5.
- Pre-flight: `git fetch origin && git rev-parse origin/main` matches local main; print base SHA into each scope contract.

## Definition of done

- Each test file passes in CI on first push (no `--no-verify`).
- A7 verifies the restored gate by intentionally introducing a low-contrast element on a feature branch and confirming the workflow fails.
- Web vitest count rises by ≥ N tests per track (declared per scope contract).
- No PHI in any analytics call (PHI rule baked into every scope contract).

## Verify before merging each track

- `cd apps/web && npx tsc --noEmit` clean
- `cd apps/web && npx vitest run <new-file>` green
- `cd apps/web && npx vitest run --reporter=dot` full suite green
- For A6: `supabase test db` green
- For A7: gate-fails-on-regression smoke test
