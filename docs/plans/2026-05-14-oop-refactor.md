# OOP Refactor Plan — 2026-05-14

**Source:** `/oop` Phase 1 (CONTEXT.md, 325 lines) + Phase 2 audit fragments in `.claude/state/oop-phase2-{web,mobile,supabase,cross}.md`.
**Scope:** invariant-preserving refactor across `apps/web`, `apps/mobile`, `supabase/`, `packages/`. **No external behavior changes.**
**Total candidates surfaced:** 45 friction sites (15 web · 10 mobile · 10 supabase · 10 cross).
**Backlog seed target:** the 15 stories below become `OOP-001` … `OOP-015` in `BACKLOG.md`.

---

## Headline findings

- **Phase 1 PHI-Critical CLEARED.** `/api/ocr/confirm` PostHog payload audited — only `org_id, document_id, field_count` captured. No drug name or dosage. PHI boundary holds. (cross §1)
- **3 HIGH-risk pgTAP gaps** in `supabase/`: `invite_tokens`, `journal_reactions` (RLS not even enabled), `message_threads`/`members`/`messages`.
- **2 architectural hotspots in web**: `CareEvent` payload discriminator (4+ inline `typeof` checks) and `brief/headline.ts` 7-branch classifier.
- **1 production concurrency risk**: OCR job state machine split across 5 routes with no row-level lock.
- **1 RLS maintainability debt**: ~23 inline copies of the coordinator-check pattern → single helper opportunity.

---

## Ranked stories

Ranking heuristic: `(impact / risk) × correctness-weight`. pgTAP gaps and concurrency risks rise; cosmetic renames sink.

### Wave A — correctness & coverage (ship first)

#### OOP-001 — pgTAP for `invite_tokens` atomicity + expiry
- **Zone:** supabase · **Category:** `coverage-gap` · **Risk:** HIGH · **Effort:** S (2–3h)
- **File:** `supabase/migrations/20260407000000_atomic_invite_accept.sql` (function under test); create `supabase/tests/invite_tokens_rls.test.sql`.
- **Why:** `accept_invite()` has 4 error paths (`email_mismatch`, `already_used`, expiry, atomicity) with zero pgTAP coverage. Concurrent-accept race is unverified.
- **Acceptance:** 6+ pgTAP cases (valid, expired, email-mismatch, already-consumed, concurrent-accept, post-accept membership state). Existing RLS unchanged.

#### OOP-002 — Enable RLS + pgTAP on `journal_reactions`
- **Zone:** supabase · **Category:** `missing-RLS` + `coverage-gap` · **Risk:** HIGH · **Effort:** S (1–2h)
- **File:** `supabase/migrations/20260327234330_core_schema.sql:120-128`; new migration + new pgTAP test.
- **Why:** Table exists with `UNIQUE(event_id, user_id)` upsert but **RLS is not enabled** — silent access to all rows. CONTEXT.md term "Journal Reaction" depends on this.
- **Acceptance:** ENABLE RLS, add SELECT (team-access via event→recipient join), INSERT/UPDATE (`user_id = auth.uid()` + team), no DELETE. pgTAP covers own/other/team/upsert. Behavior preserved: app currently never relied on cross-user reaction reads.

#### OOP-003 — pgTAP for messaging triad (`message_threads`, `message_thread_members`, `messages`)
- **Zone:** supabase · **Category:** `coverage-gap` · **Risk:** MEDIUM-HIGH · **Effort:** M (3–4h)
- **File:** `supabase/migrations/20260422000000_messaging.sql`; new `supabase/tests/messaging_rls.test.sql`.
- **Why:** Three-table module with `is_thread_member()` helper, soft-delete, creator-gating — zero tests. Thread-isolation untested.
- **Acceptance:** 8–10 cases covering thread isolation, creator-only member insert, sender soft-delete, cross-thread denial, DM discovery via `find_dm_thread()`. RLS untouched.

#### OOP-004 — OCR job state machine + row-level lock
- **Zone:** web · **Category:** `procedural-where-OOP-fits` · **Risk:** MEDIUM · **Effort:** M (3–4h)
- **Files:** `apps/web/app/api/ocr/{upload,review,confirm,discard,save-fields}/route.ts`; extract `apps/web/lib/ocr/jobStateMachine.ts`.
- **Why:** Five routes independently read → validate → transition → write the same row with no pessimistic lock. Production concurrency risk (two clients can both confirm).
- **Acceptance:** Single `OcrJobStateMachine` class with `transitionTo()`. Use Supabase `select … for update` or a SQL function with explicit lock. Routes delegate. HTTP contracts (200/400/403) unchanged; existing tests pin response shape.

### Wave B — architectural hotspots

