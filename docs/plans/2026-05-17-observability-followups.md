# Plan: Observability + correctness follow-ups

**Sprint slug:** `observability-followups-2026-05-17`
**Base:** `44fa962c`
**Drives:** TD-152, TD-162, TD-148
**Wave-target:** 3 file-disjoint tracks; full parallel.

## Goal

Three quick wins, none of which add product surface:

1. **TD-152** wires Sentry around the two surfaces where TD-149 + TD-150 silently failed before tonight's live test caught them. Future regressions visible in Sentry within 30s instead of "we discovered it by accident".
2. **TD-162** applies the TD-149 `count=estimated` fix to three identical patterns in `ai.ts` before they bite a production user.
3. **TD-148** clears Inngest's TS SDK security advisory by bumping past the 3.54.0 threshold.

## Constraints

- All work file-disjoint by track.
- TD-152 must not introduce a new Sentry import in any component that doesn't already use it indirectly — Sentry is already wired globally (`apps/web/instrumentation*.ts`, `apps/web/sentry.*.config.ts`); component-level imports are additive only.
- PHI rule: any new Sentry context calls use UUIDs only — no emails, names, or PII.

## Tracks

### Track 1 — TD-152: Sentry instrumentation for Quick log + dashboard count path

**Branch:** `chore/td-152-sentry-observability`
**FILES ALLOWED:**
- `apps/web/components/QuickLogFab.tsx`
- `apps/web/components/__tests__/QuickLogFab.test.tsx`
- `apps/web/app/(app)/dashboard/DashboardClient.tsx`
- `apps/web/app/(app)/dashboard/__tests__/DashboardClient.test.tsx`
**FILES OUT OF SCOPE:** all router, RLS, migration, and unrelated component code.

**Phase A — Quick log click handler.**

Add `Sentry.addBreadcrumb({ category: "quicklog", message: "menu item clicked", data: { actionId, hasRecipient: !!recipientId, pathname } })` at the top of `handleActionClick`. Capture nothing on the success path; if the navigation throws (unlikely with `router.push`, but defense in depth), wrap in try/catch with `Sentry.captureException(err, { tags: { component: "QuickLogFab", actionId } })`. PHI rule: `actionId` is `"medication"|"mood"|"note"|"bp"|"meal"|"hydration"` (no PII); `recipientId` is a UUID and is NOT passed to `data` (only its truthiness).

**Phase B — Dashboard care_events count failure path.**

The `Promise.all([countResult, earliestResult])` block at `DashboardClient.tsx:163-174` doesn't currently inspect errors — Supabase client errors silently put the dashboard into a degraded state (root of TD-149's "Quick log fails too" appearance).

**Implementation pattern (mandatory — try/catch will NOT work):** Supabase JS client never throws on query errors; errors come back as `result.error`. After `await Promise.all`, check both result objects:

```ts
if (countResult.error) {
  Sentry.captureException(countResult.error, {
    tags: { component: "DashboardClient", path: "care_events.count" },
    contexts: { query: { orgId: org.id, mode: "estimated" } },
  });
}
if (earliestResult.error) {
  Sentry.captureException(earliestResult.error, {
    tags: { component: "DashboardClient", path: "care_events.earliest" },
    contexts: { query: { orgId: org.id } },
  });
}
```

A plain `try/catch` around `Promise.all` will never fire and silently produces zero observability — verify by reading the code: the Supabase chain returns a promise that resolves to `{ data, error }` regardless of success/failure. PHI: `orgId` is a UUID, no PII. Continue rendering with `eventCount = 0` rather than blocking the dashboard.

**Tests.** Both test files need an explicit `vi.mock('@sentry/nextjs', ...)` setup block at the top — neither file currently mocks Sentry (verified by grep). Without the mock, jsdom either fails import resolution or executes real Sentry calls that try to reach the DSN.

```ts
vi.mock("@sentry/nextjs", () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
}));
```

Then:
- `QuickLogFab.test.tsx`: import the mocked `addBreadcrumb`; assert it's called with `{ category: "quicklog", message: "menu item clicked", data: expect.objectContaining({ actionId: "mood" }) }` after a menu click.
- `DashboardClient.test.tsx`: simulate a Supabase error result (`{ data: null, error: { message: "boom" } }`) on the count query; assert `Sentry.captureException` is called with the matching tags/contexts AND the dashboard still renders (no white-screen, `eventCount` falls back to 0).

