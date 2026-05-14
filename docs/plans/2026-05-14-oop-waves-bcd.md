# OOP refactor — Combined Waves B/C/D plan (10 stories)

**Date:** 2026-05-14
**Base SHA:** captured at each wave's preflight; must equal `origin/main` at dispatch time.
**Source audit:** `docs/plans/2026-05-14-oop-refactor.md` (Phase 2 re-audit; every premise grep/wc-cited).
**Source backlog:** BACKLOG.md §1 rows OOP-004, OOP-006, OOP-008..015 (post-#472 reconcile).
**Wave A shipped:** OOP-001/002/005 via PRs #468/#469/#470 (2026-05-14 AM).
**Struck stories:** OOP-003 (test already exists), OOP-007 (helper already consumed).
**Recommended executor:** `/sprint` per wave, three back-to-back runs sharing this plan doc.

## Goal

Ship the 10 remaining OOP stories — invariant-preserving, no external behavior change — across three sequential file-disjoint waves. One `/opus-on-opus` review covers the full plan; Gates 1+2 for waves C/D become pro-forma if Wave B outcomes don't surface structural concerns.

## Non-goals

- Behavior changes. The Stripe-webhook → Sentry routing fix (OOP-015 companion) is **out of scope** for this plan and ships in its own separately-reviewed PR if approved.
- TD-129/TD-130 Wave A gate-gap fixes (ship in their own narrow PRs).
- Plan padding. 10 stories partitioned into 3 waves is the verified scope; if a wave shrinks during dispatch, do not invent work to fill it.

## Invariant (mandatory across every track)

**No external behavior change.** UI pixel-identical. API response shapes unchanged. On-disk / DB / network payload shapes unchanged. If a refactor would alter behavior, **stop and ask** — do not proceed.

## Adversarial-gate defenses (encoded into every dispatch brief)

Wave A's two missed must-fixes (TD-129 missing service_role discipline; TD-130 `String(payload.text || "")` rendering non-strings) inform every dispatch brief below. Patterns to bake into the agent prompt:

- **The supabase track (B3 only in this plan):** mandate `SET LOCAL ROLE service_role` discipline test for any function call; use **4-arg `throws_ok`** for negative cases (3-arg silently passes when policy missing).
- **TypeScript narrowing on `unknown`/`payload`:** mandate `typeof === "string"` narrowing before `.length`/`String()`. Reviewer flags any `"x" in obj && String(obj.x || "").length > 0` pattern that would render non-string values.
- **screen-sweep tracks (OOP-011):** explicit file allowlist in dispatch brief; agent does NOT decide which screens are "divergent" — asks for direction if a screen doesn't match the pattern.
- **PRE-COMMIT-CHECK clause (mandatory):** every brief includes the verbatim `git branch --show-current` verification against the exact assigned branch name per global rule.
- **expo-secure-store, not AsyncStorage:** any mobile storage track must `grep "AsyncStorage" apps/mobile/` returns 0 before assuming any storage primitive.

---

## Wave B — supabase + web (3 tracks)

**Estimated dispatch window:** 3–4 hours wall-clock.

### Track B1 — OOP-004 — OCR job state machine + row-level lock

**Sources backlog OOP-004.**

**FILES ALLOWED:**
- `apps/web/lib/ocr/jobStateMachine.ts` (new)
- `apps/web/app/api/ocr/upload/route.ts`
- `apps/web/app/api/ocr/review/route.ts`
- `apps/web/app/api/ocr/confirm/route.ts`
- `apps/web/app/api/ocr/discard/route.ts`
- `apps/web/app/api/ocr/save-fields/route.ts`
- `apps/web/app/api/ocr/job/route.ts`
- `apps/web/lib/__tests__/jobStateMachine.test.ts` (new)
- Optional new supabase migration `supabase/migrations/<ts>_ocr_job_lock.sql` if SQL function path chosen — surface to orchestrator before adding.

**FILES OUT OF SCOPE:**
- Other `apps/web/app/api/**` routes
- `apps/web/lib/**` outside `apps/web/lib/ocr/`
- Mobile, supabase tests outside this scope, BACKLOG.md

**Branch:** `refactor/oop-004-ocr-state-machine`

**Implementation steps:**
1. Read all **6** OCR route handlers + the `ocr_jobs` table schema in `supabase/migrations/`. Note: the prior audit omitted `job/route.ts` — verify its role before refactoring.
2. Define `OcrJobStateMachine` class with `transitionTo(targetState)` enforcing legal transitions (read schema for state values; do not invent).
3. Wrap row read+validate+write in `select … for update` inside a Supabase RPC, OR a new SQL function `acquire_ocr_job_lock(job_id, target_state)` if RPC overhead is unacceptable.
4. Each route delegates. HTTP status codes (200/400/403) preserved exactly.
5. Characterization test: pin existing single-client behavior before introducing the lock. Then add concurrent-confirm race test asserting one winner.

**Acceptance (verifiable):**
- `ls apps/web/lib/ocr/jobStateMachine.ts` exists.
- All 6 route handler tests green.
- New concurrency test asserts one winner under simulated race.
- `git diff --stat` shows ≤8 files touched.

**Risk:** MEDIUM (concurrency primitive).
**Mitigation:** Characterization test first. If `select … for update` is awkward via Supabase JS client, fall back to SQL function approach; surface that decision to orchestrator before committing the migration.

### Track B2 — OOP-006 — Brief headline classifier → strategy chain

**Sources backlog OOP-006.**

**FILES ALLOWED:**
- `apps/web/lib/brief/headline.ts` (refactor — currently 223 lines; exports `classifyBrief()` at L74)
- `apps/web/lib/brief/headlineStrategies/*.ts` (new directory; one file per strategy)
- `apps/web/lib/brief/__tests__/headline.test.ts` (read-only baseline; new test fixtures allowed if existing tests rely on internal branch identity)

**FILES OUT OF SCOPE:**
- Anything outside `apps/web/lib/brief/`.
- Callers of `classifyBrief()` — public signature must be preserved exactly.

**Branch:** `refactor/oop-006-headline-strategy-chain`

**Implementation steps:**
1. Read `headline.ts` (current: 223 lines). Top-level `if/else if` branches inside `classifyBrief` body (L74–~170) are **8**, not the raw 11 returned by a blunt grep — the remaining matches are inside helpers like `parseStoredHeadline` (L205, L208, L216) and are NOT strategies. Confirm the 8 by reading before extracting.
2. Define `HeadlineStrategy` interface: `classify(input: HeadlineInput): ClassifiedHeadline | null`.
3. Extract each of the 8 top-level branches into its own strategy class under `headlineStrategies/`. Preserve ordering (precedence is load-bearing).
4. Dispatcher: ordered array; iterate, return first non-null. Default always returns non-null.
5. `headline.ts` becomes dispatcher entry, exporting `classifyBrief()` unchanged in signature. `parseStoredHeadline` and other helpers stay in `headline.ts` (not strategies).

**Acceptance:**
- 8 strategy files exist (one per top-level branch identified during read).
- `headline.ts` is now ≤80 lines including the helper functions retained (verified vs current 223).
- All existing `apps/web/lib/brief/__tests__/headline.test.ts` cases green.
- Branch coverage ≥ pre-refactor coverage.

**Risk:** MEDIUM (ordering precedence bugs).
**Mitigation:** Dispatcher array ordering is explicit. Strategies are pure (no shared state). Existing tests pin precedence — must remain green.

### Track B3 — OOP-008 — `care_briefs.recipient_id` immutability trigger

**Sources backlog OOP-008 (NARROWED per re-audit — `visit_recordings` already has its trigger).**

**FILES ALLOWED:**
- New migration `supabase/migrations/<ts>_care_briefs_recipient_immutable.sql`
- New test `supabase/tests/care_briefs_immutability.test.sql`

**FILES OUT OF SCOPE:**
- Existing migrations (additive only).
- `shift_questions`, `visit_recordings`, `user_profiles` (already conformant).
- App code.

**Branch:** `refactor/oop-008-care-briefs-immutable-recipient`

**Implementation steps:**
1. Read the existing `shift_questions_immutable_cols_trg` at `supabase/migrations/20260509000000_shift_questions.sql:83` as the template.
2. Add BEFORE UPDATE trigger on `care_briefs` raising exception when `OLD.recipient_id IS DISTINCT FROM NEW.recipient_id`.
3. `COMMENT ON TRIGGER …` citing the policy.
4. pgTAP: `throws_ok` on attempted recipient_id change, `lives_ok` on other-column UPDATE. Use 4-arg `throws_ok` form (assert specific SQLSTATE/message).

**Acceptance:**
- Trigger visible in `\d care_briefs`.
- New pgTAP test green; existing pgTAP unchanged in pass count.
- `git diff --stat` shows exactly 2 files touched.

**Risk:** LOW.
**Mitigation:** `IS DISTINCT FROM` so other-column UPDATEs pass through. Existing tests pin no-regression.

### Wave B merge order

All 3 tracks file-disjoint. Any-order merge. Each PR adversarial-gated (Sonnet) before auto-merge.

---

## Wave C — web + mobile mixed (3 tracks)

**Estimated dispatch window:** 3–4 hours wall-clock.

### Track C1 — OOP-012 — HandoffSummary `NameResolver` injection

**Sources backlog OOP-012.**

**FILES ALLOWED:**
- `apps/web/lib/handoffSummary.ts` (refactor — currently 249 lines)
- `apps/web/lib/nameResolver.ts` (new)
- `apps/web/components/HandoffSummary.tsx` (sole production caller)
- `apps/web/lib/__tests__/handoffSummary.test.ts` (update fixtures if needed)
- `apps/web/components/__tests__/HandoffSummary.test.tsx` (update fixtures if needed)

**FILES OUT OF SCOPE:**
- Anything outside the named files.
- `careEvent.ts` (imports `handoffSummary` but doesn't construct the map).

**Branch:** `refactor/oop-012-name-resolver-injection`

**Implementation steps:**
1. **REQUIRED pre-step:** add a snapshot/characterization test on current `buildHandoffSummary()` output (commit it as the first commit on this branch). Without this, "output text identical" is unverifiable.
2. Define `NameResolver` interface: `getName(id: string): string | null`.
3. `CachedNameResolver` reference impl wraps the existing `actorNameMap` Record.
4. `buildHandoffSummary()` signature changes from `actorNameMap?: Record<string, string>` to `resolver?: NameResolver`. Internal usage at L129 + L221 updated.
5. Update sole caller `apps/web/components/HandoffSummary.tsx` to construct `new CachedNameResolver(actorNameMap)`.
6. Snapshot test from step 1 green after refactor.

**Acceptance:**
- `ls apps/web/lib/nameResolver.ts` exists.
- `buildHandoffSummary()` signature takes `NameResolver`.
- Snapshot test green (proves output identical).
- Vitest green.

**Risk:** LOW (single caller).
**Mitigation:** Snapshot-test gate prevents silent output drift.

### Track C2 — OOP-015 (PR 1 only) — Stripe webhook handler map

**Sources backlog OOP-015.**

**FILES ALLOWED:**
- `apps/web/app/api/stripe/webhook/route.ts` (refactor — currently 124 lines)
- `apps/web/app/api/stripe/webhook/handlers/*.ts` (new directory; one file per event type)
- `apps/web/app/api/stripe/webhook/__tests__/*.test.ts` (update if existing tests reference switch internals)

**FILES OUT OF SCOPE:**
- **Sentry routing change is OUT OF SCOPE** — that's behavior-changing and will ship as a separate PR (OOP-015 companion) outside this plan. Preserve the existing `posthog.capture('$exception', …)` calls in this PR.
- Anything outside `apps/web/app/api/stripe/webhook/`.
- Stripe SDK pinning, config files.

**Branch:** `refactor/oop-015-stripe-webhook-handlers`

**Implementation steps:**
1. Read existing switch at `route.ts:23` with 4 cases (verified): `checkout.session.completed` (L24), `customer.subscription.updated` (L53), `customer.subscription.deleted` (L74), `invoice.payment_failed` (L92). Read `apps/web/app/api/stripe/__tests__/webhook.test.ts` to understand what the existing test actually mocks (supabase + posthog clients) — note its assertion granularity before refactoring.
2. **REQUIRED pre-refactor first commit:** add a "handler-map dispatch" unit test asserting `handlers[event.type]` is invoked exactly once per dispatched event_type AND that unknown event types are no-ops (matching current default-case behavior). This test exercises the dispatch shape BEFORE the new map exists, so it must initially be `.skip`'d or written against the about-to-exist handler module surface. Then refactor; then unskip. Without this gate, existing mock-based tests can pass while the handler map is mis-wired.
3. Per case, extract handler to `handlers/{event_type_kebab}.ts` exporting `handle(event: Stripe.Event): Promise<void>`.
4. Route builds `handlers: Record<string, (event) => Promise<void>>` and dispatches.
5. **Preserve PostHog error path as-is** — Sentry swap is the companion PR's job, not this one.
6. All existing webhook tests + the new pre-refactor dispatch test green.

**Acceptance:**
- 4 handler files exist under `handlers/`.
- `route.ts` is now ≤50 lines (verified vs current 124).
- PostHog error path identical (no Sentry import added).
- Vitest green.

**Risk:** LOW.
**Mitigation:** Existing webhook integration test pins happy path. Error path untouched.

### Track C3 — OOP-010 — Mobile SecureStore key registry

**Sources backlog OOP-010 (REDIRECTED per re-audit — SecureStore, not AsyncStorage).**

**FILES ALLOWED:**
- `apps/mobile/lib/secureStoreKeys.ts` (new)
- `apps/mobile/lib/onboarding.ts` (update `ONBOARDING_KEY` constant + use registry)
- `apps/mobile/store/offlineQueue.ts` (update `QUEUE_KEY` constant + use registry)
- `apps/mobile/app/(auth)/sign-in.tsx` (replace `"pending_email"` literal)
- `apps/mobile/app/(auth)/verify.tsx` (replace `"pending_email"` and `"pending_invite_token"` literals)
- `apps/mobile/app/(app)/invite/[token].tsx` (replace `"pending_invite_token"` literal)
- `apps/mobile/lib/__tests__/secureStoreKeys.test.ts` (new — optional, sanity)

**FILES OUT OF SCOPE:**
- `apps/mobile/utils/supabase.ts` — uses `SecureStore` as the Supabase auth storage adapter (key argument is supplied by Supabase SDK, not under our control). Leave untouched.
- `apps/mobile/__tests__/onboarding.test.tsx` (test fixtures; update only if breaking).
- Anything outside `apps/mobile/`.

**Branch:** `refactor/oop-010-secure-store-key-registry`

**Implementation steps:**
1. **Verify premise before refactor:** check for any **production import** of AsyncStorage. Run `grep -rnE "from ['\"]@react-native-async-storage|import.*AsyncStorage" apps/mobile/ --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v "//"` and confirm it returns 0 lines. (Comments and test strings reference "AsyncStorage" because earlier docs called it that — those are fine and must not trigger the gate.) If a real production import shows up, halt and surface.
2. Create `apps/mobile/lib/secureStoreKeys.ts` exporting `const KEYS = { onboarding: "v1:carelog:onboarding_complete", offlineQueue: "v1:carelog:offline_queue", pendingEmail: "v1:carelog:pending_email", pendingInviteToken: "v1:carelog:pending_invite_token" } as const;`.
3. For each old key, add a **migration read-path:** `SecureStore.getItemAsync(KEYS.X) ?? (oldVal => oldVal && (SecureStore.setItemAsync(KEYS.X, oldVal), SecureStore.deleteItemAsync("<old>"), oldVal))(await SecureStore.getItemAsync("<old>"))`. Document in code comment.
4. Replace each call site to use `KEYS.X` instead of the literal.
5. Mobile vitest green.

**Acceptance:**
- `ls apps/mobile/lib/secureStoreKeys.ts` exists.
- `grep -rE "SecureStore\.\w+\(['\"]" apps/mobile/ --include="*.ts" --include="*.tsx"` returns only `KEYS.X` references (no string literals, excluding `utils/supabase.ts` adapter).
- Mobile vitest green; existing onboarding test green via the fallback read path.

**Risk:** LOW (5 files; mobile-only).
**Mitigation:** Fallback read preserves pre-existing user device state. Test asserts fallback path works.

### Wave C merge order

All 3 tracks file-disjoint (C1=web/lib + components, C2=apps/web/app/api/stripe, C3=apps/mobile). Any-order merge.

---

## Wave D — mobile cluster (4 tracks)

**Estimated dispatch window:** 4–5 hours wall-clock.

### Track D1 — OOP-009 — `PayloadMutator` interface

**Sources backlog OOP-009.**

**FILES ALLOWED:**
- `apps/mobile/hooks/useOfflineWrite.ts` (refactor — currently 122 lines)
- `apps/mobile/lib/offlineMutators/index.ts` (new — registry)
- `apps/mobile/lib/offlineMutators/JournalMutator.ts` (new)
- `apps/mobile/lib/offlineMutators/MedicationMutator.ts` (new)
- `apps/mobile/lib/offlineMutators/SymptomMutator.ts` (new)
- `apps/mobile/hooks/__tests__/useOfflineWrite.test.ts` (expand if coverage drops)

**FILES OUT OF SCOPE:**
- Screens consuming `useOfflineWrite` — no caller change.
- Other Wave D tracks' files.
- `apps/mobile/lib/secureStoreKeys.ts` (Wave C3).

**Branch:** `refactor/oop-009-payload-mutators`

**Implementation steps:**
1. Read `useOfflineWrite.ts` (122 lines). Note `MutationMap` at L15, dispatch via `mutations[write.entry_kind]` at L83.
2. Define `PayloadMutator<T>` interface: `kind: string; buildTrpcArgs(payload: T): TrpcArgs`.
3. Per-kind classes (`JournalMutator`, `MedicationMutator`, `SymptomMutator`). Registry maps event_kind → mutator instance.
4. Hook composes via registry lookup. Retry/idempotency unchanged.

**Acceptance:**
- 3 mutator files + registry exist.
- `useOfflineWrite.ts` is now ≤60 lines.
- Mobile vitest green; existing offline-write tests pin behavior.

**Risk:** LOW.

### Track D2 — OOP-011 — `useMutationWithRefresh` composable (explicit allowlist)

**Sources backlog OOP-011.**

**FILES ALLOWED — explicit allowlist of 7 production files (per re-audit grep):**
- `apps/mobile/hooks/useMutationWithRefresh.ts` (new)
- `apps/mobile/app/(app)/journal/index.tsx`
- `apps/mobile/app/(app)/journal/[eventId].tsx`
- `apps/mobile/app/(app)/outer-circle/index.tsx`
- `apps/mobile/app/(app)/schedule/index.tsx`
- `apps/mobile/app/(app)/expenses/index.tsx`
- `apps/mobile/app/(app)/team/index.tsx`
- `apps/mobile/app/(app)/documents/index.tsx`

**FILES OUT OF SCOPE:**
- Any other mobile screen — agent does NOT decide which are "divergent enough" to include. If a screen looks like it might fit but isn't on the allowlist, the agent surfaces to orchestrator instead of adding it.
- Test files (`__tests__/*.test.tsx`) — update only if breaking.
- `apps/mobile/app/_layout.tsx` (Track D3).
- `apps/mobile/hooks/useOfflineWrite.ts` (Track D1).
- `apps/mobile/hooks/useSyncStatus.ts` (Track D4).

**Branch:** `refactor/oop-011-use-mutation-with-refresh`

**Implementation steps:**
1. Read all 7 allowlisted screens. Note the existing `useQuery + useMutation({onSuccess: …})` pattern per file; some use `refetch`, some use `invalidate` — record per-screen.
2. Define `useMutationWithRefresh(mutationFn, refetchKeys)` composable. If a screen uses `invalidate` (not `refetch`), the composable handles both via overload OR the screen stays on `invalidate` and is documented as out-of-pattern.
3. Update each allowlisted screen.
4. Mobile vitest green.

**Acceptance:**
- `ls apps/mobile/hooks/useMutationWithRefresh.ts` exists.
- `git diff --stat` shows ≤8 files touched (1 new hook + 7 screens, possibly fewer if some screens are documented out-of-pattern).
- Mobile vitest green.
- **Per-screen behavior verification (mandatory beyond vitest):** for each of the 7 screens that DOES get refactored, the PR description must include a brief "before / after" note describing the success-toast or refresh interaction observed by the implementer (manual smoke or test-rendered output). This catches success-toast/refresh interaction drift that mocked vitest doesn't pin. If a screen lacks a way to verify this without a running dev server, document the gap in the PR body.

**Risk:** MEDIUM (7-screen sweep; pattern divergence per-screen).
**Mitigation:** Allowlist is explicit. Agent halts on any out-of-allowlist match. Per-screen behavior note required in PR body (not just vitest green).

### Track D3 — OOP-013 — NotificationRouter registry

**Sources backlog OOP-013.**

**FILES ALLOWED:**
- `apps/mobile/app/_layout.tsx` (ONLY lines ~68–82 — the push handler block; verify exact range during read)
- `apps/mobile/lib/notificationRouter/index.ts` (new)
- `apps/mobile/lib/notificationRouter/OcrReviewRouter.ts` (new)
- `apps/mobile/lib/notificationRouter/types.ts` (new — Zod schema)
- `apps/mobile/lib/__tests__/notificationRouter.test.ts` (new)

**FILES OUT OF SCOPE:**
- The rest of `_layout.tsx` (only the push handler region).
- Other Wave D tracks' files.

**Branch:** `refactor/oop-013-notification-router`

**Implementation steps:**
1. Read `_layout.tsx` to confirm push handler region (currently L70 `addNotificationResponseReceivedListener`, L75 `if (data?.screen === "ocr-review" && data?.jobId)`).
2. Define `NotificationPayload` Zod schema (capture `screen` + per-screen optional fields).
3. `NotificationRouter` interface: `canHandle(payload): boolean; handle(payload): void`.
4. `OcrReviewRouter` impl mirrors existing OCR branch behavior bit-for-bit.
5. Root dispatcher in `_layout.tsx`: Zod parse → iterate routers → first canHandle wins.
6. Unknown screen = no-op (not error), matching current behavior.

**Acceptance:**
- New router files exist.
- `_layout.tsx` push handler region calls the dispatcher.
- Mobile vitest green.

**Risk:** LOW.

### Track D4 — OOP-014 — `useSyncStatus` singleton + AppState

**Sources backlog OOP-014.**

**FILES ALLOWED:**
- `apps/mobile/hooks/useSyncStatus.ts` (refactor — currently 28 lines)
- `apps/mobile/lib/syncStatusManager.ts` (new — context + singleton timer)
- `apps/mobile/app/_layout.tsx` (Provider wiring ONLY; coordinate with D3 — both touch `_layout.tsx`)

**⚠ Cross-track ordering — strict:** Tracks D3 and D4 both touch `apps/mobile/app/_layout.tsx`. D4 dispatch brief MUST include this hard constraint: **"Do NOT `git push` or open a PR until D3's PR is merged to `origin/main`. Orchestrator polls `gh pr view <D3-pr> --json state --jq '.state'` and unlocks D4 only when state=MERGED. D4 then rebases on top of D3's commits before push."** Implementer can develop in parallel inside the worktree, but the push gate is serial. Without this guard, simultaneous push = file conflict + manual rebase pain.

**FILES OUT OF SCOPE:**
- Screens consuming `useSyncStatus` (no caller change).
- Other Wave D tracks' files outside `_layout.tsx`.

**Branch:** `refactor/oop-014-sync-status-singleton`

**Implementation steps:**
1. Read current `useSyncStatus.ts` (28 lines; `setInterval` at L19).
2. Create `SyncStatusManager` context owning a single 2-s timer (preserve current cadence — verify in code, do not invent).
3. AppState listener: pause timer when `AppState.currentState` ∈ `{"background", "inactive"}`; resume on foreground.
4. `useSyncStatus()` becomes a context consumer returning the same value shape.
5. Wire `SyncStatusManager.Provider` in `_layout.tsx` (above the existing app tree).
6. Test: single timer regardless of consumer count; timer pauses on simulated AppState transition.

**Acceptance:**
- `ls apps/mobile/lib/syncStatusManager.ts` exists.
- Test asserts single timer + AppState pause.
- Mobile vitest green.

**Risk:** LOW-MEDIUM (AppState edge cases + `_layout.tsx` overlap with D3).
**Mitigation:** Test simulates AppState transitions. D3-merges-first ordering documented above.

### Wave D merge order

- **D1, D2 independent** — any order.
- **D3 → D4** (both touch `_layout.tsx`). D4 rebases after D3 lands.

---

## Execution gate

This combined plan is reviewed **once** via `/opus-on-opus docs/plans/2026-05-14-oop-waves-bcd.md`. Apply must-fix findings before Wave B dispatch.

For Waves C and D, Gates 1+2 in `/sprint` become pro-forma "execute next wave from already-approved plan" **unless** Wave B's outcomes (gate findings, integration surprises, behavior-preservation failures) surface structural concerns. In that case, halt and re-review before proceeding.

## Post-wave verification (per wave)

- `git pull && pnpm test && cd apps/web && npx tsc --noEmit && pnpm lint` on integrated main.
- `supabase test db` if the wave touched supabase (Wave B B3 only).
- Manual smoke check if the wave touched UI surfaces.
- If a wave introduces an adversarial-gate gap (Wave A precedent: TD-129/130), capture as a fresh TD-* immediately via a `chore(backlog):` PR — do not bundle into next wave.

## Telemetry

Per global outcome telemetry rule, each `/sprint` invocation will emit one JSONL line to `~/.claude/state/skill-outcomes.jsonl` per wave outcome.

## Open questions

- **OOP-015 PR 2 (Sentry routing fix):** out of scope here. Decide separately whether to open it now, defer to a follow-up session, or close as `wontfix`. The PostHog `$exception` path stays as-is in PR 1.
