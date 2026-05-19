# TD-178 / TD-182 / TD-184 — /oop residuals cleanup

**Date:** 2026-05-19
**Base SHA:** afb8086aaa8b0572178cab5b6a5ddc8bb944e9a1
**Source backlog:** TD-178, TD-182, TD-184
**PRD:** n/a
**Recommended executor:** /sprint (full pipeline; currently invoked from session `s2`)

## Goal

Close three small `/oop`-flagged residuals from prior sprints with disjoint file scope: stable identity error codes (defense-in-depth against future PHI-via-error-string leak), refactor the brittle PostgREST `.or` string in `getRefillRecipients` to JS predicate, and clean up two minor DRY issues in `scripts/lighthouse-a11y.mjs`. Three independent tracks; any merge order.

## Non-goals

- TD-184 sub-item 3 (JWT-mint composite action between `lighthouse-a11y.yml` and `ci.yml`) — deferred to its own row; touches CI workflows, higher blast radius.
- Schema or RLS changes — all three tracks are application-layer refactors.
- TD-191's overlapping refactors in `useEditMode` / ESLint rule / pgTAP — separate row, separate sprint.

## Scope correction (verified at base SHA)

**TD-178 row** referenced lines 71/158/181 of `identityRepository.ts`, claiming 3 throw sites still interpolate `${error.message}`. Current source at base SHA shows the UPDATE site (now line 145) was already fixed by TD-179 to use `error.code ?? "UNKNOWN"`. **Only 2 sites remain to fix:** line 70 (resolve/SELECT path) and line 169 (create/INSERT path). Plan reflects current state.

## Out-of-scope but adjacent (do NOT pull into this sprint)

- **`membershipsRepository.ts` has 5 sites with the same `${error.message}` anti-pattern** (lines 23, 80, 161, 219, 232 at base SHA). Same defense-in-depth concern applies. **Not in TD-178 scope** — TD-178's named surface is `identityRepository.ts`. Surface this gap by appending one row to BACKLOG.md in a separate `chore(backlog):` PR after this sprint closes, per BACKLOG-as-SoT rule. **Before assigning the row ID:** `grep -E "TD-19[0-9]" BACKLOG.md` to confirm next free id (TD-192 likely, but verify — parallel session may have claimed it). Track 2 (TD-182) ALSO touches `membershipsRepository.ts:161` (`getRefillRecipients`) but ONLY refactors the `.or` predicate — it does NOT touch the throw site. Do not expand TD-182 either.
- **`err.cause` propagation to Sentry** — using `{ cause: error }` on the thrown Error preserves the raw Postgres error object. Default Sentry serialization can walk `cause` and surface column values. **Not in TD-178 scope** — TD-178 closes the `.message` interpolation vector; Sentry serialization hygiene is a separate threat-model item. If a follow-up row doesn't exist, surface in the BACKLOG-as-SoT chore PR alongside the membershipsRepository row above.

## Tracks

### Track 1 — identity-error-codes

**Sources backlog TD-178.**

**FILES ALLOWED** (modify/create):
- `apps/web/server/repositories/identityRepository.ts`
- `apps/web/server/repositories/__tests__/identityRepository.test.ts` (or co-located test path; verify)

**FILES OUT OF SCOPE — DO NOT TOUCH:**
- Other repositories
- tRPC routers that consume `identityRepository`
- Sentry instrumentation files
- `formatMutationError.ts` (TD-188 territory)

**Branch:** `refactor/td-178-identity-error-codes` off base SHA above.

**Implementation steps:**
1. `apps/web/server/repositories/identityRepository.ts:70` — replace `throw new Error(\`Identity resolution failed: ${error?.message}\`)` with `throw new Error("identity_read_failed", { cause: error })`. Pattern matches the TD-179 line 145 update.
2. Same file `:169` — replace `throw new Error(\`Identity creation failed: ${error?.message}\`)` with `throw new Error("identity_create_failed", { cause: error })`.
3. Verify no consumer regex-matches on the prior interpolated message format: `grep -rE "Identity (resolution|creation) failed" apps/ supabase/` should return zero matches outside the file itself and its test.
4. Update or add tests pinning the two new stable codes (`identity_read_failed`, `identity_create_failed`) and asserting raw `error` is reachable via `.cause` but not via `.message`. Add PHI sentinel: throw must not include any Postgres error-string fragment (e.g., constraint values, row hints).