**Acceptance:**
- New vitest cases pass; existing 9 DashboardClient + 21 QuickLogFab tests stay green.
- `pnpm exec eslint --quiet` clean on the touched files.
- Sentry tag taxonomy: `component=QuickLogFab|DashboardClient`, `path=care_events.count` — keeps queries narrow.

### Track 2 — TD-162: Apply `count=estimated` to ai.ts

**Branch:** `fix/td-162-ai-count-estimated`
**FILES ALLOWED:**
- `apps/web/server/routers/ai.ts`
- `apps/web/server/routers/__tests__/ai.test.ts` (only if it exists; otherwise leave existing coverage alone — this is a single-mode swap, not a behavior change)
**FILES OUT OF SCOPE:** all other routers, all `supabaseAdmin` callers.

**Diff:** lines 113, 120, 129 — swap `count: "exact"` → `count: "estimated"`. Add an inline comment on the first occurrence pointing at `docs/research/2026-05-17-td-149-care-events-head-503.md` for the rationale; the other two reference back.

**Acceptance:**
- Targeted vitest (if `ai.test.ts` exists) stays green.
- No tsc errors. No lint errors.
- Both-direction grep checks:
  - `grep -c 'count: "exact"' apps/web/server/routers/ai.ts` → **0** (no remaining exact-count calls)
  - `grep -c 'count: "estimated"' apps/web/server/routers/ai.ts` → **3** (exactly three flipped to estimated)
- Note: the file may contain unrelated string literals like `matched_key_count:` — these don't match either grep pattern (which key on `count:` followed by a literal `"exact"`/`"estimated"`).

### Track 3 — TD-148: Inngest TS SDK bump

**Branch:** `chore/td-148-inngest-sdk-bump`
**FILES ALLOWED:**
- `apps/web/package.json`
- `pnpm-lock.yaml`
**FILES OUT OF SCOPE:** all source, all other package.json files.

**Steps:**
1. `pnpm view inngest version` to confirm latest stable 3.x (NOT `npm view` — monorepo enforces pnpm, npm may not be in PATH).
2. Edit `apps/web/package.json` Inngest range — bump from `^3.54.0` to whatever the latest stable 3.x is (likely `^3.55.x` or higher).
3. `pnpm install` from repo root to regen lockfile.
4. `cd apps/web && npx vitest run` to confirm no regressions.

**Acceptance:**
- Inngest dashboard's "v3 TS SDK Security Alert" banner clears after this lands and is deployed.
- Full web vitest suite stays green (no Inngest behavior changes in 3.55+).
- `pnpm-lock.yaml` diff shows only Inngest-relevant changes (no unrelated transitives).

## Merge order

Fully parallel — all three tracks file-disjoint. Auto-merge armed on each PR.

**Base-SHA preflight (mandatory before push):** `git fetch origin && git rev-parse origin/main` must still equal `44fa962cfdd6428797b599df6641c9939380dc32`. If main advanced between sprint start and PR open, rebase each branch against new main before push. This is the staleness guard for parallel dispatch.

## Risks accepted

- **TD-152 captureException patterns may be slightly noisy in dev** if a Supabase error fires during HMR. Acceptable — production Sentry is the target audience; dev noise is filtered by environment tag.
- **TD-148** could pull in a minor regression from Inngest if their 3.55+ semantics changed. Mitigated by running the full vitest suite locally before push. If anything breaks, revert the bump and open a follow-up TD to investigate.
- **TD-162** changes count semantics in the AI context-builder from "exact" to "estimated within ~5–15%". Acceptable for AI prompt construction (the counts feed heuristics about recent activity, not precision-critical calculations).

## Out of scope

- Full Sentry coverage of every silent-failure path in the app (just the two surfaces from this sprint's live-test findings).
- Inngest SDK major version migration (sticking to 3.x).
- Application of `count=estimated` to all RLS-protected callers globally — that's a separate audit-pass story if it becomes a pattern.