#### OOP-005 — `CareEvent` payload discriminated union + type guards
- **Zone:** web · **Category:** `leaky-abstraction` · **Risk:** LOW · **Effort:** M (2–3h)
- **Files:** `apps/web/lib/handoffSummary.ts:146`, `lib/medAdherenceFromEvents.ts:61`, `lib/sleepFromEvents.ts:22-30`, `app/(app)/journal/[recipientId]/JournalTimeline.tsx:148-151`, `components/VisitSummary.tsx`, `app/api/history/export/pdf/route.tsx:93`. New: `apps/web/lib/careEvent.ts` exporting union + guards.
- **Why:** Inline `typeof e.payload.text / .mood / .hours / .action` checks repeat in 4+ files. Implicit JSONB schema. Future event types compound the drift.
- **Acceptance:** Discriminated union `CareEvent = MedicationEvent | JournalEvent | SymptomEvent | AppointmentEvent | ShiftEvent | ExpenseEvent | HandoffEvent` keyed on `event_type` literal. Guards `isMedicationEvent(e)` etc. exported. Callers import guards. Vitest behavior identical. **Unblocks OOP-006, OOP-007, OOP-008.**

#### OOP-006 — Brief headline classifier → strategy chain
- **Zone:** web · **Category:** `cyclomatic-hotspot` · **Risk:** MEDIUM · **Effort:** M (3–4h)
- **File:** `apps/web/lib/brief/headline.ts:74-192` (118-line, 7-branch function).
- **Why:** 7 ordered branches (empty/crisis/flagged/difficult_run/single_entry/quiet_stable/default). Comment at L18 reserves space for `meds_missed`, `mood_drop`. Linear extension via if-else is the cost we're paying.
- **Acceptance:** `HeadlineStrategy` interface with `classify(input): ClassifiedHeadline | null`; 7 ordered concrete strategies; dispatcher loop returns first non-null. Branch parity verified by existing `lib/__tests__/headline*.test.ts`.

#### OOP-007 — RLS helper `is_org_coordinator(uuid)` to dedupe ~23 inline checks
- **Zone:** supabase · **Category:** `helper-vacuum` · **Risk:** MEDIUM · **Effort:** S–M (2–3h)
- **Files:** ~23 policies across `care_recipients`, `memberships`, `shifts`, `coverage_windows`, `benefits_screenings`, `documents`, `eol_plans`, `ocr_jobs`, …
- **Why:** Same `EXISTS(SELECT 1 FROM memberships WHERE ... role='coordinator' AND accepted_at IS NOT NULL)` block copy-pasted ~23×. Future role tweaks ripple to 23 migrations.
- **Acceptance:** New `is_org_coordinator(p_org_id uuid) returns bool` SQL helper (mirror existing `user_is_org_coordinator()` if absent). Migration rewrites the 23 USING/WITH CHECK clauses to call it. pgTAP suite unchanged in pass/fail; add 1 sanity test for the helper.

#### OOP-008 — Standardize immutability enforcement (triggers, not silence)
- **Zone:** supabase · **Category:** `inconsistent-pattern` · **Risk:** MEDIUM · **Effort:** M (3–4h)
- **Files:** `shift_questions` (trigger ✓), `care_briefs.recipient_id` (silent — no policy), `visit_recordings.care_event_id` (unrestricted post-confirm).
- **Why:** Three patterns for the same intent. Silent immutability bites when a developer adds a permissive UPDATE policy later.
- **Acceptance:** All audit-critical immutable columns enforced by BEFORE UPDATE triggers. Schema comment cites the policy. pgTAP for each trigger.

### Wave C — leaky abstractions & shallow modules

#### OOP-009 — Mobile `Offline Queue` mutation routing via `PayloadMutator`
- **Zone:** mobile · **Category:** `duplicated-shape` · **Risk:** LOW · **Effort:** M (3–4h)
- **File:** `apps/mobile/hooks/useOfflineWrite.ts:15-71` + per-mutator files under `apps/mobile/lib/offlineMutators/`.
- **Why:** Inline `MutationMap` projects `write.payload` and builds tRPC args by hand for three event kinds. Brittle to payload-shape changes.
- **Acceptance:** `PayloadMutator` interface + `JournalMutator`, `MedicationMutator`, `SymptomMutator`. Hook composes via registry. Same retry/idempotency contract.

#### OOP-010 — Mobile `AsyncStorage` key registry
- **Zone:** mobile · **Category:** `shallow-module` · **Risk:** LOW · **Effort:** S (1h)
- **File:** new `apps/mobile/lib/asyncStorageKeys.ts`; update `lib/onboarding.ts:3` + 2 other call sites.
- **Why:** Magic strings (`"onboarding_complete"`) with no namespace/versioning. Collision risk grows with feature count.
- **Acceptance:** Central `KEYS = { onboarding, pushToken, inviteToken } = "v1:carelog:…"`. Single read-path migration for pre-existing key value if any.

