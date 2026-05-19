# Plan — TD-186 + TD-183 (2026-05-18)

**Sprint slug:** `td-186-183-edit-mode-followups-and-iso-week`
**Base SHA:** `d754a6e` (post-#618 merge)
**Tracks:** 2 (file-disjoint, parallel-eligible)
**Mode:** `/wave` parallel dispatch, 2 PRs

---

## Track A — TD-186: /oop residuals from TD-180/181

### Three self-contained fixes, one PR

1. **Cancel-contract clarification (EmergencyFooterCard)**
   - Current: `handleCancel()` resets form fields AND calls `editMode.cancel()` separately. If a future caller wires a Cancel button to `editMode.cancel()` directly (the hook's public API), the form keeps stale dirty state.
   - **Fix:** add an `onCancel?: () => void` argument to `useEditMode` (caller-supplied side-effect hook), invoked when `cancel()` fires. Update `EmergencyFooterCard` to register field-reset via `onCancel`, removing the divergent `handleCancel()` wrapper.
   - **Ordering (LOCKED):** `cancel()` calls `setIsEditing(false)` + `setError(null)` FIRST, then invokes `onCancel?.()`. Rationale: form-reset is the dominant use case — callers want post-close state visible (`isEditing === false`) so any state-derived rendering inside `onCancel` sees the closed state. Pre-close visibility is a niche need; if a caller wants it later we can add a separate `onBeforeCancel` arg.
   - JSDoc on `useEditMode` documents the contract: "cancel() invokes onCancel AFTER flipping isEditing→false and clearing error, so callers see the post-close state when resetting form fields."

2. **Error pass-through with safe formatting (CareTeamList + EmergencyFooterCard)**
   - Current: both components' `onError` discard the real tRPC error message and substitute a generic string ("Something went wrong" / similar).
   - **Naive fix would be:** pass-through raw `err.message`. **Not safe:** tRPC surfaces Zod issues with schema field names (`"Invalid input: members.0.email"`), Postgres unique-constraint names (`"memberships_org_id_user_id_key"`), and internal cause messages — these leak schema details to end users.
   - **Real fix:** add `apps/web/lib/formatMutationError.ts` — a small helper with a whitelist of safe tRPC codes:
     - `BAD_REQUEST` / `CONFLICT` / `NOT_FOUND` / `UNAUTHORIZED` → return `err.message` with these substrings stripped via regex: `/[a-z_]+_(key|idx|fkey)\b/` (Postgres constraint names) and `/^Invalid input:\s*\S+\.\S+\s+/` (Zod field-path prefix). If post-strip is empty, fall back to the code's canonical friendly string.
     - `INTERNAL_SERVER_ERROR` / `TIMEOUT` / unknown → return `"Something went wrong. Please try again."` (no leak).
   - Wire `onError: (err) => editMode.handlers.onError({ message: formatMutationError(err) })` in both components.
   - **Acceptance:** new tests for `formatMutationError` (≥5 cases: BAD_REQUEST with constraint-name stripped; Zod field-path stripped; CONFLICT raw message kept; INTERNAL_SERVER_ERROR → generic; unknown code → generic). Update component-test assertions to match.

3. **Sentry.setTag/setTags/setExtra/setExtras coverage (ESLint rule)**
   - Current: `no-phi-in-analytics` covers `setUser/setContext/captureException/addBreadcrumb` + Resend, but NOT `setTag/setTags/setExtra/setExtras` (all common alternates to setContext).
   - **Fix:** extend `isTargetCall` to recognize the four methods. `resolveArgsToInspect`:
     - `setTag(key, value)` / `setExtra(key, value)` — **2-arg singular form IS a leak surface.** `Sentry.setTag("email", userEmail)` puts the literal key `"email"` into Sentry's indexed tag UI. When `args[0]` is a string Literal whose normalized value matches `FORBIDDEN_KEYS` (or `name` outside `setContext`), report on `args[0]` with a new `messageId: "forbiddenTagKey"` ("Sentry.{{call}} key '{{key}}' is PHI — use anonymous UUID or a non-PHI label.").
     - `setTags({ ... })` / `setExtras({ ... })` — inspect `args[0]` like `setContext` (recursive key walk).
   - Add ≥4 tests: `setTag("email", x)` FAILS via `forbiddenTagKey`; `setExtra("phone", x)` FAILS; `setTag("env", "prod")` PASSES; `setTags({ email: x })` FAILS via `forbiddenKey`; `setExtras({ phone: x })` FAILS.

### Acceptance (all)

- [ ] `useEditMode.ts`: new `onCancel?: () => void` arg; JSDoc updated with cancel contract.
- [ ] `useEditMode.test.tsx`: ≥1 new test verifying `onCancel` is invoked before `isEditing` flips to false.
- [ ] `EmergencyFooterCard.tsx`: field-reset wired via `onCancel`; the bespoke `handleCancel` wrapper removed; existing tests still green.
- [ ] `CareTeamList.tsx`: `onError` pass-through; if there's a test asserting "generic error", update to the real error text.
- [ ] `no-phi-in-analytics.js`: matcher extended; 2+ tests added (setTags fail, setExtras fail, setTag safe).
- [ ] `pnpm lint` from repo root passes; full vitest suite green; typecheck clean.

### Files (owned by Track A)

- `apps/web/hooks/useEditMode.ts`
- `apps/web/hooks/__tests__/useEditMode.test.tsx`
- `apps/web/components/app/CareTeamList.tsx`
- `apps/web/components/app/EmergencyFooterCard.tsx`
- `apps/web/eslint-rules/no-phi-in-analytics.js`
- `apps/web/eslint-rules/__tests__/no-phi-in-analytics.test.mjs`
- NEW: `apps/web/lib/formatMutationError.ts`
- NEW: `apps/web/lib/__tests__/formatMutationError.test.ts`

**Cycle-2 should-fix to fold during implementation:**
- Broaden constraint-name regex to `/\b[a-zA-Z_][a-zA-Z0-9_]*_(pkey|key|idx|fkey|check|excl|unique)\b/gi` (covers Postgres `_pkey`, `_check`, `_excl`, `_unique` suffixes — not just `_key/_idx/_fkey`); add one test per suffix.
- Zod-prefix strip: split on `[\n;]` and apply per-line so multi-issue errors get cleaned (or explicitly document single-issue limit in `formatMutationError` JSDoc).
- `forbiddenTagKey` messageId — pass `data: { call, key }` at report site so the `{{call}}` placeholder resolves; verify ESLint's `meta.messages` template syntax in the existing rule first.

### Branch

`fix/td-186-edit-mode-followups`

### Risks

- **Existing component tests may assert the old generic error text.** Update assertions in the same diff. If those test files exist (`CareTeamList.test.tsx`, `EmergencyFooterCard.test.tsx`), expect 1–3 line-change in each.
- **`setTag/setExtra` (singular) often appear with non-literal `value`** — the rule won't catch dynamic PHI passed via variable. Current rule already accepts that limitation (spreadIdentifier warning); singular variants fall outside the spreadIdentifier scope. Document this in a code comment on the matcher.

---

## Track B — TD-183: hoist `isoWeekStamp` to `@carelog/utils`, retire dead `getWeekStamp`

### Scope reality check vs row

The row hypothesized that `weeklyDigest` and `refillAlert` could disagree on week-stamps at year-end. Reading the code:

- `getWeekStamp()` in `packages/utils/src/index.ts:6-14` — exported but **dead code**. Only consumers are its own tests at `packages/utils/src/__tests__/index.test.ts`. `weeklyDigest.ts` does not call it (and has NO idempotency check at all — separate latent issue, NOT in scope here).
- `isoWeekStamp(date)` in `apps/web/inngest/functions/refillAlert.ts:78` — ISO-8601-correct (Thursday-of-week rule, zero-pad on weekNum). Used as part of `refillAlert`'s idempotency key.

So TD-183 collapses to a dead-code cleanup + hoist: remove `getWeekStamp`, move `isoWeekStamp` into `@carelog/utils`, swap `refillAlert.ts` import.

The weeklyDigest-idempotency gap is real but out of scope — **seed as new backlog row TD-187 at sprint close** (chore PR after wave), don't try to fix in this sprint.

### Acceptance

- [ ] `packages/utils/src/index.ts`: `getWeekStamp` deleted; `isoWeekStamp(date: Date): string` added with JSDoc referencing ISO 8601 §3.4. Signature: must accept a `Date` arg (testable; no implicit `new Date()`).
- [ ] `packages/utils/src/__tests__/index.test.ts`: `getWeekStamp` tests deleted; 5+ new `isoWeekStamp` tests covering: (a) W53 case for an actual 53-week year — `isoWeekStamp(new Date("2026-12-28T00:00:00Z"))` → `"2026-W53"` (2026 is a 53-week ISO year); (b) Year-edge Sunday `2024-12-29` → "2024-W52"; (c) Midweek `2025-06-04` Wednesday → `"2025-W23"`; (d) Zero-pad confirming `"2025-W04"` format (not `"2025-W4"`); (e) **TZ parity**: `isoWeekStamp(new Date("2026-01-04T23:00:00-08:00"))` returns the same string regardless of system TZ — proves UTC-only semantics.
- [ ] `apps/web/inngest/functions/refillAlert.ts`: removes local `isoWeekStamp` function (lines 78~95); imports from `@carelog/utils`. No behavior change.
- [ ] `apps/web/inngest/functions/__tests__/refillAlert.test.ts`: **import at line ~7 swaps from local source to `@carelog/utils`** (verified to import `isoWeekStamp` locally today; this MUST update).
- [ ] Full vitest suite green (both `apps/web` and root); typecheck clean.

### Files (owned by Track B)

- `packages/utils/src/index.ts`
- `packages/utils/src/__tests__/index.test.ts`
- `apps/web/inngest/functions/refillAlert.ts` (function removal + import only — do NOT modify alert logic)
- `apps/web/inngest/functions/__tests__/refillAlert.test.ts` (only if it imports the local `isoWeekStamp`)

### Branch

`refactor/td-183-iso-week-stamp`

### Risks

- **`@carelog/utils` build/export wiring.** If `packages/utils` requires a build step before downstream consumers see the new export, run `pnpm --filter @carelog/utils build` (if such a script exists) OR confirm the workspace uses live TS source resolution. Verify before declaring green.
- **`refillAlert.test.ts` import path.** If the test currently imports `isoWeekStamp` via a relative path from the source file, the import update is mechanical; if it doesn't import it directly (just tests behavior via the alert dispatch), no test-file change needed. Read the file to confirm before editing.

---

## Cross-track invariants

- **PHI rule (HARD):** TD-186 actively extends PHI coverage; TD-183 has no PHI surface. No test fixtures may contain real PII.
- **No BACKLOG.md edits** in either PR (per BACKLOG-as-SoT).
- **Branch hygiene:** each subagent verifies `git branch --show-current` before every commit.
- **Local green gates PR ready:** `cd apps/web && npx vitest run` + `pnpm lint` + `npx tsc --noEmit` before `gh pr ready`.

## Merge order

Independent — no soft dependencies. Either order works. Arm auto-merge on both at PR open; squash-merge.

## Follow-up to seed at sprint close

- **TD-187** — `weeklyDigest` idempotency gap (no `email_dispatch_log`-style guard; cron retry could re-send digests). Discovered while scoping TD-183. P2/Medium. Pattern to follow: ON-71 Phase 2 (`email_dispatch_log` table + idempotency key per `(org_id, week_stamp)`). **Seed via a `chore(backlog):` PR at sprint close** (consistent with ADR-0002 + `/housekeeping-wave` pattern; same as TD-185/TD-186 seeding precedent). Do NOT bundle into either feature PR.

## Wave dispatch shape

2 tracks × 2 PRs × parallel `Task` dispatch with worktrees (`.worktrees/td-186-followups/`, `.worktrees/td-183-week-stamp/`). File-disjoint. Heartbeat per global rules.
