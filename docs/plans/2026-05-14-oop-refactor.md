# OOP refactor — Phase 2 audit (re-grounded against current main)

**Date:** 2026-05-14 (re-audit)
**Base SHA:** `origin/main` as of audit time. To be re-captured at each wave's preflight.
**Prior audit (stale):** `docs/plans/2026-05-14-oop-refactor.STALE.md`
**Wave A shipped:** OOP-001 (PR #469), OOP-002 (PR #468), OOP-005 (PR #470). Excluded below.
**Adversarial-gate gaps from Wave A:** TD-129 (service_role test discipline), TD-130 (pdf typeof narrowing) — captured in BACKLOG.md §1; not refactor work.
**Invariant:** No external behavior change. UI pixel-identical. API response shapes unchanged. On-disk / DB / network payload shapes unchanged.

## Methodology

Every finding below is backed by an inline grep/wc command output captured during this re-audit. The prior audit had at least two fabricated premises (OOP-007 inline `EXISTS` count, OOP-010 AsyncStorage usage) and four wrong line-count baselines. This re-audit verified each premise directly.

## Dropped from prior audit

- **OOP-003 (messaging pgTAP)** — `supabase/tests/messaging_rls.test.sql` already exists with `select plan(12)` and 13 assertion lines. Coverage is no longer zero. Status: ✅ already shipped (not via the OOP wave; pre-existing).
- **OOP-007 (`is_org_coordinator()` dedupe)** — `grep -rEc "EXISTS\s*\(\s*SELECT.*FROM\s+(public\.)?memberships" supabase/migrations/` returns **0**. `user_is_org_coordinator()` already defined at `supabase/migrations/20260327234330_core_schema.sql:344` and consumed by policies in `core_schema.sql` + `shifts_schema_align.sql`. Nothing left to dedupe.

## Surviving friction sites — 10 stories

### OOP-004 — OCR job state machine + row-level lock

- **Zone:** web · **Category:** `procedural-where-OOP-fits` · **Risk:** MEDIUM · **Effort:** M (3–4h)
- **Verified premise:** `ls apps/web/app/api/ocr/` → **6 routes**: `confirm`, `discard`, `job`, `review`, `save-fields`, `upload`. (Prior audit said 5.)
- **Why:** Each route independently reads → validates → transitions → writes the `ocr_jobs` row with no pessimistic lock. Two concurrent clients can both `confirm`.
- **Proposed shape:** `apps/web/lib/ocr/jobStateMachine.ts` (new) with `OcrJobStateMachine.transitionTo(target)`. Use Supabase `select … for update` or new SQL function `acquire_ocr_job_lock(job_id, target_state)`. Each route delegates.
- **Behavior preservation:** HTTP status codes (200/400/403) preserved. Pin via integration test that runs the happy path before and after; new test asserts only-one-winner under simulated race.
- **Owned files:** all 6 routes under `apps/web/app/api/ocr/` (including `job/route.ts` — the prior audit's omission), new `apps/web/lib/ocr/jobStateMachine.ts`, new `apps/web/lib/__tests__/jobStateMachine.test.ts`, optional new supabase migration if SQL function path chosen.

### OOP-006 — Brief headline classifier → strategy chain

- **Zone:** web · **Category:** `cyclomatic-hotspot` · **Risk:** MEDIUM · **Effort:** M (3–4h)
- **Verified premise:** `wc -l apps/web/lib/brief/headline.ts` → **223 lines** (prior audit said 118 — wrong). `grep -cE "^\s*(if|else if)" headline.ts` → **11 branches**.
- **Why:** Branches on input shape (empty/crisis/flagged/difficult_run/single_entry/quiet_stable/default + sub-branches). Comment reserves space for `meds_missed`, `mood_drop`. Linear extension is the current cost.
- **Proposed shape:** `HeadlineStrategy` interface with `classify(input): ClassifiedHeadline | null`; ordered concrete strategies under `apps/web/lib/brief/headlineStrategies/`; dispatcher loop returns first non-null. Default always returns non-null.
- **Behavior preservation:** Existing `apps/web/lib/__tests__/headline*.test.ts` pin precedence — must remain green. Public `classifyHeadline()` signature unchanged.
- **Owned files:** `apps/web/lib/brief/headline.ts`, new `apps/web/lib/brief/headlineStrategies/*.ts`.

### OOP-008 — Standardize immutability enforcement (NARROWER than prior audit)

- **Zone:** supabase · **Category:** `inconsistent-pattern` · **Risk:** MEDIUM · **Effort:** S (1–2h)
- **Verified premise:** `grep -rn "BEFORE UPDATE" supabase/migrations/` shows 3 existing triggers:
  - `shift_questions_immutable_cols_trg` (`20260509000000_shift_questions.sql:83`) ✓
  - `user_profiles` BEFORE UPDATE (`20260328000200_auth_config.sql:72`) ✓
  - `visit_recordings` BEFORE UPDATE (`20260501132708_visit_recordings.sql:78`) ✓ — **prior audit missed this**
  - `care_briefs.recipient_id` — no trigger (the only real gap)
- **Why:** Three tables already use the trigger pattern; only `care_briefs.recipient_id` is silently mutable. Future permissive UPDATE policy could change recipient binding undetected.
- **Proposed shape:** New migration adds one BEFORE UPDATE trigger on `care_briefs` raising exception if `OLD.recipient_id IS DISTINCT FROM NEW.recipient_id`. pgTAP `throws_ok` + `lives_ok` for other-column updates.
- **Behavior preservation:** Trigger uses `IS DISTINCT FROM` so other-column UPDATEs pass through. Existing pgTAP must remain green.
- **Owned files:** new `supabase/migrations/<ts>_care_briefs_recipient_immutable.sql`, new `supabase/tests/care_briefs_immutability.test.sql`.

### OOP-009 — Mobile `Offline Queue` mutation routing via `PayloadMutator`

- **Zone:** mobile · **Category:** `duplicated-shape` · **Risk:** LOW · **Effort:** M (3–4h)
- **Verified premise:** `wc -l apps/mobile/hooks/useOfflineWrite.ts` → **122 lines** (prior audit said 71 — wrong). `MutationMap` defined at L15, dispatch via `mutations[write.entry_kind]` at L83. Discriminator pattern intact.
- **Why:** Inline `MutationMap` projects `write.payload` and builds tRPC args by hand for entry kinds. Brittle to payload-shape changes; adding a new kind requires editing the hook.
- **Proposed shape:** `PayloadMutator<T>` interface (`kind: string; buildTrpcArgs(payload: T): trpcArgs`); per-kind mutator classes under `apps/mobile/lib/offlineMutators/`. Hook composes via registry lookup.
- **Behavior preservation:** Retry/idempotency contract preserved. Existing offline-write tests pin behavior.
- **Owned files:** `apps/mobile/hooks/useOfflineWrite.ts`, new `apps/mobile/lib/offlineMutators/{index,JournalMutator,MedicationMutator,SymptomMutator}.ts`.

### OOP-010 — Mobile `SecureStore` key registry (REDIRECTED — was AsyncStorage)

- **Zone:** mobile · **Category:** `shallow-module` · **Risk:** LOW · **Effort:** S (1h)
- **Verified premise:** `grep -rn "AsyncStorage\." apps/mobile/` returns **0** (prior audit was wrong). Project uses `expo-secure-store`. `grep -rh "SecureStore\.\w+\(['\"][^'\"]+"` shows **distinct hardcoded keys**: `"pending_email"`, `"pending_invite_token"` (string literals in `(auth)/sign-in.tsx`, `(auth)/verify.tsx`, `(app)/invite/[token].tsx`) plus module-level constants `ONBOARDING_KEY` (`lib/onboarding.ts`), `QUEUE_KEY` (`store/offlineQueue.ts`). No namespacing/versioning convention; 4+ files own their own key strings.
- **Why:** Magic strings + per-file constants drift. Collision risk grows with feature count. Versioning has no escape hatch (no `v1:carelog:…` prefix).
- **Proposed shape:** Central `apps/mobile/lib/secureStoreKeys.ts` exporting `KEYS = { onboarding: "v1:carelog:onboarding_complete", pushToken: "v1:carelog:push_token", inviteToken: "v1:carelog:invite_token", pendingEmail: "v1:carelog:pending_email", offlineQueue: "v1:carelog:offline_queue" } as const`. Per-key migration: try new key first, fall back to old, write back under new.
- **Behavior preservation:** Migration path preserves pre-existing user data. Tests pin read-then-write semantics.
- **Owned files:** new `apps/mobile/lib/secureStoreKeys.ts`, edits to `lib/onboarding.ts`, `store/offlineQueue.ts`, `(auth)/sign-in.tsx`, `(auth)/verify.tsx`, `(app)/invite/[token].tsx`.

### OOP-011 — Mobile tRPC `useMutationWithRefresh` composable

- **Zone:** mobile · **Category:** `duplicated-shape` · **Risk:** LOW · **Effort:** S (1–2h)
- **Verified premise:** `grep -rcE "onSuccess.*refetch|onSuccess.*invalidate" apps/mobile/app/ --include="*.tsx"` shows non-zero in **7 production files**: `journal/index.tsx` (2), `journal/[eventId].tsx` (2), `outer-circle/index.tsx` (1), `schedule/index.tsx` (1), `expenses/index.tsx` (1), `team/index.tsx` (2), `documents/index.tsx` (1) — **10 total occurrences across 7 files** (prior audit said ~15 — overstated).
- **Why:** Each site hand-rolls `useQuery + useMutation({onSuccess: () => refetch()})`. Pattern divergence between sites (some use `refetch`, others `invalidate`).
- **Proposed shape:** `apps/mobile/hooks/useMutationWithRefresh(mutationFn, refetchKeys)` composable. Per-site adoption is explicit (allowlist below); divergent sites stay as-is and are documented.
- **Behavior preservation:** Loading + error parity verified per site. Test snapshots before/after.
- **Owned files:** new `apps/mobile/hooks/useMutationWithRefresh.ts`, edits to the 7 named screens above (explicit allowlist, no inference).

### OOP-012 — `HandoffSummary` name hydration via `NameResolver` injection

- **Zone:** web · **Category:** `leaky-encapsulation` · **Risk:** LOW · **Effort:** S (1–2h)
- **Verified premise:** `wc -l apps/web/lib/handoffSummary.ts` → **249 lines**. `actorNameMap?: Record<string, string>` at L105; usage at L129 (`actorNameMap?.[actorId] ?? "Team member"`) and L221. Production caller: `apps/web/components/HandoffSummary.tsx`.
- **Why:** Callers must construct `actorNameMap` before calling. Incomplete maps silently fall back to "Team member"; no protocol forces completeness.
- **Proposed shape:** `NameResolver` interface (`getName(id: string): string | null`); `CachedNameResolver` reference impl wraps existing Record. `buildHandoffSummary()` accepts a `NameResolver` instead of a Record. Caller constructs `new CachedNameResolver(actorNameMap)`.
- **Behavior preservation:** Output text identical for same input. **Required pre-step:** snapshot test on current output before refactor (commit it first if absent).
- **Owned files:** `apps/web/lib/handoffSummary.ts`, new `apps/web/lib/nameResolver.ts`, `apps/web/components/HandoffSummary.tsx` (caller update), test fixture updates.

### OOP-013 — Mobile push notification `NotificationRouter` registry

- **Zone:** mobile · **Category:** `procedural-where-OOP-fits` · **Risk:** LOW · **Effort:** M (2–3h)
- **Verified premise:** `apps/mobile/app/_layout.tsx` is 125 lines; notification handler at L70 (`addNotificationResponseReceivedListener`), L75 hardcodes `if (data?.screen === "ocr-review" && data?.jobId)`. Single handler.
- **Why:** Future screen types add an if. Push payload `{jobId?, screen?}` shape inferred (the inline type at L72 is local).
- **Proposed shape:** `NotificationPayload` Zod schema; `NotificationRouter` interface (`canHandle(payload): boolean; handle(payload): void`); `OcrReviewRouter` impl; root dispatcher loop in `_layout.tsx`.
- **Behavior preservation:** Existing OCR routing path preserved bit-for-bit. New router invoked only when `canHandle` matches.
- **Owned files:** `apps/mobile/app/_layout.tsx` (only L68-82), new `apps/mobile/lib/notificationRouter/{index,OcrReviewRouter,types}.ts`, new test file.

### OOP-014 — `useSyncStatus` AppState-aware polling (NARROWER than prior audit)

- **Zone:** mobile · **Category:** `procedural-where-OOP-fits` · **Risk:** LOW · **Effort:** S (1–2h)
- **Verified premise:** `wc -l apps/mobile/hooks/useSyncStatus.ts` → **28 lines**. Hook calls `setInterval` once per consumer at L19. No `AppState` import. Prior audit's "multi-timer sprawl" framing is correct in spirit (each consumer creates its own timer) but the file itself is small.
- **Why:** Three screens consuming the hook = three `setInterval` instances polling every 2s. Wake on backgrounded device with no AppState gating.
- **Proposed shape:** `SyncStatusManager` context with single owned timer + AppState listener pausing on background. `useSyncStatus()` becomes a thin context consumer.
- **Behavior preservation:** Foreground polling cadence + return value shape unchanged from caller perspective.
- **Owned files:** `apps/mobile/hooks/useSyncStatus.ts`, new `apps/mobile/lib/syncStatusManager.ts` (or context inline in the same file).

### OOP-015 — Stripe webhook handler map + Sentry routing

- **Zone:** cross · **Category:** `procedural-where-OOP-fits` · **Risk:** LOW · **Effort:** S–M (1.5–3h)
- **Verified premise:** `wc -l apps/web/app/api/stripe/webhook/route.ts` → **124 lines**. Switch on `event.type` at L23 with 4 cases: `checkout.session.completed` (L24), `customer.subscription.updated` (L53), `customer.subscription.deleted` (L74), `invoice.payment_failed` (L92). 3 `posthog.capture` calls in the error path.
- **Why:** Single switch for 4 event types; adding a new type means editing the route. Error path sinks exceptions into PostHog `$exception` events (visibility gap; Sentry is the canonical exception store).
- **Proposed shape:** `handlers: Record<string, (event: Stripe.Event) => Promise<void>>` map. Per-event handler module under `apps/web/app/api/stripe/webhook/handlers/`. Error path swap: `posthog.capture('$exception', …)` → `Sentry.captureException(err, { tags: { event_type } })` (no PII).
- **Behavior preservation NOTE:** The Sentry route change is technically a behavior change (different observability backend receives the events). Per `/oop` invariant rule, **this must split into two PRs**:
  1. Pure refactor PR: switch → handler map (no observability change). Invariant-preserving.
  2. Companion PR: Sentry routing fix. Behavior-changing, separate review bar, ADR-0001 PHI compliance check.
- **Owned files (PR 1):** `apps/web/app/api/stripe/webhook/route.ts`, new `apps/web/app/api/stripe/webhook/handlers/*.ts`, test updates.

## Wave partition (4 tracks max per wave; file-disjoint within wave)

### Wave B — supabase + OCR (3 tracks)
- T1 — OOP-004 (web, OCR)
- T2 — OOP-008 (supabase, care_briefs immutability)
- T3 — OOP-006 (web, brief headline)

### Wave C — web architectural + Stripe (3 tracks)
- T1 — OOP-012 (web, NameResolver)
- T2 — OOP-015 PR 1 only (web, Stripe handler map — invariant-preserving)
- T3 — OOP-010 (mobile, SecureStore keys) **OR** swap with a web track if mobile dispatch is too slow

### Wave D — mobile cluster (4 tracks)
- T1 — OOP-009 (PayloadMutators)
- T2 — OOP-011 (useMutationWithRefresh — 7 named screens, explicit allowlist)
- T3 — OOP-013 (NotificationRouter)
- T4 — OOP-014 (useSyncStatus AppState)

### Out of wave (behavior-changing, ADR-0001 review)
- OOP-015 PR 2 (Stripe → Sentry routing) — separate ON-* or TD-* row, separate PR.

## Adversarial-gate defenses (learned from Wave A's TD-129/130)

Every track's dispatch brief MUST encode the specific failure patterns the Sonnet adversarial gate will look for:

- **supabase tracks:** mandate `SET LOCAL ROLE service_role` discipline test; use 4-arg `throws_ok` for negative cases (3-arg silently passes when policy missing).
- **web TypeScript narrowing tracks (any `payload`/`unknown` consumer):** mandate `typeof === "string"` narrowing before `.length`/`String()`. Reviewer flags any `"x" in obj && String(obj.x || "").length > 0` pattern that would render non-string values.
- **mobile screen-sweep tracks (OOP-011):** explicit file allowlist in dispatch brief; subagent does NOT decide which screens are "divergent" — it asks for direction if a screen doesn't match the pattern.

## Migration timestamp races

Any wave with parallel supabase migrations (currently only OOP-008): only one. No race possible. If future waves stack multiple supabase migrations in parallel, mandate `date -u +%Y%m%d%H%M%S` capture at branch creation with per-track offset (e.g., T1 = base, T2 = base+1s).

## Open questions

- **OOP-015 PR 2 (Sentry routing):** is this work the user wants now, or defer to a separate session? It's outside `/oop`'s invariant scope but is the companion to PR 1's refactor.