#### OOP-011 — Mobile tRPC `useMutationWithRefresh` composable
- **Zone:** mobile · **Category:** `duplicated-shape` · **Risk:** LOW · **Effort:** S (1–2h)
- **Files:** `apps/mobile/app/(app)/journal/index.tsx:45-51`, `journal/[eventId].tsx`, `outer-circle/index.tsx:45-62`, +~15 more screens.
- **Why:** Every screen hand-rolls `useQuery + useMutation({onSuccess: refetch})`.
- **Acceptance:** Per-router hooks (e.g. `useJournalEntries()`) or one generic `useMutationWithRefresh`. Screens collapse 3 hook calls → 1. Loading/error parity verified.

#### OOP-012 — `HandoffSummary` name hydration via `NameResolver` injection
- **Zone:** web · **Category:** `leaky-encapsulation` · **Risk:** LOW · **Effort:** S (1–2h)
- **File:** `apps/web/lib/handoffSummary.ts:99-104`, +callers.
- **Why:** Callers must construct an `actorNameMap` before calling. Fallback to "Team member" silently loses context if map incomplete.
- **Acceptance:** `NameResolver` interface w/ `getName(id) → string | null`. Builder accepts the resolver. `CachedNameResolver` reference impl. Output identical.

#### OOP-013 — Mobile push notification `NotificationRouter` registry
- **Zone:** mobile · **Category:** `procedural-where-OOP-fits` · **Risk:** LOW · **Effort:** M (2–3h)
- **File:** `apps/mobile/app/_layout.tsx:68-82`.
- **Why:** Hardcoded `if (data?.screen === "ocr-review" && data?.jobId)` only handles OCR. Future screen types add an if. Push payload `{jobId?, screen?}` shape inferred, not typed.
- **Acceptance:** `NotificationPayload` Zod schema; `NotificationRouter` interface; per-screen routers (OCR + at least one placeholder); root dispatcher loop. Only OCR routing active; others lazy.

#### OOP-014 — Mobile `useSyncStatus` singleton + AppState-aware polling
- **Zone:** mobile · **Category:** `procedural-where-OOP-fits` · **Risk:** LOW · **Effort:** M (2–3h)
- **File:** `apps/mobile/hooks/useSyncStatus.ts:18-23`.
- **Why:** Independent 2-s `setInterval` per consumer (3 screens) → device wake even when backgrounded. No adaptive backoff.
- **Acceptance:** Single `SyncStatusManager` context owning one timer. AppState listener pauses on background. Values + cadence unchanged on foreground.

#### OOP-015 — Stripe webhook switch → handler map
- **Zone:** cross · **Category:** `procedural-where-OOP-fits` · **Risk:** LOW · **Effort:** S–M (1.5–3h)
- **File:** `apps/web/app/api/stripe/webhook/route.ts:22-120`.
- **Why:** Single switch for 4 event types; adding new types means editing the route. Webhook exception routing currently sinks to PostHog instead of Sentry (companion fix).
- **Acceptance:** `handlers: Record<string, (event) => Promise<void>>` map. Per-event handler module under `apps/web/app/api/stripe/webhook/handlers/`. Error path routes to `Sentry.captureException` with `{ event_type }` tag only (no PII).

---

## Deferred / not seeded

These surfaced but don't warrant a backlog row right now:

- **Inngest handler renaming to kebab-case verbs** (cross §4) — cosmetic; cost > benefit.
- **`packages/utils` and `packages/types` audits** — both clean. No action.
- **Sentry `setUser` / `setContext` decision** — needs product call first (intentional gap vs. real gap). Surface for discussion before seeding.
- **`display_names` denormalization** — necessary because `identity_vault` is service-role-only. Document, don't refactor.
- **`outer_circle` token rotation chain** — UX-driven; needs product input before schema work.
- **Several "extract a form hook" sites** (`SymptomPanel`, `MedicationPanel`, `ShiftForm`) — duplicates of the same pattern. Bundle into one `OOP-016` later if Wave A/B leave appetite.
- **`shiftLayouts` timezone bug** — actual behavior change required; **not** invariant-preserving. Spin out as a `TD-*` row, not `OOP-*`.

---

## Recommended sprint order

1. **First /sprint:** OOP-001 + OOP-002 + OOP-007 (supabase Wave A — fastest correctness wins, mostly parallelizable).
2. **Second /sprint:** OOP-003 + OOP-004 + OOP-005 (foundational types & messaging coverage; OOP-005 unblocks Wave B web work).
3. **Third /sprint:** OOP-006 + OOP-008 + OOP-012 (web architectural cleanup, depends on OOP-005).
4. **Fourth /sprint:** Mobile cluster (OOP-009, OOP-010, OOP-011, OOP-013, OOP-014) — all low-risk, parallelizable.
5. **Fifth /sprint:** OOP-015 (Stripe webhook cleanup standalone).

`/sprint` will pick from §1 Ready in `BACKLOG.md`; the seeding PR (next step) writes these rows with `Status: 🟢 Ready` and adjacent metadata.
