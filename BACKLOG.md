# Carelog — Master Backlog

> **This is the single source of truth for all planned work.** Every task — feature, bug, tech debt, infra, polish — is tracked here with a lifecycle status. Read this file **before** starting any task. Update it **immediately** when status changes. If it isn't here, it isn't planned. Run `/backlog-sync` at least once a day (and on session start) to reconcile against git/PRs.

Last consolidated: **2026-04-16** (codebase scan same day). Last `/backlog-sync`: **2026-04-29 PM** — promoted TD-88 (PR #300), TD-89 (PR #298), TD-94 (#304), TD-95 (#305), TD-96 (#306), TD-97 (#307), TD-99 (#302) to ✅ Shipped. Hardening audit added 13 rows in PR #301 — TD-98, TD-100..104, A11Y-019, UX-053 confirmed still Ready.

Replaces: `BACKLOG_PHASE2–5.md`, `BACKLOG_UI_REDESIGN.md`, `docs/superpowers/plans/CLAUDE_BACKLOG.md`. `BUILD_STATUS.md` and `TECH_DEBT.md` are **historical logs only** — new work is tracked here.

Human account-signup tasks (Supabase/Vercel/Stripe/etc.) live in `docs/project-info/runbooks/THIRD_PARTY_SETUP.md` and are referenced from §8.

---

Human Backlog Items:
- ability to schedule team wide meetings and embed zoom links


## 0. Status board (at-a-glance)

Counts reflect items in §1–§6 only; §7 is the shipped log.

| Lifecycle | Count | Where |
|---|---|---|
| 🟢 Ready | 28 | TD-03 · TD-77..82 · TD-87 · TD-98 · TD-100..104 · A11Y-019 · UX-035 · UX-041..045 · UX-048..051 · UX-053 · PP-009 · LAUNCH-004 |
| 🔎 In review | 0 | — |
| 🟡 Spike | 1 | UX-046 (clinician-share surface) |
| 🔴 Blocked | 0 | — |
| 🧊 Deferred | 9 | §5 ON-55 · ON-69 · §6 UX-08/09/11/22/23/24 · §3 PP-013 |
| 🧑 Needs human | 8 | §5 ON-54 · §8 A2 · C3 · PP-008 · §4 A11Y-018 · §1 LAUNCH-001 · LAUNCH-005 · TD-83 |

> If this table looks stale, run `/backlog-sync` — it rewrites it from the story rows below.

---

## Legend

| Tag | Meaning |
|---|---|
| 🟢 | **Ready** — scoped, unblocked, not yet picked up |
| ⚡ | **In progress** — an agent or human is actively working on it |
| 🔎 | **In review** — PR open, awaiting review or CI |
| 🧊 | **Deferred** — intentionally parked |
| ✅ | **Shipped** — moved to §7 |
| 🔴 | **Blocked** — prerequisite open; note `Blocked by:` inline |
| 🧑 | **Needs human** — account signup, env var, click-through — see §8 |

Every active row **must** include a `Status:` field (`Ready` / `In progress` / `In review` / `Blocked` / `Shipped`) and, when applicable, `Owner:` (agent name or human) and `Branch:`/`PR:` once work starts. `/backlog-sync` fills what it can infer.

**Story-ID prefixes**
- `ON-*` — general stories (mobile a11y, mechanical sweeps, large features)
- `PP-*` — platform parity (web/iOS/Android)
- `A11Y-*` — accessibility tooling
- `UX-*` — deferred UI redesign polish
- `TD-*` — tech debt (newly opened; historical items live in `docs/project-info/technology/TECH_DEBT.md`)
- `LAUNCH-*` — launch readiness (App Store, EAS, web go-live, observability, compliance)
- `P2-*`..`P5-*` — phase backlogs (all shipped, retained as a log in §7)
- `B*`/`D*`/`A*`/`C*` — before-launch Claude tasks (shipped where no 🧑 gate)

---

## 1. Active / next-up

| ID | Status | Owner | Branch / PR | Story | Notes |
|---|---|---|---|---|---|
| ON-49 | ✅ Shipped · PR #108 | — | — | **Shift completion → handoff note prompt** | When a shift transitions to `completed`, show inline prompt (web ShiftList + mobile schedule) for an optional handoff note. Creates a `care_event` with `entry_type='handoff'`. The `handoff` enum value already exists in the DB. |
| ON-50 | ✅ Shipped · PR #106 | — | — | **Weekly digest: medications adherence section** | Add a missed-dose summary to the Sunday Inngest digest. Query `care_events` for `event_type='medication'` last week, surface missed vs given count. `weeklyDigest.ts` already has journal + mood + shifts but no meds section. |
| ON-51 | ✅ Shipped · PR #109 | — | — | **Aide recipient-scoping in invite + team admin** | When inviting as role='aide', show a recipient picker that sets `recipient_id` on the membership row. DB already has `recipient_id` on `memberships` with an index; the invite form and TeamAdmin currently ignore it. |
| ON-52 | ✅ Shipped · PR #101 | — | — | **Care history depth counter on dashboard** | Shows care event count + months of history per team; parallel Supabase queries + `formatCareStats` pure helper + 6 unit tests. |
| ON-53 | ✅ Shipped · PR #100 | — | — | **CareZone alternative landing page** | `/carezone-alternative` hero, CareZone comparison table, medication import preview tool; MarketingNav linked ("CareZone users"). |
| ON-57 | ✅ Shipped · PR #105 | — | — | **Family referral share link** | Coordinator dashboard button: "Refer Carelog to another family." Generates a shareable `/signup?ref=<orgSlug>` URL (new-org referral, not a team invite). PostHog tracks `referral_shared` + `referral_converted` events. Referral source stored on new org row. Key KPI: 60% referral rate by month 6 (PRODUCT_STRATEGY.md). ~1 day. |
| ON-58 | ✅ Shipped · PR #103 | — | — | **Analytics: onboarding + retention funnel events** | Add PostHog events: `onboarding_step_completed` (step name, elapsed_ms), `first_care_event_created` (elapsed_ms since signup), `team_member_invited` (team_size property). Powers PRODUCT_STRATEGY.md KPIs: "time to first care event < 10 min" + "week 4 retention 70%+." PHI rule: UUID only — no names or emails. ~0.5 day. |

### New tech-debt (TD-*) — opened 2026-04-14

| ID | Status | Story | Notes |
|---|---|---|---|
| TD-02 | ✅ Shipped · PR #87 | **Dynamic Type + screen-reader audit (mobile)** | scaledFont + accessibilityLabel sweep shipped. Physical device VoiceOver verification deferred to human. |
| TD-03 | 🟢 Ready | **Sentry source maps upload** | BUILD_STATUS: "source maps pending `SENTRY_AUTH_TOKEN`". Needs 🧑 env var in Vercel. |
| TD-12 | ✅ Shipped · PR #118 | **Fix missing Dialog + Label UI components** | Created `dialog.tsx` + `label.tsx` wrapping @base-ui/react; unskipped test files. |
| TD-13 | ✅ Shipped · PR #116 | **CommentThread mutation error handling** | Added `onError: () => toast.error(...)` to add/edit/remove mutations; 3 new tests. |
| TD-11 | ✅ Shipped · 2026-04-17 | **data-testid sweep for medication components** | All data-testids already existed in MedicationPanel.tsx + MedicationChecklist.tsx; e2e spec already uses them. No code changes needed. |
| TD-06 | ✅ Shipped · PR #98 | **Add `dark:` variants to ON-44/ON-45 components** | dark: sweep across Comment + TradeRequest components; contrast patch (avatar/badge gray-900+gray-50, fixed hover) committed directly to main. |
| TD-07 | ✅ Shipped · PR #94 | **Alert → Toast sweep** | Replaced 6 `alert()` calls with sonner toasts across JournalClient, settings, subscriptions, TeamAdmin. Invite URL now copies to clipboard before toast. |
| TD-08 | ✅ Shipped · PR #95 | **Supabase types regen + `as any` cleanup** | Regenerated `database.types.ts`; removed 10 `as any` casts from `careEventCommentsRepository.ts`. |
| TD-09 | ✅ Shipped · PR #96 | **ShiftList edit mode** | Added `shifts.update` tRPC mutation + ShiftForm edit-mode props + inline edit panel in ShiftList with `editingShift` state. |
| TD-10 | ✅ Shipped · PR #97 | **JournalClient refactor** | Extracted `useJournalData`, `useOfflineQueue`, `useJournalActions` hooks + `JournalLayout` component. JournalClient.tsx: 624 → 107 lines. |
| TD-14 | ✅ Shipped · PR #132 | **Restore green CI: clear 491 lint errors** | Downgraded `no-explicit-any`, `no-unescaped-entities`, `react-hooks/set-state-in-effect` to warn; hand-fixed 6 remaining errors (`@ts-ignore` → `@ts-expect-error`, targeted a11y disables in `ShiftPopover.tsx`). Contrast script token-drift bug (`#ef4444` vs `#c41a1a`) fixed in same PR. 1010 tests green. |
| TD-15 | ✅ Shipped · PR #131 | **Fix CI infra: lockfile drift + workflow script-name bugs** | (a) `apps/mobile/package.json` had `expo-web-browser` declared without lockfile regen → every CI job failed at `pnpm install --frozen-lockfile`. Fixed by `pnpm install`. (b) `.github/workflows/ci.yml` Typecheck job ran `pnpm typecheck` (typo, root script is `type-check`). (c) Web-tests job ran `pnpm test:coverage` from `apps/web/` (script lives at root). Both fixed by matching the local pre-commit hook pattern (`npx vitest run` from apps/web). |
| TD-16 | ✅ Shipped · PR #132 + #134 | **Clear web typecheck errors + wire CI to catch them** | PR #132 cut `apps/web` tsc errors 147→43 (Next.js 15 Promise params, Supabase types, vitest-globals.d.ts). PR #134 drove remaining 43→0 across 27 files; updated CI workflow to run `cd apps/web && npx tsc --noEmit` instead of silently skipping (root script only covers root). 1111 tests green. |
| TD-17 | ✅ Shipped · PR #141 | **Green mobile Jest suite + CI on PRs** | 7 test files red, 11 tests. Root causes: (1) `scaledFont` missing `Math.round()` → float output; (2) `expo-device` not in pnpm store → virtual mock needed; (3) 5 screen tests had stale empty-state text + schedule trpc mock missing `useUtils`/`shiftTradeRequests`/`completeMutation`; (4) `usePushNotifications` simulator test used dynamic `import()` incompatible with Jest CJS transform; (5) Journal BottomSheet uses Modal+Animated which test-renderer can't pierce — mocked inline. CI `mobile-tests` job already runs on `pull_request:` trigger (confirmed, no yml change needed). |
| TD-20 | ✅ Shipped · PR #140 | **Restore 4 quarantined RLS pgTAP tests** | `ai_conversations_rls`, `education_tip_cache_rls`, `medication_tagging_rls`, `shift_trade_requests_rls` — replaced non-existent `tests.create_supabase_user()` helper with canonical `INSERT INTO auth.users` + `SET LOCAL ROLE` + JWT pattern; fixed invalid (non-hex) UUID literals; corrected `shifts` table column names; `_quarantined-tests/` dir now empty. |
| TD-21 | ✅ Shipped (partial) · PR #148 | **CVE bumps shipped; flip-to-blocking deferred to TD-29** | Bumped Next.js → 16.2.3, protobufjs → 8.0.1 (via root pnpm override), @xmldom/xmldom → 0.9.10 (via root pnpm override). Flipping scanners to blocking surfaced ~25 long-tail transitive findings — reverted to warn-only with TD-29 follow-up. The CRITICAL RCE + DoS bumps still landed. |
| TD-23 | ✅ Shipped · PR #148 | **SHA-pin all workflow action refs + checksum OSV binary** | Pinned 5 actions across both `security.yml` and `ci.yml` to immutable SHAs (with `# v1.2.3` end-of-line comments): `actions/checkout@v4.2.2`, `actions/setup-node@v4.4.0`, `pnpm/action-setup@v3.0.0`, `gitleaks/gitleaks-action@v2.3.9`, `aquasecurity/trivy-action@v0.30.0`. Added `sha256sum -c` against `c52d68f8...` for the OSV binary download — fails loudly on mismatch. |
| TD-29 | ✅ Shipped · PR #165 | **Long-tail transitive vuln triage (followup to TD-21)** | Surfaced when TD-21 flipped scanners to blocking on 2026-04-25; reverted to warn-only after PR #148 merged. Three classes: (1) `apps/web/pnpm-lock.yaml` is a separate lockfile not refreshed by root `pnpm install` — needs `cd apps/web && pnpm install` or unification; (2) `apps/mobile/package-lock.json` is npm-format not pnpm — pnpm overrides don't apply, need `apps/mobile/package.json` direct bumps; (3) root has dompurify / follow-redirects / hono / vite / postcss / uuid HIGH advisories not covered by current overrides. After triage, remove `continue-on-error` from OSV/Trivy/pnpm-audit jobs in `security.yml` (look for `# TD-29` comments). ~0.5 day. |
| TD-22 | ✅ Shipped · PR #147 | **Billing tRPC router (unblocks PP-014)** | `apps/web/server/routers/billing.ts` — `billing.getSubscription` query reads org plan + seat count from `organizations` + `memberships` tables; registered on `appRouter`; 4 tests (happy path, no-membership null, free-plan null, UNAUTHORIZED). No Stripe API call; no new migration. |

### Operational monitoring TDs — opened 2026-04-27

| ID | Status | Story | Notes |
|---|---|---|---|
| TD-73 | ✅ Shipped · PR #227 | **Production rate-limit dashboard** | Vercel + Inngest 429 monitoring with Sentry/Slack alert when 429 rate > 1% in 5-min window. |
| TD-74 | ✅ Shipped · PR #227 | **Weekly digest delivery monitoring** | Inngest `digestDeliveryMonitor` alerts when Sunday send count < 80% of org count. |
| TD-75 | ✅ Shipped · PR #227 | **Weekly E2E green-streak gate** | `scripts/check-e2e-streak.mjs` + `.github/workflows/e2e-streak-gate.yml` block merge queue on >3 consecutive red nightly E2E runs. |

### Wave 5 discovery batch (TD-76..84) — opened 2026-04-27

Surfaced by parallel pre-flight + test-gap audits (`docs/plans/WAVE5_DISCOVERY_REPORT.md`). The Codex adversarial leg of the audit produced no output (TD-84 re-runs it). Total ~10 hr if executed serially; designed to fan out via TDD dispatch in Wave 7+.

| ID | Status | Story | Notes |
|---|---|---|---|
| TD-76 | ✅ Shipped · PR #230 | **Regenerate `database.types.ts`** | Drift covered the C1+C2 security migrations; net +285/-3 lines after `npx supabase gen types typescript --local`. Stale types had been masking RLS schema changes at the type-checker level. |
| TD-77 | 🟢 Ready | **Tests for `identityRepository.ts` (Tier 1 — PHI vault)** | Uses `supabaseAdmin` (no RLS protection). Untested cross-org `resolveIdentity(token, org_id)` could leak names/DOB/contact between orgs in a silent regression. New file: `apps/web/server/repositories/__tests__/identityRepository.test.ts`. Test (a) cross-org token rejection, (b) malformed token, (c) expired token. ~2 hr. |
| TD-78 | 🟢 Ready | **Tests for `user.ts` tRPC router (Tier 1 — auth boundary)** | Zero auth-boundary tests. `IANA_TIMEZONE_PATTERN` regex untested for bypass (e.g. `"../../../"`); `dismissEducationTip` date math untested for off-by-one. New file: `apps/web/server/routers/__tests__/user.test.ts`. Test (a) `ctx.user = null` → 401, (b) timezone regex valid/invalid/empty, (c) dismissEducationTip date math, (d) updateNotifications upsert idempotency. ~1.5 hr. |
| TD-79 | 🟢 Ready | **Tests for `careEventsRepository.ts` (Tier 1 — core PHI write)** | No `validatePayload()` regression net + no org_id/recipient_id isolation test for `getTimeline`. RLS covers DB layer; this is the helper layer. New file: `apps/web/server/repositories/__tests__/careEventsRepository.test.ts`. Test (a) invalid payload throws before DB write, (b) cross-recipient timeline returns empty, (c) `insertEvent()` respects org_id boundary. ~1.5 hr. |
| TD-80 | 🟢 Ready | **Tests for `lib/stripe.ts` (Tier 1 — payment infra)** | Singleton init throws if `STRIPE_SECRET_KEY` missing. Zero test asserting the error path; affects every checkout/upgrade. New file: `apps/web/lib/__tests__/stripe.test.ts`. Test (a) missing env → clear error message, (b) singleton returns same instance, (c) API version `"2026-03-25.dahlia"` is current. ~0.5 hr. |
| TD-81 | 🟢 Ready | **Tests for `organizationsRepository.ts` (Tier 2 — team isolation)** | Cross-org query (org_id unfiltered) could be silent in CI if test fixtures don't span orgs. New file: `apps/web/server/repositories/__tests__/organizationsRepository.test.ts`. Test cross-org fixtures + org UUID assignment. ~1.5 hr. |
| TD-82 | 🟢 Ready | **RLS test stub for `care_events_client_id` migration** | `20260416000001_care_events_client_id.sql` has no dedicated test. Either add a minimal `supabase/tests/care_events_client_id.test.sql` or document why it's covered by the existing `care_events_rls.test.sql`. ~0.5 hr. |
| TD-83 | 🧑 Needs human | **Verify `CI Summary` is in main branch protection** | Pre-flight audit couldn't read protection config (no PAT in shell). Manually verify via GitHub UI: Settings → Branches → main → required checks includes `CI Summary` (per TD-30). If missing, add via API. ~0.25 hr. |

### Lighthouse a11y CI gating gap (TD-87) — opened 2026-04-29

Discovered during `/impeccable critique` post-merge verification of PR #269. The CI Lighthouse a11y workflow ran on the merged main but reported "success" without auditing anything — Vercel preview deployments are auth-gated (HTTP 401), and `scripts/lighthouse-a11y.mjs:27-33` treats 401/403 as a non-blocking skip. Net effect: the a11y score gate has been silently inactive on every preview-driven CI run. Local Lighthouse on the actual marketing routes still passed (96 / 100 / 94 on /, /about, /pricing) so no regression slipped through this time, but the gate is not protecting us.

| ID | Status | Story | Notes |
|---|---|---|---|
| TD-87 | 🟢 Ready | **Restore Lighthouse a11y gating in CI** | The 401/403 skip path was added intentionally to handle Vercel preview auth, but it left no working enforcement path. Three possible fixes: (a) configure Vercel project to disable password protection on preview deployments for marketing routes (simplest, but exposes pre-merge marketing builds); (b) run Lighthouse against a Playwright-served local build inside the CI job (slower but airtight); (c) skip on auth and run a separate post-deploy job against production after the merge lands. Pick one, implement, and verify by intentionally introducing a low-contrast element on a feature branch and confirming the workflow now fails. ~2 hr. |

### Extract candidates from /impeccable extract Phase A (TD-88..93) — opened 2026-04-29

| ID | Status | Title | Notes |
|---|---|---|---|
| TD-88 | ✅ Shipped · PR #300 | **Extract `lib/format.ts` — date/time formatter helpers** | `/impeccable extract` Phase A: 8 copy-pasted `formatDate`/`formatTime` functions across `MedCard.tsx:14`, `VisitSummary.tsx:64`, `care/[shareToken]/page.tsx:33`, `api/export/ExportDocument.tsx:93`, `JournalTimeline.tsx:53,308`, `EntryDetailClient.tsx:30`, `BriefEditorial.tsx:37`, plus 12+ inline `toLocale*` calls. Lift to `apps/web/lib/format.ts` exporting `formatLongDate`, `formatShortDate`, `formatTimeOfDay`, `formatDateTime`. Keep `MedCard.formatTime(HH:MM:SS)` separate (different intent — clock string, not ISO) — expose as `formatClockTime(hms)`. ~20 consumer migrations. S+M effort. See `apps/web/extract-candidates.md` candidate #2. |
| TD-89 | ✅ Shipped · PR #298 | **Extract `<FormActionRow>` — Save/Cancel form footer** | `/impeccable extract` Phase A. Lifted to `apps/web/components/ui/FormActionRow.tsx`. Subagent migrated only 2 of 12 audit-listed sites (MedicationPanel, ShiftForm) — the other 10 had subtly non-canonical footers (full-width single Submit, raw `<button>` Cancel, outline-variant Cancel, action-grid not form-footer) and were left untouched to preserve byte-identical DOM. Remaining sites can adopt FormActionRow opportunistically as their forms get touched. |

### Hardening audit (TD-94..104, A11Y-019, UX-053) — opened 2026-04-29

Source: `/impeccable harden` audit against the whole web app on 2026-04-29 (`/tmp/harden-audit-2026-04-29.md`). 184 source files / 13 `(app)` routes scanned. Findings ranked High/Med/Low. The four High-severity items (TD-94, TD-96, TD-97, TD-99) are file-disjoint and TDD-friendly — natural fit for a 4-track `/dispatch` wave. Items already in good shape (reduced motion, mood color+text pairing, focus rings, logical CSS direction, offline queue architecture) intentionally **not** filed.

| ID | Status | Story | Notes |
|---|---|---|---|
| TD-94 | ✅ Shipped · PR #304 | **`AbortController` for in-effect fetches + tRPC** | High severity. Zero `AbortController` usages across the entire web app. Every `useEffect`-triggered `fetch` and every tRPC query that fires during navigation continues to completion after unmount; race conditions on fast tab-switching (e.g. between recipients on `/journal/[recipientId]`) can stomp later state with earlier responses. Confirmed site: `apps/web/app/(app)/journal/[recipientId]/JournalTimeline.tsx` raw `fetch(url)` in effect with no signal. Fix: add a `useAbortable` hook in `apps/web/hooks/`, plumb `signal` through all in-effect fetches and tRPC queries that own a long-lived subscription. ~3 hr. |
| TD-95 | ✅ Shipped · PR #305 | **Explicit `Intl.*Format` instances in `lib/format.ts`** | High severity. TD-88 just shipped 11 date/time helpers but they still rely on the runtime locale with `.toLocaleDateString` / `.toLocaleTimeString` and no explicit options. Net `Intl.*Format` usage in app code (excl. comments) = zero. Locale-stable formatting is impossible to test, dates render inconsistently SSR vs. client, and there's no path to localized number/currency. Migrate the helpers to construct cached `Intl.DateTimeFormat` / `Intl.NumberFormat` / `Intl.RelativeTimeFormat` instances with explicit options. Pairs with TD-104. ~2 hr. |
| TD-96 | ✅ Shipped · PR #306 | **Surface every mutation failure in journal panels** | High severity. 6 silent / lossy `catch {}` blocks in journal flows. `JournalTimeline.tsx:106` swallows network errors after an optimistic update with only "Rollback on network error" — no toast, no surface. `OuterCirclePanel.tsx:97` is fully silent. `OcrReviewPanel.tsx:85`, `ExportButton.tsx:61`, `OuterCirclePanel.tsx:87` set local error state but never surface it via toast. User gets no signal that their action failed (especially bad when the optimistic update made it look like the action succeeded). Standardize: every `catch` in a mutation path emits a sonner toast with retry affordance + rolls back optimistic state. ~3 hr. |
| TD-97 | ✅ Shipped · PR #307 | **`disabled={mutation.isPending}` on every form submit** | High severity. ~11 disabled-while-pending guards across all submit handlers. Most submit buttons are not disabled while the mutation is in flight — mashing Submit on a slow connection enqueues N duplicate inserts. Highest risk on the offline-queue path, which already replays writes. Audit every `<form onSubmit>` and every primary action button calling a `useMutation`; add `disabled={mutation.isPending}` + idempotency assertion where the server can't dedupe. Test plan: a single component test per form that simulates 5 rapid clicks and asserts the mutation fired exactly once. ~4 hr. |
| TD-98 | 🟢 Ready | **Text overflow / truncation pass on cards** | Med severity. `apps/web/components/dashboard/MedCard.tsx:192-200`: `<span className="flex-1 …">{med.name} · {med.dose}</span>` has no `min-w-0` / `truncate`. A 60-char drug name (e.g. *"Methylphenidate hydrochloride extended-release 36 mg"*) overflows the card or pushes the Log button off-screen on 320px. The `aria-label` on the Log button also inflates. Same risk: RecipientHeader, ShiftEventCard, JournalTimeline entry titles. Apply `min-w-0 truncate` (or 2-line clamp) and add a 60+ char fixture to the relevant component test. ~2 hr. |
| TD-99 | ✅ Shipped · PR #302 | **Per-route `error.tsx` boundaries** | High severity. Only `/dashboard` and `/journal/[recipientId]` have `error.tsx` boundaries. Settings, Messages, Education, Subscriptions, Billing, Visit Summary, History Export, Team Admin all crash to the root error boundary on any render error — losing in-flight form state. Add per-route `error.tsx` with retry + "go back" affordance to all 8 missing routes. ~2 hr. |
| TD-100 | 🟢 Ready | **Journal timeline cursor pagination + virtualization** | Med severity. `JournalTimeline.tsx` renders all DOM nodes for the recipient — a recipient with 2000 journal entries (a year of daily logs + meds) creates a heavy DOM tree. No `react-window` / `@tanstack/virtual` / cursor on the read path. Add cursor pagination + `IntersectionObserver` "load more" with a 200-entry threshold for client-side render. ~4 hr. |
| TD-101 | 🟢 Ready (low priority) | **RTL smoke test** | Med severity. 107 tailwind logical-direction utility usages (`ms-/me-/ps-/pe-`) — solid baseline. But: zero `dir="rtl"` test fixture, custom CSS in `globals.css` uses physical properties in spots, app-shell rail is left-anchored without an inline-start variant. Not currently a shipped concern, but if CareSync expands to Spanish-speaking caregivers (a real persona) the editorial Fraunces blocks need an RTL audit. Add an RTL smoke test that loads `/dashboard` with `dir="rtl"` and screenshots the result. ~2 hr. |
| TD-102 | 🟢 Ready | **`mutations.retry: 0` in TrpcProvider** | Med severity. `apps/web/components/providers/TrpcProvider.tsx:16` sets `retry: 1` globally. For idempotent reads this is fine; for the implicit retries on `useMutation` it's silent and may double-write if the request reached the server but the response was lost. Set `mutations.retry: 0` explicitly; add explicit retry buttons on the surfaces that need them (handled by TD-96). ~0.5 hr. |
| TD-103 | 🟢 Ready (low priority) | **Debounce journal + messages search inputs** | Low severity. No debounce on the journal search/filter inputs (sampled `JournalTimeline` filter row). `useMemo` filtering 200+ entries per keystroke is OK locally but stutters on cheap Android. Wrap journal filter in 200ms debounce; same pass for `/messages` search. Pairs naturally with TD-100. ~1 hr. |
| TD-104 | 🟢 Ready (low priority) | **`pluralize(count, singular, plural)` helper** | Low severity. Currently zero `count !== 1 ? 's' : ''` ternaries (good — already cleaner than typical) but no helper exists either, so the pattern will reappear. Add `pluralize()` helper using `Intl.PluralRules` (or a thin string fallback); migrate 5–10 sites where "1 entry" / "2 entries" is currently hardcoded. Pairs with TD-95. ~1 hr. |
| A11Y-019 | 🟢 Ready | **SR-only live region for offline-queue + optimistic-update transitions** | Med severity. 23 `aria-live` / `role=status` usages across the app — sounds like coverage but most are decorative. The optimistic-update path in `JournalTimeline.tsx` and the offline-queue replay flow have **no live region** to announce "logged" / "queued offline" / "synced" / "rollback" to a screen reader. Mood color+text pairing rule is already honored everywhere sampled. Add a single SR-only `aria-live="polite"` region that subscribes to offline-queue events and optimistic-update rollbacks. ~1.5 hr. |
| UX-053 | 🟢 Ready | **Empty-state pass: every `EmptyState` has a primary action** | Low severity. `apps/web/components/dashboard/MedCard.tsx:154` "No medications tracked yet for this recipient." has no next-action affordance (the "Add medication" button lives elsewhere). Pattern repeats in OuterCirclePanel and JournalTimeline empty states (sampled). Quietly fails the design principle "explain why there's nothing + offer a next action." Audit every `EmptyState` consumer in `(app)`; add a primary action button where one is missing. ~2 hr. |

### Test gap stories (TD-24..28) — opened 2026-04-25 from coverage analysis

Snapshot at filing time: web 66.74% / mobile 78.53% / RLS 211 tests across 26 files. These five close the highest-leverage PHI/auth/payment gaps. ~12 hr total. **Target after this batch ships:** web ≥78%, mobile ≥85%, RLS adds 2 dedicated PHI-table files.

| ID | Status | Story | Notes |
|---|---|---|---|
| TD-24 | ✅ Shipped · PR #146 | **`care_events_rls.test.sql`** | `care_events` is the most-frequently-written PHI table (every journal entry) and has NO dedicated RLS test file today (only `care_event_comments` does). A cross-recipient SELECT/INSERT leak would be silent in CI. Test coordinator/aide/outer-circle SELECT and INSERT isolation — especially the cross-recipient leak vector. ~2 hr. |
| TD-25 | ✅ Shipped · PR #158 | **`supabaseServer` session-refresh unit test** | New file: `apps/web/lib/__tests__/supabaseServer.test.ts`. Cookie-API regressions from Next.js or `@supabase/ssr` upgrades currently have no regression net (route tests mock the client). Simulate expired `access_token` + valid `refresh_token` in cookies, verify a new session is returned (or 401 thrown cleanly). Silent-break vector for ALL SSR routes. ~3 hr. |
| TD-26 | ✅ Shipped · PR #159 | **`useOfflineWrite` error/retry branch coverage** | Branch coverage is 50% (lines 79-80, 87, 95-96 — the offline retry and error-clear paths). Exactly the code that runs during intermittent connectivity, the most common mobile failure mode. Test: network failure mid-sync (queue not removed), repeated retry on permanent 4xx, queue clear on success. ~2 hr. |
| TD-27 | ✅ Shipped · PR #153 | **Aide cross-recipient scoping integration test** | New file: `apps/web/server/routers/__tests__/careEventsRouter.scope.test.ts`. RLS covers DB-layer isolation but the tRPC `where` clause is untested for cross-org isolation. Use a real local DB; assert `careEvents.list` called with a `recipient_id` the aide is NOT a member of returns empty (or 403), not data. ~3 hr. |
| TD-28 | ✅ Shipped · PR #160 | **`messagingPush` + `educationTipRefresh` Inngest failure tests** | These are the only 2 Inngest functions with zero test coverage (out of 11). `messagingPush` fans out push notifications to potentially all family members — an unhandled `DeviceNotRegistered` error would silently drop the job. Test malformed payload + `DeviceNotRegistered` + Expo API timeout. ~2 hr. |
| TD-30 | ✅ Shipped · PR #149 | **Path-filtered required CI checks (cut rebase wait time)** | 12 required checks fire on every PR including `Mobile — Android debug build` (~3 min) and `RLS pgTAP tests` (~2.5 min) even when no mobile/SQL code changed. With 5 stacked PRs the rebase cascade burns ~30 min of CI per merge cycle. Fix: in `.github/workflows/ci.yml`, scope expensive jobs with `paths:` filters; introduce a single fast `ci-summary` meta-job that always runs and reports the required check name regardless of which downstream jobs fired. Move the 12 specific check names off `required_status_checks` and replace with one `ci-summary`. Branch protection unchanged in spirit — every PR still has to pass — but a docs-only PR finishes in ~30s instead of ~5min. ~2 hr (workflow YAML + branch-protection PATCH). |
| TD-32 | ✅ Shipped · PR #154 | **Run E2E (Playwright) on PR pushes** | E2E was previously only running on push-to-main; PRs got no Playwright coverage. Re-enabled via `pull_request:` trigger; now in CI Summary. |
| TD-35 | ✅ Shipped · PR #187 | **Fix TD-30 path-filter false-skip on lockfile-only PRs** | TD-30's per-job `if:` used `contains(toJSON(github.event.pull_request.changed_files), 'apps/web')` — but `changed_files` is an INTEGER (file count), not a path list, so the predicate was always false and every test job silently SKIPPED on every PR. CI Summary treats SKIPPED as pass, so deps bumps shipped without test verification (e.g. TD-29 #165). Fix: replace with SHA-pinned `dorny/paths-filter@v3` doing real glob-based path matching; new `changes` job exposes `web`/`mobile`/`supabase`/`deps`/`e2e` outputs that downstream jobs gate on via `needs:`. |
| TD-36 | ✅ Shipped · PR #173 | **Mobile lockfile management — pnpm-monorepo compatibility** | Investigation found apps/mobile already in `pnpm-workspace.yaml` + `pnpm-lock.yaml`; the npm-format `package-lock.json` was a stale orphan from a prior `npm install`. Path (a) chosen: deleted the orphan + added to `.gitignore` + documented `pnpm install` requirement in `apps/mobile/CLAUDE.md`. Mobile tests 33 pass / 15 skip (matches baseline); Expo CLI resolves post-install. |
| TD-41 | ✅ Shipped · PR #178 | **PostHog uninitialized in CI breaks every form-submit** | CI doesn't set `NEXT_PUBLIC_POSTHOG_KEY`. Server `lib/posthog-server.ts` constructs `new PostHog(undefined!)` which throws "You must pass your PostHog project's api key" — surfaced as 500 from `/api/onboarding/create` and every other event-capturing route. Browser-side, `posthog.capture()` / `posthog.identify()` calls in `SignInForm` + `OnboardingForm` threw the same message, aborting the submit handler **before** `router.replace('/dashboard')`. Form silently stayed on /signin or /onboarding; `waitForURL` timed out — the visible CI symptom. Fix: server returns no-op stub when no key; client inits with placeholder + `opt_out_capturing()` when no key. Bundles a Next 16 hydration fix in `app/layout.tsx` (anti-FOUC `<script>` was a direct child of `<html>`, hard-failing hydration in React 19). |
| TD-42 | ✅ Shipped · PR #180 | **`ensureCareTeam` helper selector drift — dashboard "View care journal" is a `<p>` not a `<button>`** | `e2e/helpers.ts:91,100,110` waits for `button:has-text("View care journal")`. The dashboard renders that string as `<p className="text-sm text-muted-foreground">` inside a clickable `<Card onClick>` (see `apps/web/app/(app)/dashboard/DashboardClient.tsx:319-323`), so the selector never matches and `ensureCareTeam` times out for any test using it. Slipped in with TD-40 (#177). Fix: replace the three selectors with `text="View care journal"` (or scope to the parent Card heading). Once landed, ai-assistant.spec progresses past `beforeEach` and the remaining 4 consent-modal failures become visible (separate diagnosis). |

### Roadmap features (ON-64..68) — opened 2026-04-25

From `docs/project-info/product/ROADMAP.md` Phases 3–5. Greenlit 2026-04-25 to add to Ready queue. Sequencing rationale per ROADMAP.md §"Feature sequencing rationale".

| ID | Status | Story | Notes |
|---|---|---|---|

Source: external design prototype (CareSync Prototype.html) handed off as enhancement spec on 2026-04-23. Triaged into 8 actionable stories; configurability surface (theme switcher, density/radius pickers, grain overlay, multiple hero variants, multiple dashboard layouts) deliberately cut to UX-22 to preserve a single opinionated look. Crisis/SOS scoped separately as UX-23. Real pattern aggregation deferred to UX-24 (UX-18 ships with mocks).

| ID | Status | Story | Notes |
|---|---|---|---|
| UX-14 | ✅ Shipped · PR #125 | **Command palette (⌘K)** | Modal triggered by ⌘K (Cmd+K mac, Ctrl+K elsewhere) from any logged-in screen. Sections: **Jump to** (routes), **Log** (med/mood/meal/BP/note/visit), **People** (ping member), **Admin** (settings, invite). Fuzzy search (simple `includes()` is fine for v1). Esc closes, ↑↓ navigates, Enter submits. New: `apps/web/components/CommandPalette.tsx` + test; hotkey listener mounted in `AppShellClient`. **People section omitted** (no `team.list` route or member-profile page found — revisit when those exist). 18 tests added. |
| UX-15 | ✅ Shipped · PR #126 | **Quick-log FAB** | Floating action button bottom-right of main content (not sidebar). Click expands to options: Meds, Mood, BP, Note, Meal, Hydration. Wired actions navigate to existing journal panels (`/journal/[recipientId]?panel=...`); meal + hydration shipped as **disabled "Coming soon"** (no schema yet — do not invent). Mounted in `AppShellClient` (every `(app)` route). 17 tests added. **Will conflict with UX-14 (#125) on `AppShellClient.tsx` — trivial additive resolve at second-merge.** |
| UX-16 | ✅ Shipped · PR #128 | **Fraunces + Geist type system** | Plumbing-only: added Fraunces + Geist Mono via `next/font/google`; exposed `--font-display`/`--font-body`/`--font-mono` in `@theme inline`; added 3 utility classes (`.headline-display`, `.headline-display em`, `.eyebrow-mono`) in `@layer components`. Italic em pattern is **scoped** to `.headline-display em` — no global `em` rule, existing literal `<em>` usage unchanged. `--font-sans` still resolves to Geist (no body-text regression). 6-assertion smoke test in `lib/__tests__/typography-tokens.test.ts`. **No existing component refactored** — UX-17 + UX-21 adopt the tokens. |
| UX-17 | ✅ Shipped · PR #138 | **Editorial dashboard refactor: BriefHero + MedCard + MoodCard** | Two-col layout (1.6fr/1fr). BriefHero card: blurred primary-subtle blob, mono pill eyebrow ("Today's brief · auto-generated 7:02a"), Fraunces 26 paragraph, status pills row. MedCard: check-style rows, strikethrough+60% opacity when taken, "Log" soft button when not. MoodCard: 13-bar sparkline (today in `--color-primary`, rest in `--color-primary-subtle`), Fraunces 28 mood label. Re-uses existing dashboard data; presentation-only refactor. Depends on UX-16. ~2 days. |
| UX-18 | ✅ Shipped · PR #127 | **Patterns strip in Journal** | Horizontal-scroll row of pastel cards above journal feed surfacing AI insights ("Eleanor more anxious on Tuesdays", "Sleep drops 90m after PT", "Mood highest when Priya visits"). v1 ships scaffold + 3 hardcoded mock patterns + tap-to-detail (`?filter=mood` query param). Real aggregation deferred to UX-24. New: `apps/web/components/journal/PatternsStrip.tsx` + test. Mounted at top of `JournalLayout` journal-destination block. 15 tests added. |
| UX-19 | ✅ Shipped · PR #129 | **Shift Handoff: "What did I miss?" view** | TopBar "What did I miss?" button (mounted in `JournalLayout` — no standalone TopBar exists) opens modal with 5 sections: Meds, Moments, Appointments, Concerns, Thanks. 24h/48h/72h period selector. Pure summary builder in `lib/handoffSummary.ts` with 18 tests; component with 12 tests. Uses existing `careEvents.timeline` tRPC query, client-side window filter. v1 manual trigger; auto-detect on `last_seen` deferred. Schema dump found: `entry_type` enum = journal/medication/shift/appointment/symptom/task/expense/handoff. **Will conflict with UX-18 (#127) on `JournalLayout.tsx` — trivial additive resolve.** |
| UX-20 | ✅ Shipped · PR #130 | **Print-friendly visit summary** | Dashboard "Generate visit summary" button → authenticated `/visit-summary` route (no token; caregiver prints, doesn't share). 6-section printable layout: patient info (PHI from `identity_vault` per P4-03 pattern), meds + adherence %, vitals SVG sparklines, symptoms, journal highlights, blank questions textarea. Uses `window.print()` — no `@react-pdf/renderer` needed. `lib/medAdherence.ts` pure helper with 14 tests; component with 18 tests. **Will conflict with UX-19 button placement if we add a Visit Summary button to TopBar later — but currently mounted on Dashboard, so no overlap with #129.** |

### Launch readiness (LAUNCH-*) — Phase 6 · opened 2026-04-27

| ID | Status | Story | Notes |
|---|---|---|---|
| LAUNCH-001 | 🧑 Needs human | **App Store launch — TestFlight QA + App Store Connect listing** | Run internal TestFlight cycle (≥1 week, ≥3 real-device testers). Complete App Store Connect listing: description, keywords, screenshots (iPhone 6.7″ + 5.5″), app preview video optional. iOS privacy nutrition label. Android Play Console parity (listing + privacy). Human-gated: EAS production build must be complete first. |
| LAUNCH-002 | ✅ Shipped · PR #225 | **EAS production build profile + OTA gating** | Finalized `eas.json` production profile + channel pinning + `runtimeVersion` policy; release runbook at `docs/project-info/runbooks/MOBILE_RELEASE.md`. |
| LAUNCH-003 | ✅ Shipped · PR #226 | **Web go-live SEO/OG meta + sitemap + structured data** | Added `<meta og/twitter>` to all marketing pages, `sitemap.ts`/`robots.ts`, Organization + SoftwareApplication JSON-LD on landing. |
| LAUNCH-004 | 🟢 Ready | **Observability hardening** | Wire Sentry source maps (depends on TD-03 env var), add prod rate-limit dashboard (TD-73), add weekly digest monitoring (TD-74), add E2E green-streak gate (TD-75). Observability checklist doc in `docs/project-info/runbooks/`. ~1 day total (coordinates the TD sub-items). |
| LAUNCH-005 | 🧑 Needs human | **Compliance / legal — privacy policy, ToS, BAA, data retention** | Publish privacy policy + ToS at stable URLs (linked from signup + footer). Obtain BAA from Supabase (HIPAA) and Resend if processing PHI in email bodies. Document data-retention and deletion runbook (how to honor right-to-erasure requests). Human-gated: legal review required. |

Rules: mark `✅` when done; list `**Blocked by:**` if a prerequisite is still open; one story per `###`; stay under ~4 hrs of work.

All items below are independent (no shared-state conflicts) — agents may fan out in parallel.

### ON-15 — Mobile: accessibility audit (iOS Dynamic Type + VoiceOver)
**Status:** ✅ Shipped (code complete; physical device VoiceOver verification deferred to human)

**Why:** Mobile uses fixed `fontSize` throughout; never tested against 200% Dynamic Type or VoiceOver navigation order.
**Work:** Run app under max Larger Accessibility Sizes on journal/medications/schedule; migrate fixed sizes to `PixelRatio.getFontScale()` capped at 1.5×. VoiceOver-complete a medication-log flow end-to-end. File follow-up ON-XX for issues deferred.
**AC:** app usable at 200% DT on 3 key screens; VoiceOver finishes the med-log flow.
**Size:** ~1 day. **Blocked by:** nothing.

---

## 3. Platform parity (PP-*)

Full table + stories: `docs/project-info/product/PLATFORM_PARITY.md`. Active items are listed in §1 above. Remaining:

| ID | Priority | Story | Status |
|---|---|---|---|
| PP-002 | P2 | Mobile: onboarding wizard (first-run flow) | ✅ Shipped · PR #92 |
| PP-003 | P2 | Mobile: read-only subscription view + "manage on web" CTA | ✅ Shipped · PR #93 |
| PP-005 | P2 | Web: push notifications (browser Push API) | ✅ Shipped · PR #85 |
| PP-006 | P1 | Android prebuild + boot verification | ✅ Shipped · PR #90 |
| PP-007 | P1 | Android: push notification verification (FCM token + deep-link tap) | ✅ Shipped · PR #99 — needs `google-services.json` from Firebase for live FCM verification |
| PP-008 | P1 | Android: app-links verification (`assetlinks.json`, autoVerify) | 🧑 Needs human — `assetlinks.json` on live domain + EAS SHA-256 |
| PP-009 | P2 | Android: visual QA pass (screenshot every screen vs iOS) | 🟢 Ready — `scripts/android-visual-qa.sh` written; run when Android emulator available |
| PP-010 | P2 | Android: document-share intent verification | ✅ Shipped · 2026-04-17 — 17 unit tests cover Android `Alert.alert` picker path; fixed stale empty-state assertion |
| PP-011 | P2 | Offline behavior spec + write-queue for journal entries | ✅ Shipped · PR #88 |
| PP-012 | P3 | Consolidate URL scheme (`yourcarelog://` ↔ brand `carelog`) | ⏳ |
| PP-013 | 🧊 P3 | Wear OS companion | Parked for v2 |

---

## 4. Accessibility (A11Y-*)

Full plan + scoring: `docs/project-info/technology/ACCESSIBILITY.md`. Active in §1. Remaining:

| ID | Priority | Story |
|---|---|---|
| A11Y-011 | ✅ Shipped · PR #119 | **Web button aria-label sweep** | All 4 targets already WCAG 2.2 AA compliant — no code changes needed. |
| A11Y-012 | ✅ Shipped · PR #224 | **Flag button: add `type="button"` + contextual `aria-label`** | JournalTimeline flag button now has `type="button"` and aria-label including entry timestamp. |
| A11Y-013 | ✅ Shipped · PR #224 | **TeamAdmin "Remove" button: `type="button"` + member-identifying `aria-label`** | Remove button now has `type="button"` and `aria-label={`Remove ${member.display_name ?? member.email}`}`. |
| A11Y-014 | ✅ Shipped · PR #224 | **TeamAdmin delete-org button: add `type="button"`** | Delete org button now has `type="button"`. |
| A11Y-015 | ✅ Shipped · PR #228 | **AppTabBar tab buttons: add `type="button"`** | Desktop tab list shipped in #224 sweep; mobile tab strip closed in #228 (was the only remaining gap from the audit). |
| A11Y-016 | ✅ Shipped · PR #224 | **QuickLogFab action buttons: add `type="button"`** | Both FAB trigger + menu-item buttons now have `type="button"`. |
| A11Y-017 | ✅ Shipped · PR #224 | **JournalLayout: replace `user.email` with `display_name` in sticky header** | Sticky header now reads `user.user_metadata.display_name ?? user.email`. |
| A11Y-018 | 🧑 Needs human | **Physical-device VoiceOver verification (residual from TD-02)** | Code-complete scaledFont + accessibilityLabel sweep shipped in TD-02 (PR #87). Physical-device VoiceOver end-to-end of the medication-log flow has not been verified — requires a real iPhone. See TD-02 in §7 for context. |

---

## 5. Large features (multi-day)

### ON-54 — Free tier definition + soft gates · ~1 day
**Status:** 🧑 Needs product decision before coding
**Why:** PRODUCT_STRATEGY.md lists "free tier: limited (TBD)." BillingBanner soft-gate pattern is already wired. Needs a product decision on the limits (e.g. max 30 events/month, no history export, no document vault, 1 care recipient) before enforcement code can be written.
**Work once limits are decided:** BillingBanner gates on event creation, history export, and vault upload. No paywall — upgrade prompt only.
**Blocked by:** 🧑 Brady decides free-tier limits.

### ON-55 — Visit recorder · ~3 days
**Status:** 🧊 Deferred (Phase 7)
**Why:** Audio note at a doctor visit → Whisper transcription → Claude structured extraction → `care_event` tagged to the appointment. Roadmap explicitly labels this Phase 7 / future.
**Work:** Mobile: `expo-av` recording + upload to Supabase Storage. Inngest job: Whisper → structured parse → care_event insert with `entry_type='visit_note'`. Web: playback + structured fields editable.
**Blocked by:** Phase 1–6 features fully stable; sufficient data volume to validate the use case.

### ON-69 — Visit recorder · ~3 days
**Status:** 🧊 Deferred (Phase 7)
**Why deferred:** Phase 7 — requires audio capture infra not yet scoped; revisit after launch.
**Scope:** Mobile: `expo-av` audio recording → upload to Supabase Storage. Inngest job: Whisper transcription → Claude structured extraction → `care_event` insert with `entry_type='visit_note'` tagged to the appointment. Web: playback + structured fields editable. ROADMAP.md Phase 4 "Visit recorder" section is the authoritative spec.
**Blocked by:** Phase 1–6 features fully stable; audio infra scoping; Whisper API cost analysis.

### ON-56 — Data stewardship commitment page · ~0.5 day
**Status:** ✅ Shipped · PR #102
**Why:** PRODUCT_STRATEGY.md says "publish before first paying users." Builds trust with a population burned by CareZone's shutdown. Commitment: 12 months notice before shutdown, full data export always available, data never sold, no ads ever.
**Work:** New marketing page at `/data-commitment` (or `/trust`). Link from footer + signup flow. Plain language, no legalese. ~0.5 day.
**AC:** Page live at stable URL; linked from site footer and onboarding.

### ON-59 — Inngest cron health monitoring · ~1 day
**Status:** ✅ Shipped · PR #110 (Sentry) + PR #111 (cron_runs timestamps)
**Why:** Weekly digest, refill alerts, burnout check-ins, and gap detector run as Inngest functions. If they fail silently, families miss digest emails and medication refill warnings — core retention and safety features. No monitoring exists today.
**Work:** Wrap each Inngest `serve()` handler catch block with `Sentry.captureException`. Add an Inngest event-stream webhook that fires to a `/api/inngest/monitor` route and logs failures to Sentry. Optionally add a `/api/health/crons` endpoint that returns last-run timestamp for each cron.
**AC:** Sentry receives an exception when any Inngest function throws. Oncall can see last-run timestamps for digest + refill + burnout + gap-detector.

### ON-60 — Referrer resource page `/for-referrers` · ~1 day
**Status:** ✅ Shipped · PR #107
**Why:** PRODUCT_STRATEGY.md identifies social workers, hospital discharge planners, elder law attorneys, and geriatric care managers as the highest-leverage GTM channel — one referrer who sends 2 families/month is worth more than 1,000 social media followers. There is currently no page targeting this audience.
**Work:** New marketing page at `/for-referrers`. Explains: what Carelog does, how to refer a family (share link), what families get. Includes a downloadable 1-page reference card (PDF). No commission language (conflicts with social worker ethics). ~1 day.
**AC:** Page live; includes share link + downloadable PDF; linked from main nav footer.

---

## 6. Deferred UI polish (UX-*) — intentionally parked

From `BACKLOG_UI_REDESIGN.md`. Ordered by impact.

### Shipped
- **UX-12** — ✅ Shipped · PR #120 — Empty states for AIChatThread + EntryDetailClient; MessageCircle + FileX icons, token-based styling.
- **UX-13** — ✅ Shipped · PR #117 — AIPanel: submit button disabled + Loader2 spinner while pending; onError shows sonner toast.

### Deferred
- **UX-08** — Storybook component library (post-launch, when component count warrants).
- **UX-09** — Visual regression testing (Percy/Chromatic or Playwright screenshot diffs).
- **UX-11** — Onboarding flow redesign — low traffic, functional as-is.
- **UX-22** — Configurability surface from 2026-04-23 design spec: theme switcher (sage/slate/rose), density picker (compact/comfortable/airy), radius picker (sharp/soft/pillowy), grain overlay, 5 hero variants, 3 dashboard layouts. Cut deliberately to preserve a single opinionated "editorial, calm, dignified" look. Revisit only if A/B data shows real demand.
- **UX-23** — Crisis/SOS mode. Subtle red SOS button → emergency contacts (911, primary doctor, family) + current meds + allergies + DNR/advance directive + one-tap "notify care circle." Parked separately from UX-14..21 batch — needs scoping with legal, accuracy guarantees on meds list, contact failover, and audit-log behavior before any code lands.
- **UX-24** — Real pattern aggregation for Journal Patterns strip. Replaces UX-18 hardcoded mocks with actual SQL/AI aggregation over `care_events` (mood-by-day-of-week, sleep-vs-event correlation, mood-vs-visitor correlation). Schedule after UX-18 ships and we have real production usage to validate the patterns are useful.

### Token-drift cleanups from UI review 2026-04-27 (UX-025..036)

11 of 12 shipped via PR #224 polish sweep (verified 2026-04-27 against current main). UX-035 still pending — BriefHero hardcoded mock content and `TODO(UX-24+)` comment confirmed present.

| ID | Status | Story | Notes |
|---|---|---|---|
| UX-025 | ✅ Shipped · PR #224 | **Extract shared `MOOD_STYLES` constant using `var(--color-mood-*)` tokens** | `apps/web/lib/mood.ts` created; consumed by EntryDetailClient + JournalEntryForm + SymptomPanel. |
| UX-026 | ✅ Shipped · PR #224 | **Add `--color-danger-subtle` token + replace `bg-red-50` in DangerZone and TeamAdmin** | Token added to `globals.css`; DangerZone + TeamAdmin updated. |
| UX-027 | ✅ Shipped · PR #224 | **QuickLogFab "Soon" badge: replace `bg-gray-100` with token** | Now uses `bg-[var(--color-surface)] border border-[var(--color-border)]`. |
| UX-028 | ✅ Shipped · PR #224 | **`RoleBadge`: replace raw amber/gray Tailwind with tokens** | RoleBadge tokenized; tests updated. |
| UX-029 | ✅ Shipped · PR #224 | **`ExpensePanel` and `DocumentVault` category badges: token-backed color map** | Both panels now use shared token map. |
| UX-030 | ✅ Shipped · PR #224 | **`MedicationPanel` PRN badge: use `--color-secondary-subtle`** | PRN badge at MedicationPanel.tsx:321 now uses secondary-subtle tokens. |
| UX-031 | ✅ Shipped · PR #224 | **Add `--color-success-subtle` + `--color-warning-subtle` tokens for BriefHero pills** | Both tokens added to `globals.css`; BriefHero references them. |
| UX-032 | ✅ Shipped · PR #224 | **`EolPlanner`: replace `border-red-50` + `text-red-600` with danger tokens** | EolPlanner now uses `border-[var(--color-danger)]/30` and `text-[var(--color-danger)]`. |
| UX-033 | ✅ Shipped · PR #224 | **`ErrorBoundary`: replace raw gray classes with design tokens** | ErrorBoundary now uses surface/ink/muted tokens. |
| UX-034 | ✅ Shipped · PR #224 | **DashboardClient: replace inline SVG chevron with `lucide-react` `ChevronRight`** | DashboardClient.tsx:332 now uses `<ChevronRight />`. |
| UX-035 | 🟢 Ready | **Gate `BriefHero` mock content behind feature flag or skeleton** | `BriefHero.tsx:1-4` still has hardcoded mock data + `TODO(UX-24+)` comment. Gate behind feature flag or skeleton until UX-24 real aggregation ships. |
| UX-036 | ✅ Shipped · PR #224 | **Move `CommentItem`/`CommentThread` dark-mode overrides to `globals.css` tokens** | No `dark:bg-gray-*` matches remain in CommentItem/CommentThread. |
| UX-041 | 🟢 Ready | **Journal cards: surface author identity** | `/impeccable critique` 2026-04-29 scored "Multi-author legibility" 2/4. `JournalCard` in `JournalTimeline.tsx:155–291` renders mood + text + timestamp + reactions but no author name or avatar. In a multi-caregiver household (primary + siblings + paid aide) every entry reads as anonymous. Violates PRODUCT.md Principle 4 ("lead with names and voices before metrics") at the most-viewed surface in the product. Add a two-line author row between entry text and timestamp: name (Geist 500 11px ink) + existing eyebrow-mono timestamp. Requires passing `authorName` through `JournalEvent` type and the `useJournalData` query. |
| UX-042 | 🟢 Ready | **Journal top bar: show recipient name not org name** | `JournalLayout.tsx:124` shows `org?.name ?? "Care Journal"`. A coordinator with two recipients lands in a journal with no immediate signal whose journal it is. Change to recipient-led: `{recipient?.display_name ?? org?.name ?? "Care Journal"}` plus a quieter eyebrow "Journal" label. Pairs naturally with UX-039a's recipient-led dashboard pattern. ~30 min. |
| UX-043 | 🟢 Ready | **`MedicationChecklist`: format scheduled times like MedCard does** | `MedicationChecklist.tsx:74` renders raw Postgres `HH:MM:SS` (`"Lisinopril 10mg — 08:00:00"`). MedCard already has `formatTime()` (`MedCard.tsx:14–22`) producing `"8a"`. Import + reuse that helper in the checklist row label. Highest single-line caregiver-facing ROI on the medication surface. ~15 min. Also replace the raw `bg-green-100 text-green-700` / `hover:bg-red-100 hover:text-red-600` Tailwind utilities at `MedicationChecklist.tsx:76–82` with design tokens — and quiet the "Missed" hover from punitive red to a neutral muted state (logging a missed dose is a neutral act, not a failure). |
| UX-044 | 🟢 Ready | **Wire or remove the broken "Leave organization" button in Settings** | `/impeccable critique` 2026-04-29: `apps/web/app/(app)/settings/page.tsx:613–623` shows a confirmation modal that resolves to a toast saying "go to Team panel and leave from there." A user who came to Settings to leave a team gets visual friction with no real action. This is worse than no button. Either implement the API call or remove the button entirely (replace with a small note + link to `/team/admin`). Trust-eroding placebo button is the worst case. |
| UX-045 | 🟡 PHI · Ready | **Brief share API: gate `dob` behind `includes` array** | `/impeccable critique` 2026-04-29: `apps/web/app/brief/[shareToken]/BriefEditorial.tsx` always renders `content.dob` if present. The `includes` array gates the medications section but NOT DOB. A family-share brief (intended for relatives) currently leaks the recipient's date of birth even when the coordinator selected `includes: ["journal", "medications"]`. Add `"dob"` to the `includes` enum at write time + gate the render at `BriefEditorial.tsx`. Default new family-share briefs to `includes` without DOB; clinician-style shares can opt in. PHI-relevant — review with rls-reviewer agent before merge. |
| UX-046 | 🟡 Spike | **Clinician-readable share surface — does PRODUCT.md's promise have a route?** | `/impeccable critique` 2026-04-29 surfaced a category gap: PRODUCT.md says "a doctor's appointment starts with a real summary." `/care/[shareToken]` is the outer-circle volunteer-claim form (meals, errands), not a clinician share. `/visit-summary` is gated behind authentication and produces a print-only artifact the caregiver must physically deliver. The "real summary for the doctor" promise has no shipped surface. Spike: investigate whether (a) `visit-summary` should also produce a time-limited token URL the caregiver emails to the doctor, (b) a new `/clinician/[shareToken]` route is warranted, or (c) the existing `/brief/[shareToken]` flow already serves the use case if briefs default to clinician-friendly content. Founder/PM decision before any code. |
| UX-048 | 🟢 Ready | **Empty states polish** | `/impeccable clarify` 2026-04-29 audit found generic-SaaS empty-state copy across journal, medications, team, and dashboard surfaces ("No items", "No projects yet", "Get started"). Replace with PRODUCT.md-aligned warm·candid copy that names the subject + offers a next action ("No journal entries yet. Log how today went."). See `apps/web/copy-audit.md` §3 for the full list. |
| UX-049 | 🟢 Ready | **Auth + onboarding voice pass** | `/impeccable clarify` 2026-04-29 audit found tone mismatches in the auth flow: `SignInForm.tsx:115` button reads "Sign in" on what is actually a 6-digit OTP verify step ("Verify code" / "Verifying..." is correct). Onboarding has 3 different error strings, only 1 well-pitched. Auth callback / invite-load errors lack remediation. Sweep the 8 auth-surface findings in `apps/web/copy-audit.md` §2 and the onboarding findings in §1 Medium. |
| UX-050 | 🟢 Ready | **Journal mood + entry-form copy** | `/impeccable clarify` 2026-04-29 audit found tone risks in the journal — the surface where stakes are highest (PRODUCT.md: "the recipient is a person, not a chart"). Sweep mood-label copy, ShiftForm field labels, and the "Share update" button on what is actually a private journal post. See `apps/web/copy-audit.md` §4 for the full list. |
| UX-051 | 🟢 Ready | **Legacy `care-log.org` → `caresync.app` cleanup** | `/impeccable clarify` 2026-04-29 audit caught `hello@care-log.org` shipping to paying users in `apps/web/app/(app)/subscriptions/page.tsx:188` and `apps/web/app/(app)/team/admin/TeamAdminClient.tsx:159`. Per the brand-name rule, user-facing brand is **CareSync** (`@caresync.app`). Grep the whole repo (`rg "care-log\.org"`) and replace user-facing instances; leave repo path / package.json unchanged (those are the legacy internal name). Tiny PR — could roll into UX-047 if convenient. |

---

## 7. Shipped (compact log)

### 2026-04-29 — /impeccable wave 2 (clarify) + extract Phase B-1 (PRs #284–#297)
✅ **UX-037** Marketing microcopy — three category-default phrases fixed (PR #284)
✅ **UX-038** `CompareTable` surfaced on landing + about (PR #285)
✅ **UX-039** Recipient-led dashboard shape doc (spike) (PR #283)
✅ **UX-039a** Recipient-led layout A + ReferralCard moved to Settings (PR #287)
✅ **UX-039b** Multi-recipient switcher wired + layout B + view toggle (PR #289)
⚫ **UX-040** Founder decision: keep generated-brief model — no code work (resolved)
✅ **UX-047** Errors + confirmations sweep — 18 strings rewritten, 3 native confirms → `<AlertDialog>`, new `ui/alert-dialog.tsx` primitive (PR #290)
✅ **UX-052** AlertDialog migration follow-up — AppTabBar sign-out + TeamPanel member-remove (PR #293)
✅ **TD-90** `<ErrorBanner>` extracted + raw `bg-red-50` token leaks fixed (PR #295)
✅ **TD-91** `lib/mood.ts` widened with `moodBgClass`/`moodBorderClass`/`moodChipClass`/`moodDotClass` helpers (PR #297)
✅ **TD-92** `<TintedCard>` widened with dark-mode `tone="dark"` prop; `TradeRequestList` bypass removed (PR #296)
✅ **TD-93** `lib/pdfTokens.ts` parallel-token file for react-pdf + parity test (PR #294)

### 2026-04-28 — Agent tooling experiments + Codex re-audit (PRs #262–#266)
✅ **TD-84** Codex adversarial re-audit on apps/web/server + supabase/migrations + apps/web/inngest (16 Critical / 36 Medium) (PR #262)
✅ **TD-85** Tool-use PR-review agent → `/pr-review-agent` skill (PRs #264, #266)
✅ **TD-86** Sentry-issue triage agent → `/sentry-triage` skill (PRs #265, #266)

### 2026-04-27 — Launch-readiness wave (PRs #224–#228)
✅ **A11Y-012/013/014/016/017** Button `type="button"` + member-identifying `aria-label` sweep across JournalTimeline, TeamAdmin (Remove + delete-org), QuickLogFab, JournalLayout (display_name fallback) (PR #224)
✅ **A11Y-015** AppTabBar mobile tab strip `type="button"` (desktop in #224, mobile in #228)
✅ **UX-025/026/027/028/029/030/031/032/033/034/036** Token-drift sweep — `lib/mood.ts` extracted; `--color-danger-subtle` + `--color-success-subtle` + `--color-warning-subtle` tokens added; QuickLogFab/RoleBadge/ExpensePanel/DocumentVault/MedicationPanel/EolPlanner/ErrorBoundary/DashboardClient/CommentItem/CommentThread tokenized (PR #224)
✅ **LAUNCH-002** EAS production build profile + OTA gating + `MOBILE_RELEASE.md` runbook (PR #225)
✅ **LAUNCH-003** Web SEO/OG meta + `sitemap.ts` + `robots.ts` + JSON-LD structured data (PR #226)
✅ **TD-73/74/75** Rate-limit dashboard + digest delivery monitoring + E2E green-streak gate (PR #227)

### 2026-04-26 — E2E unblock + product polish wave (PRs #175–#205)
✅ **TD-38** Update dispatch skills for ~~Mergify~~ queue trigger — drop `--auto --squash`, reach for the `queue` label (PR #175)
✅ **TD-39** Harden `e2e/helpers.ts` — selector ambiguity, OTP regex, auth-callback timeout (PR #176)
✅ **TD-40** E2E AI Assistant FAB needs `ensureCareTeam` fixture — pre-create team in beforeEach (PR #177)
✅ **TD-41** Guard PostHog calls when key is unset — server stub + client `opt_out_capturing()`; bundles Next 16 hydration fix (PR #178)
✅ **TD-42** `ensureCareTeam` selector drift — dashboard "View care journal" rendered as `<p>` inside clickable `<Card>`, not `<button>` (PR #180)
✅ **TD-43** Defensively wrap `posthog.capture`/`identify` so analytics never blocks UX (PR #181)
✅ **TD-44** Rate-limit fail-closed only in real prod (`VERCEL_ENV`), not `NODE_ENV` — was bricking E2E in CI (PR #182)
✅ **TD-45** Bump `ensureCareTeam` post-onboarding `waitForURL` 15s → 30s for slow CI cold boot (PR #183)
✅ **TD-46** Diag: instrument `OnboardingForm` to surface CI E2E redirect mystery (PR #185)
✅ **TD-47** Bail E2E after first failure + upload trace on cancel (PR #186)
✅ **TD-35 / TD-48 / TD-50** Unblock E2E end-to-end — path-filter false-skip fix (TD-35), Onboarding redirect (TD-48), helpers cleanup (TD-50) (PR #187)
✅ **TD-49** Docs: drafted upstream `supabase/cli` JWT-rotation issue write-up (PR #191)
✅ **TD-53** Clear browser cookies in `signIn()` to fix second-call timeout (PR #189)
✅ **TD-55** Fix `benefits.latest` mock URL + response format; un-fixme test (PR #194)
✅ **TD-56** Query `display_names` PHI vault instead of `care_recipients.display_name` (PR #190)
✅ **TD-57** Un-fixme multi-context burnout tests + add step diagnostics (PR #193)
✅ **TD-58** Un-fixme comment-toggle E2E test (PR #192)
✅ **TD-63** Restore AI Assistant FAB visibility (PR #198)
✅ **TD-64** Unify remaining `care_recipients.display_name` callers with PHI vault pattern (PR #197)
✅ **TD-65** Restore brand copy + add sign-out confirmation (PR #196)
✅ **TD-66** Clean up Carelog brand string in user-visible copy (keep email domain) (PR #200)
✅ **TD-67** Dedup team-admin member row — show email once, prefer `display_name` (PR #199)
✅ **TD-68** Add success feedback after Generate shareable brief (PR #202)
✅ **TD-69** Add success feedback after burnout check-in submit (PR #201)
✅ **TD-70** Add success toasts to silent form submits across More panel (PR #205)
✅ **TD-71** Brand the brief expired/invalid empty state with CareSync logo + CTA (PR #203)
✅ **TD-72** Align coverage-settings E2E tests with current product state (PR #204)
✅ **ON-64** Care brief generation pipeline — generator at `apps/web/app/api/brief/route.ts` (de-tokenizes once, stores snapshot in `care_briefs`); Generate shareable brief + Copy link UI in `JournalLayout.tsx`; RLS pgTAP `care_briefs_rls.test.sql`; viewer at `/brief/[shareToken]/page.tsx`. Polish completed by TD-68 (PR #202) + TD-71 (PR #203).
✅ **ON-65** Medication refill alerts — Inngest nightly function `apps/web/inngest/functions/refillAlert.ts` shipped; idempotent per medication × week.
✅ **ON-66** Symptom tracker — `server/routers/symptoms.ts` (+ logic + security tests) reads/writes `symptom_readings` table (chose dedicated table over `care_events` enum extension); web `journal/[recipientId]/SymptomPanel.tsx`; mobile `app/(app)/symptoms/{index,log}.tsx` + a11y test.
✅ **ON-67** Burnout tracker (the differentiator) — `server/routers/burnout.ts` + logic/security tests; weekly Inngest `inngest/functions/burnoutAlert.ts`; check-in submit polish via TD-69 (PR #201).
✅ **PP-014** Mobile subscription page on tRPC — `trpc.billing.getSubscription.useQuery()` replaces hand-rolled REST fetch in `apps/mobile/app/(app)/subscription/index.tsx`; resolves the placeholder TODO from TD-22 (PR #210).
✅ **UX-21** Daily Brief magazine view — extracted `BriefEditorial.tsx` from `app/brief/[shareToken]/page.tsx`; `max-w-[720px]` article with `.headline-display` Fraunces 48 + `.eyebrow-mono` dateline + 5–8 body paragraphs sourced from `recent_entries` + doctor-bullet section + Email family / Print for visit actions; re-uses brief snapshot, no API change (PR #211).
✅ **ON-68** Document share-with-aide signed-URL workflow — `documents.createShareLink` mutation (coordinator-only, 1–168 hour expiry) wraps Supabase Storage `createSignedUrl`; per-row Share button + inline hours-selector + Copy link panel in `DocumentVault.tsx`; no schema change (PR #212).
✅ **Skills** `/live-test` skill — interactive flow investigation + E2E runbook (PR #188); hot-reload + capture-replay + screenshot modes (PR #195)
✅ **CI infra** ~~Mergify~~ `batch_max_wait_time` 5 min → 150 s for faster queue cycles (PR #184)


### 2026-04-25 PM — security + CI hardening + harness consolidation (PRs #158–#173)
✅ **TD-25** `supabaseServer` session-refresh unit test (PR #158)
✅ **TD-28** `messagingPush` + `educationTipRefresh` Inngest failure tests + `DeviceNotRegistered` fix (PR #160)
✅ **TD-29** Long-tail transitive vuln triage — `vite` → 8.0.10, `dompurify` → 3.4.1, `follow-redirects` → 1.16.0, `postcss` → 8.5.10, `hono` → 4.12.14, `uuid` → 14.0.0, `@tootallnate/once` → 3.x; deleted stale `apps/web/pnpm-lock.yaml` (root lockfile is canonical); `apps/mobile/package-lock.json` hand-patched (`workspace:*` blocks `npm install`); OSV/Trivy/pnpm-audit flipped to blocking (PR #165)
✅ **TD-32** Run E2E on PR pushes (PR #154)
✅ **TD-36** Migrated `apps/mobile` to pnpm workspace — deleted stale `package-lock.json`, added `.gitignore` rule, documented in `apps/mobile/CLAUDE.md` (PR #173)
✅ **CI infra** ~~Mergify~~ config: drop phantom `audit` check, switch to `CI Summary` aggregate, upgrade to current format, enable merge queue (PRs #166, #168, #171, #172)
✅ **Docs** CLAUDE.md auto-merge → ~~Mergify~~ queue workflow rewrite (PR #167)


### 2026-04-25 backlog burndown + harness consolidation (PRs #145–#161)
✅ **fix(security)** Drop share_token + error stack from PostHog — closes 2 PHI leak vectors (PR #145)
✅ **TD-24** care_events RLS pgTAP coverage — 15 tests covering coordinator/aide/outer-circle SELECT+INSERT isolation (PR #146)
✅ **TD-22** Billing tRPC router — `billing.getSubscription`, unblocks PP-014 (PR #147)
✅ **TD-21** CVE bumps — Next.js → 16.2.3, protobufjs → 8.0.1, @xmldom/xmldom → 0.9.10; long-tail triage deferred to TD-29 (PR #148)
✅ **TD-23** SHA-pin 5 workflow action refs + checksum OSV binary download (PR #148)
✅ **TD-30** Path-filtered required CI checks — story filed; workflow YAML implementation tracked separately (PR #149)
✅ **TD-31** Automated PHI review label gate workflow (PR #155)
✅ **TD-27** Aide cross-recipient tRPC scoping integration test (env-gated for CI; runs locally with `SUPABASE_INTEGRATION=1`) (PR #153)
✅ **vitest infra** Headless + flake-free by default (PR #157)
✅ **TD-26** useOfflineWrite retry/error branch coverage — closes the offline-sync coverage gap (PR #159)
✅ **TD-33** Document worktree-commit-hook + vitest yaml-flake gotchas in CLAUDE.md (PR #156)
✅ **TD-34** Consolidate /dispatch + /backlog-dispatch into one canonical skill (mirrors /wave shape); promote worktree-subagents to canonical primitive owning pre-flight + symlink-worktree + scope-contract (PR #161)


### 2026-04-23..24 UX-14..21 design-spec batch + CI rescue (PRs #124–#135)
✅ **UX-14** Command palette (⌘K) — modal with Jump / Log / Admin sections, fuzzy search, keyboard nav (PR #125)
✅ **UX-15** Quick-log FAB — bottom-right expandable with Meds/Mood/BP/Note; Meal+Hydration disabled (PR #126)
✅ **UX-16** Fraunces + Geist Mono type system (plumbing only) — `--font-display`/`--font-mono` tokens + 3 utility classes; no component refactors (PR #128)
✅ **UX-18** Patterns strip in Journal — pastel scroll row with 3 hardcoded mocks + `?filter=` routing (PR #127). Real aggregation deferred to UX-24.
✅ **UX-19** Shift Handoff "What did I miss?" view — 24/48/72h period selector, 5 sections (Meds/Moments/Appointments/Concerns/Thanks), 30 tests (PR #129)
✅ **UX-20** Print-friendly visit summary — 6-section printable `/visit-summary` route, `window.print()`, `lib/medAdherence.ts` helper (PR #130)
✅ **TD-14** Restore green lint — 491 → 0 errors via rule downgrade + 6 hand-fixes; contrast-script token-drift bug fixed (PR #132)
✅ **TD-15** CI infra: lockfile drift + workflow script typos — `pnpm typecheck` → `pnpm type-check`, coverage script relocated (PR #131)
✅ **TD-16** Web typecheck 147 → 0 across 2 PRs; CI now actually runs `cd apps/web && npx tsc --noEmit` instead of silently skipping (PRs #132, #134)
✅ **TD-17** Mobile Jest 0→33 suites green: Math.round in scaledFont, virtual expo-device mock, stale screen text + missing trpc mocks fixed, BottomSheet mocked in journal tests (PR #141)
✅ **Docs infra** CI_HEALTH.md runbook (GitHub billing / secrets / auto-merge / branch protection) + THIRD_PARTY_SETUP.md §13–§14 (PR #133)
✅ **Docs infra** Master SETUP.md + ENV_VARS.md + MOBILE_SETUP.md + DEPLOYMENT.md runbook set (PR #135)

### 2026-04-17 codebase survey batch (PRs #116–#120)
✅ **TD-13** CommentThread onError toasts — add/edit/remove mutations now surface errors via sonner (PR #116)
✅ **UX-13** AIPanel loading + error state — Loader2 spinner + onError toast (PR #117)
✅ **TD-12** Dialog + Label UI components — created shadcn/base-ui wrappers; unskipped tests (PR #118)
✅ **A11Y-011** Web aria-label sweep — all 4 targets already WCAG 2.2 AA compliant (PR #119)
✅ **UX-12** Empty states — AIChatThread + EntryDetailClient now show helpful empty/error UI (PR #120)

### Phase 1 — Cleanup (2026-04-07)
✅ P1-01 Display names · P1-02 Invite redirect · P1-03 Entry detail route
✅ **Journal reactions** — `journal_reactions` table + `careEvents.react` tRPC + `JournalTimeline` emoji row (❤️ 👍 💪 🙏) + `/api/journal/[eventId]/reactions` route. Implemented in Phase 1 work, not previously tracked in backlog.

### Phase 2 — Scheduler (2026-04-07)
✅ P2-01 Shift tRPC + schema · P2-02 Shift creation UI · P2-03 Shift list / caregiver view · P2-04 Coverage window UI · P2-05 Gap detector (Inngest) · P2-06 Recurring shifts · P2-07 Weekly digest shift section

### Phase 3 — Medical + Outer circle (2026-04-09)
✅ P3-01 Medication catalog · P3-02 Admin log · P3-03 OCR pipeline (Inngest) · P3-04 Refill alert · P3-05 Volunteer request board (public `/care/[token]`) · P3-06 Care brief (`/brief/[token]`)

### Phase 4 — Depth + retention (2026-04-10)
✅ P4-01 Symptom tracker · P4-02 Burnout tracker + Inngest alert · P4-03 Full history export (JSON + PDF)

### Phase 5 — Financial + legal (2026-04-13)
✅ P5-01 Shared expense log (`ExpensePanel`) · P5-02 Benefits navigator (`BenefitsNavigator` + eligibility lib) · P5-03 Document vault (`DocumentVault` + upload/download API + FTS migration) · P5-04 EOL planner (coordinator-only, linked to vault)

### Before-launch — Claude tasks
✅ B1 Sentry PII hardened (`sendDefaultPii: false`, env DSN, `sentry.client.config.ts` added)
✅ D2 `apps/web/lib/stripe.ts` (renamed from `stripe.server.ts`)
✅ D3 Subscription/plan migration (`20260416000000_superuser_plan.sql`)
✅ D4 Stripe webhook handler (`apps/web/app/api/stripe/webhook`) + checkout + portal + verify routes
✅ D5 Billing tRPC/subscriptions page (`apps/web/app/(app)/subscriptions/page.tsx`)
✅ D6 BillingBanner (soft-gate pattern)
✅ B3 PostHog provider + server helper (`apps/web/lib/posthog-server.ts`, dashboard view tracking)
✅ E2E specs: expenses, team-admin remove, outer-circle create, care-brief, eol-planner, benefits, contact, burnout privacy suppression, OCR review (all 2026-04-13)

### A11Y + infra (2026-04-13/14)
✅ `memberships.remove` + TeamPanel Remove button · last-coordinator guard migration · memberships delete policy · harden outer-circle + care-briefs RLS · secure prescription-images bucket · push_tokens table · user_profiles.email

### Security / RLS follow-ups (2026-04-16..20)
✅ superuser plan · harden outer_circle_requests RLS · memberships delete policy · documents FTS · last-coordinator guard

### 2026-04-16 mobile + web sprint (PRs #75, #85, #87–#97)
✅ **ON-44** Comment threads on care events — `care_event_comments` + RLS + tRPC + web CommentThread/CommentItem/CommentComposer + mobile CommentSection (PR #73)
✅ **ON-45** Shift trade requests — `shift_trade_requests` + RLS + tRPC router + Inngest cron + web/mobile UI (PR #74)
✅ **ON-46** Medication tagging + chip-filter bars + detail panels — junction tables + auto-tag + tRPC (PR #75)
✅ **A11Y-008** Extend `mobile-ui` skill with VoiceOver/TalkBack enable/disable + narrate workflow (PR #78)
✅ **PP-005** Web push notifications (browser Push API) (PR #85)
✅ **PP-002** Mobile onboarding wizard — welcome, care-recipient, invite-team screens (PR #92)
✅ **PP-003** Mobile subscription read-only view + "manage on web" CTA (PR #93)
✅ **PP-006** Android prebuild + boot verification — `apps/mobile/android/` committed + CI build job (PR #90)
✅ **TD-02** Dynamic Type + screen-reader audit — `scaledFont()` + `accessibilityLabel` sweep (PR #87)
✅ **ON-15** Mobile a11y audit (code complete; physical device VoiceOver deferred to human) — folded into TD-02
✅ **PP-011** Offline journal write-queue — IndexedDB + auto-sync on reconnect (PR #88)
✅ **UX-03** Micro-interactions — card hover lift, mood press, sidebar active, sonner toasts (PR #89)
✅ **TD-07** Alert → Toast sweep — 6 `alert()` calls replaced with sonner across 4 files (PR #94)
✅ **TD-08** Supabase types regen + `as any` cleanup — 10 casts removed (PR #95)
✅ **TD-09** ShiftList edit mode — `shifts.update` tRPC + inline edit panel (PR #96)
✅ **TD-10** JournalClient refactor — 3 custom hooks + JournalLayout; 624 → 107 lines (PR #97)
✅ **TD-06** Dark mode variants for Comment + TradeRequest components; WCAG contrast fix (PR #98)
✅ **PP-007** Android FCM push token registration + notifications tRPC router (PR #99)
✅ **PP-009** Android visual QA script — `scripts/android-visual-qa.sh` (11 routes, HTML diff report; run when emulator available)
✅ **PP-010** Android document-share intent — 17 unit tests covering `Platform.OS=android` Alert.alert picker path (2026-04-17)

### 2026-04-17 onboarding + product (PRs #101–#106)
✅ **ON-52** Care history depth counter on dashboard — "X care events over Y months" + `formatCareStats` helper + 6 unit tests (PR #101)
✅ **ON-56** Data stewardship commitment page `/trust` — 4 commitments + hero + footer link + responsive layout (PR #102)
✅ **ON-58** PostHog funnel events — `first_care_event_created`, `onboarding_step_completed`, `team_member_invited` (UUID-only, PHI-safe) (PR #103)
✅ **TD-11** `data-testid` sweep for MedicationPanel + MedicationChecklist (already implemented; no code change needed)
✅ **ON-57** Family referral share link — coordinator dashboard "Refer Carelog" button, `/signup?ref=<orgSlug>`, PostHog `referral_shared` UUID-only event (PR #105)
✅ **ON-50** Weekly digest medications section — `medDoseCount` query + `digestHtml` meds line + 3 new tests (singular/plural/zero) (PR #106)
✅ **ON-49** Shift completion handoff prompt — "Complete shift" button + inline handoff note textarea + `shifts.complete` tRPC proc (assignee OR coordinator) + 9 tests (PR #108)
✅ **ON-51** Aide recipient-scoping — recipient picker in TeamPanel invite form (role='aide' only); `useJournalData` loads org recipients; `handleInvite` overrides `recipientId`; 4 new tests (PR #109)
✅ **ON-60** Referrer resource page `/for-referrers` — hero, audience callout, 4 feature cards, 3-step how-to-refer with clipboard copy, trust signals, footer link; no commission language (PR #107)

### 2026-04-16 backlog sync (PRs #53–#74)
✅ **A11Y-005** vitest-axe assertions on Card, Button, Input, Label, Dialog (PR #59)
✅ **A11Y-006** Mobile a11y snapshot tests per top-level screen (PR #63)
✅ **A11Y-007** Lighthouse a11y audit script + GitHub Actions CI workflow (PR #68)
✅ **A11Y-009** `prefers-reduced-motion` — web global CSS + mobile `useReducedMotion()` (PR #67)
✅ **ON-31** E2E: settings page notification prefs (PR #69)
✅ **ON-37** `ts-prune` unused-exports sweep — removed `getPostHog` + `WatchData` (PR #62)
✅ **ON-48** Neutral design tokens + brief page hex sweep (PR #58)
✅ **TD-05** Regenerate Supabase TS types after messaging migration; removes `as any` in messagesRepository
✅ **UX-01** Loading skeletons across dashboard/journal/team/messages panels (PR #54)
✅ **UX-02** Illustrated empty states — journal, meds, team, vault (PR #70)
✅ **UX-04** Full dark mode via CSS custom properties + ThemeToggle + anti-FOUC script (PR #71)
✅ **UX-05** Mobile journal bottom-sheet + horizontal mood row (PR #60)
✅ **UX-07** Active-panel breadcrumb / dynamic page title (PR #53)
✅ **UX-10** Export styling `/brief/[token]` + `/care/[token]` (PR #55)
✅ **AI assistant** PHI-safe Claude FAB — context-aware suggestions, org-scoped, no PHI sent to API (PR #72)
✅ **Shift calendar** Replace ShiftList with react-big-calendar day/week/month views (PR #66)

### 2026-04-14 parallel agent session (PRs #34–#49)
✅ **ON-21** Web raw-hex audit — all hex replaced with `var(--color-*)` design tokens (PR #34)
✅ **ON-29** Replace `console.log` with project logger in `apps/web` (PR #35)
✅ **PP-004** Unified settings hub at `/settings` — profile, notification prefs, timezone, danger zone (PR #36)
✅ **PP-001** Mobile team admin — change role + remove member with pgTAP coverage (PR #31/#37)
✅ **ON-32** E2E invite-accept happy path + expired-token rejection (PR #38)
✅ **A11Y-001** Web axe-core/playwright — `checkA11y()` helper wired into `e2e/helpers.ts` (PR #39)
✅ **A11Y-002** eslint-plugin-jsx-a11y at `error` severity — `alt-text`, `click-events`, `no-static-element-interactions` (PR #39)
✅ **ON-33** Mobile Sentry breadcrumbs on tRPC errors — procedure name + op type, PHI scrubbed (PR #40)
✅ **ON-20** Mobile `accessibilityLabel` sweep — all icon-only Touchable/Pressable labelled (PR #41)
✅ **A11Y-004** WCAG contrast validator `scripts/a11y-contrast.mjs` — exits non-zero on failure, wired to `pnpm a11y:contrast` (PR #42)
✅ **A11Y-010** Colorblind simulator walkthrough step added to `.claude/rules/ui-standards.md` (PR #42)
✅ **ON-27** Web alt-text audit — all 6 Image elements verified with meaningful alt props (PR #45)
✅ **ON-30** JSDoc on public exports in `packages/shared` (PR #46)
✅ **ON-39** Eliminate `any` types — `ExportDocument`, `careEvents` router, `export/route` fully typed (PR #47)
✅ **ON-47** `data-testid` attrs on `MedicationPanel` + `MedicationChecklist`; E2E TODOs resolved (PR #48)
✅ **ON-34** PostHog funnel events parity audit — `docs/project-info/technology/ANALYTICS_EVENTS.md` (PR #43)
✅ **ON-36** TODO/FIXME audit — `docs/project-info/technology/TODO_AUDIT.md`; 6 deleted, 2 converted to ON-47/ON-48 (PR #43)
✅ **A11Y-003** Mobile `eslint-plugin-react-native-a11y` at `recommended` severity (PR #33)
✅ **ON-26** Mobile empty-state copy pass — Carelog voice with CTA on all screens (PR #32)
✅ **ON-28** Mobile loading skeletons on journal, medications, documents, team index (PR #32)
✅ **ON-43** In-app messaging (DM + group) — `message_threads` + `message_thread_members` + `messages`, RLS, tRPC router, Supabase Realtime web UI, Inngest delayed push (PR #49)
✅ **Security** PostHog contact PHI fix (`distinctId: crypto.randomUUID()`) + WCAG danger token `#c41a1a` (PR #44)
✅ **TD-01** Harden remaining `any` usages (PR #47)
✅ **TD-04** Consolidate `images/` → `apps/web/public/images/` (root dir absent — no-op confirmed)
✅ **UX-06** Sidebar tooltip labels on hover — `TooltipProvider` wraps `<nav>`, icon-only mode wraps each button in `Tooltip`/`TooltipContent side="right"` (2026-04-14)

---

## 8. Human setup (pre-launch)

Canonical references:
- `docs/project-info/runbooks/THIRD_PARTY_SETUP.md` — all third-party service accounts + env vars
- `docs/project-info/runbooks/CI_HEALTH.md` — GitHub billing, secrets, repo settings

These tasks require signing into third-party consoles and cannot be automated:

**Third-party services (THIRD_PARTY_SETUP.md)**
- **Supabase cloud** — project, keys, HIPAA BAA (§1)
- **Vercel** — project + all env vars, `SENTRY_AUTH_TOKEN` (§2)
- **Inngest cloud** — keys + register app post-deploy (§3)
- **Resend** — API key + domain verification (§4)
- **Upstash Redis** — rate-limiting database (§5)
- **Stripe** — account + product + prices + webhook endpoint in live mode (§6)
- **Sentry** — DSN + source maps auth token (§7)
- **PostHog** — project + key + privacy settings (§8)
- **VAPID keys** — generate once, set in Vercel (§9)
- **Firebase / FCM** — Android push (`google-services.json` → EAS) (§10)
- **APNs `.p8` key** — via EAS credentials (§11)
- **Deep-link verification files** — AASA (iOS) + `assetlinks.json` (Android) (§12)

**GitHub / CI prerequisites (CI_HEALTH.md)**
- **GitHub Actions billing** — payment method + spending limit; hard-blocks all CI when failed (§1)
- **`ANTHROPIC_API_KEY` secret** — repo Settings → Secrets → Actions; gates AI security review on every PR (§2)
- **Allow auto-merge** — repo Settings → General → Pull Requests; required for unattended agent PRs (§3)
- **Branch protection on `main`** — current posture permissive; tighten post-launch (§4)

**Local dev (THIRD_PARTY_SETUP.md §14)**
- **Playwright Chromium** — `cd apps/web && npx playwright install chromium` — new machines hit a hard pre-commit failure without this

Claude work that's **gated on the above** (cannot start until the human completes the corresponding step):
- 🧑 **A2** — `supabase link --project-ref <ref>` + `db push` + bucket create + `supabase test db` against cloud *(needs Supabase cloud keys)*
- 🧑 **C3** — update weekly digest FROM address to `notifications@<verified-domain>` *(needs Resend verified domain)*
- 🧑 **PP-008** — Android app-links verification *(needs `assetlinks.json` on a live domain + EAS build SHA-256)*
- 🧑 **TD-03** — Sentry source maps *(needs `SENTRY_AUTH_TOKEN` in Vercel)*

---

## 9. Definition of done (every story)

- [ ] Feature works end-to-end in local dev
- [ ] Role enforcement verified where applicable (wrong role → no access)
- [ ] Vitest and/or pgTAP coverage added for non-trivial logic
- [ ] No Turbopack JSX violations (no template literals in JSX props)
- [ ] Typecheck + lint + test suites green (`pnpm typecheck && pnpm lint && pnpm test`)
- [ ] For mobile UI: spot-check via `/mobile-ui` skill (screenshot at least one state)
- [ ] For web UI: axe hook green (post A11Y-001), respects tokens, keyboard-traversable
- [ ] TECH_DEBT.md updated if a known issue is resolved
- [ ] BUILD_STATUS.md checkbox ticked if relevant

---

## 10. Lifecycle update contract (all agents)

**Single source of truth.** Every planned piece of work lives here. Do not track work in ad-hoc docs, memory, or PR descriptions alone.

**When status changes, update this file in the same commit as the code change:**

| Transition | What to do |
|---|---|
| Picking up a story | Flip `Status:` to `⚡ In progress`, add `Owner:` + `Branch:` |
| Opening a PR | Flip to `🔎 In review`, add `PR: #NNN` |
| Hitting a blocker | Flip to `🔴 Blocked`, add `Blocked by:` with the reason or upstream ID |
| Merging | Move the row to §7 (shipped log) with a one-line summary; delete from §1–§5 |
| Discovering new work | Open a new row with `Status: 🟢 Ready`, pick the right prefix (`TD-*`, `A11Y-*`, `ON-*`, etc.), and leave it unowned |

**`/backlog-sync` runs this reconciliation automatically** against `git log`, open PRs (`gh pr list`), and the shipped log. Invoke it:

- At **session start** when resuming work on this repo
- At **session end** via `/session-end`
- On a **daily cron** via `/schedule` so scheduled agents see fresh state
- Any time the §0 status board looks stale

Never delete a story silently — either move to §7 (shipped) or mark 🧊 with a reason.

---

## 11. Agent contract (what any picking agent can assume)

- Before picking up any row, run `/backlog-sync` and claim the row by flipping its `Status:` to `⚡ In progress` + `Owner:` in the first commit
- `pnpm` at the repo root is the entry point; each app has its own workspace scripts
- `supabase start` must be running for any pgTAP test
- macOS host; `./scripts/mobile-ui.sh` is available for any mobile visual check (iOS or Android)
- `/ollama` is available for mechanical fan-out; `/create-migration` for schema work; `/review` before committing RLS/PHI touches
- **Never** skip hooks (`--no-verify`). If a hook fails, investigate — don't bypass
- **Never** commit to `main` — every story lands on a branch + PR
- If a story is blocked by new information discovered mid-work, update the story's `**Blocked by:**` here and stop — don't improvise scope