**Acceptance (verifiable):**
- `cd apps/web && grep -nE "throw new Error\\(.*\\$\\{error\\??\\.message\\}" server/repositories/identityRepository.ts` returns ZERO matches.
- `cd apps/web && grep -nE "identity_(read|create)_failed" server/repositories/identityRepository.ts` returns 2 matches.
- New/updated tests pin both codes + assert `.cause` set + assert no PHI in `.message`.
- `cd apps/web && npx vitest run server/repositories/__tests__/identityRepository.test.ts` → green.
- `cd apps/web && npx tsc --noEmit` clean for touched files.
- CI green on PR.

**Risk + mitigations:** consumers reading `err.message` for `"Identity resolution failed"` string — verified via grep above. If grep returns matches, fold the consumer update into this track before closing.

### Track 2 — refill-recipients-predicate

**Sources backlog TD-182.**

**FILES ALLOWED** (modify/create):
- `apps/web/server/repositories/membershipsRepository.ts`
- `apps/web/server/repositories/__tests__/membershipsRepository.test.ts` (or co-located test path; verify; new file OK)

**FILES OUT OF SCOPE — DO NOT TOUCH:**
- `apps/web/inngest/functions/refillAlert.ts` (caller of `getRefillRecipients` — no behavior change expected)
- Other repository files
- Any migration / RLS files

**Branch:** `refactor/td-182-refill-recipients-predicate` off base SHA above.

**Implementation steps:**
1. `apps/web/server/repositories/membershipsRepository.ts:143-161` — drop the nested `.or(...)` string DSL on line 153. Replace with a **coarse DB-side role filter** that keeps the `.limit(50)` semantically equivalent to the old query: `.in("role", ["coordinator", "caregiver", "aide"])`. This prevents future `viewer`/`supervisor`/etc. roles from consuming limit-50 slots and silently dropping eligible recipients.
2. After the role filter, apply JS predicate in-memory: `(m) => m.role === "coordinator" || ((m.role === "caregiver" || m.role === "aide") && (m.recipient_id === recipientId || m.recipient_id === null))`. The JS predicate is now restricted to the same role set the DB query returns, so the only filtering left in JS is the recipient_id scope.
3. Extract the predicate as an exported pure function `isRefillRecipient(membership, recipientId): boolean` for unit-testability.
4. Add unit tests pinning the predicate semantics: coordinator universal, caregiver/aide scoped by recipient or null, other roles excluded.
5. **Add a 60-row volume test** (predicate-only, not DB) asserting that when 60 mixed-role memberships are fed through the predicate, **exactly the precomputed eligible count is returned** (e.g., construct 30 eligible + 30 ineligible and assert `result.length === 30`, not just "some are filtered"). Pins the regression scenario where naively removing the `.or` would have widened the row set past the 50-cap.
6. Add a 1-line comment above the new query: `// Role filter at DB matches old .or coarse set; JS predicate adds the recipient_id scope (TD-182)`.

**Acceptance (verifiable):**
- `cd apps/web && grep -nE "\\.or\\(\\s*\`role\\.eq\\.coordinator" server/repositories/membershipsRepository.ts` returns ZERO matches.
- `cd apps/web && grep -nE "\\.in\\(\\s*\"role\"\\s*," server/repositories/membershipsRepository.ts` returns 1 match (whitespace-loose; the DB-side role filter); inspect to confirm it lists exactly `["coordinator", "caregiver", "aide"]`.
- `cd apps/web && grep -nE "^(export )?(function|const) isRefillRecipient" server/repositories/membershipsRepository.ts` returns 1 match.
- New predicate test covers: coordinator-any-recipient, caregiver-matching-recipient, caregiver-null-recipient, caregiver-other-recipient, aide-matching, aide-other, unknown-role-excluded, **60-row volume case (mixed roles, predicate returns eligible subset only)**.
- `cd apps/web && npx vitest run server/repositories/__tests__/membershipsRepository.test.ts` → green.
- `cd apps/web && npx tsc --noEmit` clean.
- CI green on PR.

**Risk + mitigations:** (a) predicate semantics drift from old `.or` string → enumerate each role/recipient case in tests. (b) **limit-50 row-set widening** if the role filter is dropped → mitigated by `.in("role", ...)` at DB; 60-row predicate test enforces the regression. (c) future role additions (e.g., `supervisor`) → the role filter explicitly enumerates the eligible set; new roles require an opt-in code change, which is the desired safety stance.

### Track 3 — lighthouse-script-cleanup

**Sources backlog TD-184 (items 1 + 2 only).**

**FILES ALLOWED** (modify/create):
- `scripts/lighthouse-a11y.mjs`
- `scripts/__tests__/lighthouse-a11y.test.mjs` (only if existing tests need a tiny update)

**FILES OUT OF SCOPE — DO NOT TOUCH:**
- `.github/workflows/lighthouse-a11y.yml` (TD-184 item 3 — deferred)
- `.github/workflows/ci.yml`
- Any other scripts under `scripts/`

**Branch:** `refactor/td-184-lighthouse-script-cleanup` off base SHA above.

**Implementation steps:**
1. `scripts/lighthouse-a11y.mjs:18` — extract `const rawArgs = process.argv.slice(2)` once; reuse for the length check + the URLs binding.
2. Split `auditOne(url)` (at `:29`) into two functions: `probeUrl(url)` (network availability check / fast-fail) + `runLhci(url)` (actual `@lhci/cli` invocation + JSON parse). `auditOne` becomes a 3-line composition. Keeps both failure modes distinguishable. Either `function foo() {}` declarations or `const foo = () => {}` arrow-form is acceptable — pick what matches the rest of the file's style (currently `function` declarations).
3. Run the script locally against `http://localhost:3000` (or whatever the existing path does) to confirm no behavior regression. Smoke test only — no new tests required for a pure refactor, but if existing vitest covers this file, ensure it stays green.

**Acceptance (verifiable):**
- `grep -n "const rawArgs" scripts/lighthouse-a11y.mjs` returns 1 match.
- `grep -nE "^(export )?(function (probeUrl|runLhci|auditOne)\\(|const (probeUrl|runLhci|auditOne)\\s*=)" scripts/lighthouse-a11y.mjs` returns 3 matches (accepts either declaration style, with or without `export`).
- `grep -nE "^(function|const) probe\\b" scripts/lighthouse-a11y.mjs` returns 0 matches (old `probe` symbol if any is removed; only `probeUrl` remains).
- `node --check scripts/lighthouse-a11y.mjs` → exit 0.
- If `scripts/__tests__/lighthouse-a11y.test.mjs` exists: `cd apps/web && npx vitest run --root ../.. scripts/__tests__/lighthouse-a11y.test.mjs` → green (verify root before running).
- CI green on PR (the `lighthouse-a11y` job from TD-87 must still pass).

**Risk + mitigations:** breaking the script silently — the CI gate from TD-87 is the verifier (paths filter triggers on changes to this file).

## Merge order

All three tracks are independent — disjoint file ownership, no shared symbols. **Any order.** No rebases needed between them.

## Execution gate

Run `/opus-on-opus docs/plans/2026-05-19-td-178-182-184-oop-residuals-cleanup.md --from-sprint` before dispatching anything. Apply must-fix findings.

## Post-merge verification

- `git pull && cd apps/web && npx vitest run` on integrated main — expect 2314+ passing.
- `cd apps/web && npx tsc --noEmit` clean.
- No `/post-deploy-watch` needed — refactor-only chunk, no production-visible behavior.

## Open questions

None.
