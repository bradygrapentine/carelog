# Carelog — Master Backlog

> **This is the single source of truth for all planned work.** Every task — feature, bug, tech debt, infra, polish — is tracked here with a lifecycle status. Read this file **before** starting any task. Update it **immediately** when status changes. If it isn't here, it isn't planned. Run `/backlog-sync` at least once a day (and on session start) to reconcile against git/PRs.

Last consolidated: **2026-04-16** (codebase scan same day). Last `/backlog-sync`: **2026-05-15 (journal-meds-quick-wins sprint close)** — `/sprint journal-meds-quick-wins` shipped UX-041/042/043 via direct-implementation wave (PRs #505/#506/#507). Sonnet fallback for `/opus-on-opus` (Opus was 529'ing per status.claude.com; recovered post-merge). Mid-sprint hotfix #504 deleted an invented `apps/web/app/(app)/page.tsx` left by yesterday's TD-135 subagent — drove a CLAUDE.md retro entry on "verify owned-file paths exist before locking the plan." `/oop --from-sprint` review seeded TD-137 (members.find perf) + TD-138 (5-way JournalEvent type duplication) via #508. Remaining Ready = 30.

Replaces: `BACKLOG_PHASE2–5.md`, `BACKLOG_UI_REDESIGN.md`, `docs/superpowers/plans/CLAUDE_BACKLOG.md`. `BUILD_STATUS.md` and `TECH_DEBT.md` are **historical logs only** — new work is tracked here.

Human account-signup tasks (Supabase/Vercel/Stripe/etc.) live in `docs/project-info/runbooks/THIRD_PARTY_SETUP.md` and are referenced from §8.

---

Human Backlog Items:
- ability to schedule team wide meetings and embed zoom links


## 0. Status board (at-a-glance)

Counts reflect items in §1–§6 only; §7 is the shipped log.

| Lifecycle | Count | Where |
|---|---|---|
| 🟢 Ready | 30 | TD-111 · TD-120..123 · TD-129/130 · TD-133 · TD-137/138 · UX-044 · UX-048..050 · UX-053 · UX-065 · UX-077 · UX-103b/104b/105b · SEC-007 · SEC-008 · SEC-009 · SEO-005 · PP-009 · ON-70 · ON-71 · ON-74 (+ rows in §3–§5 not enumerated) |
| 🔎 In review | 0 | — |
| 🟡 Spike | 2 | UX-046 (clinician-share surface) · TD-87 (Lighthouse a11y path) |
| 🔴 Blocked | 0 | — |
| 🧊 Deferred | 17 | §5 ON-55 (ON-69 struck dup) · §1 UX-066 (superseded) · UX-035 (BriefHero now wired) · UX-051 (caresync.app DNS not provisioned) · TD-126 (LCP premise wrong; 132ms local) · **OOP-003 (messaging pgTAP already exists on main)** · **OOP-007 (`user_is_org_coordinator()` already exists + consumed; 0 inline checks remain)** · SEO-003 (no /carezone-alternative; /about lacks step content) · ON-72/73 (Phase 3/4 prereqs) · §6 UX-08/09/11/22/23/24 · §3 PP-013 |
| 🧑 Needs human | 12 | §5 ON-54 · §8 A2 · C3 · PP-008 · §4 A11Y-018 · §1 LAUNCH-001 · LAUNCH-005 · TD-03 · TD-83 · UX-106 · SEO-006 · SEO-007 |

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
- `OOP-*` — invariant-preserving refactor candidates (see `docs/plans/2026-05-14-oop-refactor.md` and the `/oop` skill)
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
| ON-53 | ✅ Shipped · PR #100 | — | — | **CareZone alternative landing page** | `/carezone-alternative` hero, CareZone comparison table, medication import preview tool; MarketingNav linked ("CareZone users"). **Note (2026-05-09):** standalone page consolidated into `/about` via PRs #316/#317 — see `apps/web/app/(marketing)/about/page.tsx` (`CompareTable`, `CareZoneMedicationImport`). |
| ON-57 | ✅ Shipped · PR #105 | — | — | **Family referral share link** | Coordinator dashboard button: "Refer Carelog to another family." Generates a shareable `/signup?ref=<orgSlug>` URL (new-org referral, not a team invite). PostHog tracks `referral_shared` + `referral_converted` events. Referral source stored on new org row. Key KPI: 60% referral rate by month 6 (PRODUCT_STRATEGY.md). ~1 day. |
| ON-58 | ✅ Shipped · PR #103 | — | — | **Analytics: onboarding + retention funnel events** | Add PostHog events: `onboarding_step_completed` (step name, elapsed_ms), `first_care_event_created` (elapsed_ms since signup), `team_member_invited` (team_size property). Powers PRODUCT_STRATEGY.md KPIs: "time to first care event < 10 min" + "week 4 retention 70%+." PHI rule: UUID only — no names or emails. ~0.5 day. |

### New tech-debt (TD-*) — opened 2026-04-14

| ID | Status | Story | Notes |
|---|---|---|---|
| TD-02 | ✅ Shipped · PR #87 | **Dynamic Type + screen-reader audit (mobile)** | scaledFont + accessibilityLabel sweep shipped. Physical device VoiceOver verification deferred to human. |
| TD-03 | 🧑 Needs human | **Sentry source maps upload** | BUILD_STATUS: "source maps pending `SENTRY_AUTH_TOKEN`". Code wired (`apps/web/next.config.ts` Sentry plugin) + runbook documents enable steps (`docs/project-info/runbooks/OBSERVABILITY.md` §1). Only the human action of setting the Vercel env var remains. |
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
| TD-77 | ✅ Shipped · PR #328 | **Tests for `identityRepository.ts` (Tier 1 — PHI vault)** | Uses `supabaseAdmin` (no RLS protection). Untested cross-org `resolveIdentity(token, org_id)` could leak names/DOB/contact between orgs in a silent regression. New file: `apps/web/server/repositories/__tests__/identityRepository.test.ts`. Test (a) cross-org token rejection, (b) malformed token, (c) expired token. ~2 hr. |
| TD-78 | ✅ Shipped · PR #248 | **Tests for `user.ts` tRPC router (Tier 1 — auth boundary)** | 21 tests in `apps/web/server/routers/__tests__/user.test.ts` covering ctx.user=null → 401, IANA timezone regex, dismissEducationTip date math, updateNotifications. |
| TD-79 | ✅ Shipped · PR #249 | **Tests for `careEventsRepository.ts` (Tier 1 — core PHI write)** | 10 tests in `apps/web/server/repositories/__tests__/careEventsRepository.test.ts` covering validatePayload pre-DB-write, cross-recipient timeline isolation, insertEvent org_id boundary. |
| TD-80 | ✅ Shipped · PR #250 | **Tests for `lib/stripe.ts` (Tier 1 — payment infra)** | 3 tests in `apps/web/lib/__tests__/stripe.test.ts` covering missing-env error, singleton identity, pinned `2026-03-25.dahlia` API version. |
| TD-81 | ✅ Shipped · PR #253 | **Tests for `organizationsRepository.ts` (Tier 2 — team isolation)** | 11 tests in `apps/web/server/repositories/__tests__/organizationsRepository.test.ts` covering cross-org isolation + DB-assigned UUID contract. |
| TD-82 | ✅ Shipped · PR #258 | **RLS test stub for `care_events_client_id` migration** | pgTAP coverage in `supabase/tests/care_events_client_id.test.sql` — 4 scenarios (NULL coexistence, partial unique constraint, global cross-org uniqueness). |
| TD-83 | 🧑 Needs human | **Verify `CI Summary` is in main branch protection** | Pre-flight audit couldn't read protection config (no PAT in shell). Manually verify via GitHub UI: Settings → Branches → main → required checks includes `CI Summary` (per TD-30). If missing, add via API. ~0.25 hr. |

### Post-Wave-9 audit (TD-107..110, UX-107, UX-108) — opened 2026-05-09

Surfaced during the post-Wave-9 cleanup pass: read-only audit of sign-in flow, app-shell SSR auth, marketing/sign-in style divergence, and the lone surviving `TODO` marker.

| ID | Status | Story | Notes |
|---|---|---|---|
| TD-107 | ✅ Shipped · 2026-05-09 | **OTP input renders tiny: `text-2xl` + `text-sm` Tailwind class collision** | `apps/web/app/signin/SignInForm.tsx:119` had both `text-2xl` AND `text-sm` on the OTP input — Tailwind last-wins resolved to `text-sm`, so the "large monospace OTP digits" intent rendered small. Looked broken. Fixed in `chore(post-wave-9-cleanup)`: dropped `text-sm`, kept `text-2xl font-mono`, replaced `tracking-widest` with `tracking-[0.4em]` for clearer per-digit spacing. |
| TD-108 | ✅ Shipped · 2026-05-09 | **Multi-org caregiver: `(app)/layout.tsx:23` `.single()` silently nulls `orgId` for users with 2+ memberships** | Replaced `.single()` with `.order("accepted_at", { ascending: true }).limit(1)` so the earliest-accepted membership becomes the primary org. Shipped with Wave 10 (PR #383). |
| TD-109 | ✅ Shipped · 2026-05-09 | **`/signin` doesn't redirect already-authenticated users to `/dashboard`** | Server-side `getUser()` → `redirect("/dashboard")` added to `app/signin/page.tsx` before render, skipping the OTP form for authed visitors. Shipped with Wave 10 (PR #383). |
| TD-110 | ✅ Shipped · PR #384 | **Replace `TODO(UX-24)` placeholder with real pattern aggregation in `PatternsStrip`** | Wired `PatternsStrip` to new `briefs.patterns` tRPC procedure backed by `detectPatterns()` (plural helper added alongside the existing singular `detectPattern`). Drops the 3 hardcoded mocks; renders only when `data.length > 0`. Shipped with Wave 11. |
| UX-107 | ✅ Shipped · 2026-05-09 | **Sign-in / onboarding pages diverge from marketing brand voice** | Migrated `/signin` and `/onboarding` h1s to `.headline-display` with the Fraunces italic-em pattern (`Sign in to <em>CareSync</em>`, `Set up your <em>care team</em>`). Dropped the placeholder colored square from `/signin`. Shipped with Wave 10 (PR #383). |
| UX-108 | ✅ Shipped · 2026-05-09 | **`/signin` is unbranded — no link back to landing for visitors who got there by accident** | New `MarketingNavSlim` (brand-mark only, links back to `/`) mounted on `/signin` and `/onboarding` so users have a way out of the auth flow. Shipped with Wave 10 (PR #383). |
| UX-109 | 🟢 Ready | **Single burnt-orange palette across marketing AND app — retire purple, Sage, and coral** | Owner ask 2026-05-09 (revised 2026-05-10). One brand color: burnt orange shades (primary + tints/shades for surfaces, accents, hover/active). Retire purple `#7c3aed` (marketing), the Sage parlor theme + tokens (PR #351), and tertiary coral `#e76f51`. **Keep semantic tokens unchanged** — `--color-success` (green), `--color-danger` (red), `--color-warning` (amber) stay so error/success states remain readable. Scope: (1) rewrite `--color-primary` + `--color-primary-subtle` + `--color-secondary` + `--color-secondary-subtle` in `apps/web/app/globals.css` to a burnt-orange ramp; (2) drop Sage theme + ThemeSwitcher; (3) audit every raw `#7c3aed` / `#d97706` / `#e76f51` / Sage token reference; (4) regenerate brand assets that bake old hex (favicon, OG images, signin block). Concrete burnt-orange hex ramp TBD (suggest base + 3 tints + 2 shades). Pairs with UX-110 (full dark-mode removal). |
| UX-110 | 🟢 Ready | **Remove dark mode entirely — functionality, components, toggle, and `dark:` variants** | Owner ask 2026-05-09 (revised 2026-05-10). Not a toggle-removal — full retirement. Scope: (1) drop `ThemeSwitcher` component + every mount site (marketing nav, app toolbar); (2) remove `next-themes` provider + dependency; (3) sweep every Tailwind `dark:` variant from `apps/web/app/` and `apps/web/components/`; (4) drop dark-only assets (e.g. SageRail dark sidebar styling from PR #351); (5) confirm `prefers-color-scheme` is not consulted anywhere. Light mode only, forever. Closes UX-111 by construction. |
| UX-111 | 🚫 Won't fix · subsumed by UX-110 | **Dark mode visibly broken on app shell post-login** | Original repro 2026-05-09. Closed 2026-05-10 — UX-110 now retires dark mode entirely, so there is nothing to fix. Kept for audit trail. |
| UX-112 | 🟢 Ready | **Onboarding "Preview your medication import" — side-by-side layout, restyle CTA, add subheader + blurb** | Owner ask 2026-05-10. Today the medication-import preview card stacks vertically with the textarea filling the width, then a lonely "Start your family's log" pill button floating below the card. Asks: (1) split the card into a two-column layout — paste textarea on the left, live preview / explanatory copy on the right; (2) restyle the CTA button to match the new burnt-orange brand (UX-109) with a clearer hierarchy (size, weight, hover affordance); (3) add a short subheader above the button (e.g. "Ready to start logging?") and a one-line blurb explaining what happens on click ("We'll create your care team and pre-populate today's brief from your medication list."). Sequenced AFTER UX-109 so the button color lands once. Touches `apps/web/app/onboarding/` + the medication-import preview component. |
| UX-113 | ✅ Shipped · PR #441 + #443 | **Marketing landing "A shared rhythm" section is missing its illustration at desktop widths** | Discovered 2026-05-10 smoke walk. The "A shared rhythm, not another app to manage" section on `/` has a left column rendered as an empty grey rectangle at 1440px. The caregiver photo IS present on the same section at 375px (mobile) — confirms a viewport-conditional asset that broke at the desktop breakpoint. Likely a `hidden lg:block` sibling pair where the desktop image src is missing/404 OR a CSS background-image whose path no longer resolves. Investigate `apps/web/components/marketing/` + the landing page composition; `grep -rn "shared rhythm" apps/web` to locate. |
| UX-114 | ✅ Shipped · PR #439 | **`/about` has a redundant "Start your family's log" CTA after UX-112** | Discovered 2026-05-10 smoke walk. UX-112 (PR #435) added an in-card CTA inside the "Preview your medication import" card. The pre-existing page-level "Start your family's log" button below the card was not removed, so two identical burnt-orange buttons now stack vertically on `/about`. Decide which to keep — likely the in-card one (closer to the action context) and remove the page-level CTA, OR vice-versa if the page-level one is a sticky bottom bar serving a different role. Touches `apps/web/app/(marketing)/about/page.tsx`. |
| UX-115 | ✅ Shipped · PR #440 | **Dashboard double-FAB ambiguity (Quick log + AI sparkle in same primary orange)** | Discovered 2026-05-10 smoke walk. The dashboard renders two floating action buttons bottom-right: a "+" Quick-log FAB and a sparkle "Open AI Assistant" FAB. Both are filled `--color-primary` burnt orange, identical size, side-by-side. They read as competing primary actions when one is the primary write action and the other is a secondary helper. Differentiate visually: keep Quick log filled-primary, switch the AI assistant to outline / muted / smaller. OR consolidate into a single trigger with a menu. Touches `apps/web/components/QuickLogFab.tsx` (and the AI assistant FAB component). |

### Onboarding bugs (ON-75)

| ID | Status | Story | Notes |
|---|---|---|---|
| ON-75 | 🟡 Pending verification (local) | **Onboarding wizard — care team setup failure was misconfigured local env, not an RLS policy gap** | Root cause amended 2026-05-10 PM. Initial repro showed `Error: Org creation failed: new row violates row-level security policy for table "organizations"`. Diagnosis traced it to `apps/web/.env.local` containing the **production** `SUPABASE_SERVICE_ROLE_KEY` in `sb_secret_*` format, which the local Supabase JWT-only auth rejected — `supabaseAdmin` silently fell back to anon role, then RLS correctly blocked the insert. The route + repository code are correct; the server-side `supabaseAdmin` client bypasses RLS when the key is valid. Resolution: swap local `.env.local` to the JWT from `supabase status` (owner action, hook-protected). **Verify in production** — if production deploy actually has a valid service role key (likely yes), prod is unaffected and this row closes as "config issue". If prod also fails, reopen as a real RLS gap. Defense-in-depth follow-up: surface a clearer error than a generic RLS message when `supabaseAdmin` is misconfigured (file as TD if it recurs). |

### Security incidents (SEC-001) — opened 2026-05-10

| ID | Status | Story | Notes |
|---|---|---|---|
| SEC-001 | 🔴 In progress · **P0** | **Rotate all production secrets that landed in local `apps/web/.env.local` via `vercel env pull`** | Discovered 2026-05-10 while diagnosing ON-75. The local `.env.local` was created by `vercel env pull` and contains live production credentials in plaintext on disk. Rotate ALL of the following in their respective dashboards: (1) `SUPABASE_SERVICE_ROLE_KEY` (Supabase dashboard → Project Settings → API → reset service role key); (2) `STRIPE_WEBHOOK_SECRET` (Stripe dashboard → Webhooks → roll signing secret); (3) `RESEND_API_KEY` (Resend dashboard → API keys → revoke + reissue); (4) `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` (Inngest dashboard → roll keys); (5) `UPSTASH_REDIS_REST_TOKEN` (Upstash dashboard → reset REST token). After rotation, update Vercel env (Production environment) with new values, redeploy. `VERCEL_OIDC_TOKEN` rotates itself. Then **scrub git history** for any commit that ever included these (run `git log -p apps/web/.env.local` and any leaked-secret scanner like gitleaks). Going forward: keep `.env.local` git-ignored (already is) and prefer `vercel env pull --environment=development` (dev secrets) over the prod-pulling default for local work. |

### OWASP audit follow-ups (SEC-002..006, TD-131..132) — opened 2026-05-14

Source: `/owasp` full-project read-only audit. Findings at `docs/security/2026-05-14-owasp-audit.md`. 1 High + 3 Medium + 2 Low (1 Info dropped — no action). All file:line cited and grep-verified. Mostly defense-in-depth gaps on an otherwise strong posture (34/34 tables RLS-enabled, no XSS/code-exec sinks, PHI invariant double-enforced).

| ID | Status | Story | Notes |
|---|---|---|---|
| SEC-007 | 🟢 Ready · **P2 / Medium** | **OCR confirm route audit-log site** | Closes part 3 of audit FIND-003 (parts 1+2 shipped via SEC-004 #493). Add `{user_id, ocr_job_id, raw_output_hash, confirmed_fields, ts}` audit log in `apps/web/app/api/ocr/confirm/route.ts` (or equivalent confirm path — verify exact path before starting). MUST land before any real-provider wiring story. Pairs with future Sentry routing for OCR-related anomalies. **Risk:** LOW (audit-only; no behavior change to OCR flow). **Size:** S (1–2h). |
| TD-133 | 🟢 Ready · **P3 / Low** | **`ai_conversations` archival Inngest job (90-day cutoff)** | Closes the archival half of audit FIND-007; the row-cap half shipped as TD-132 #491 (DB-level CHECK constraint). Periodic Inngest job under `apps/web/inngest/functions/aiConversationsArchive.ts` that deletes rows older than 90 days. **Materialize when the first write site lands** — currently `ai_conversations` is unused (only `revokeConsent` DELETE at `apps/web/server/routers/ai.ts:246`); nothing to archive yet. Story can sit blocked until an AI feature adds an INSERT. **Risk:** LOW. **Size:** S (1–2h). |
| SEC-008 | 🟢 Ready · **P3 / Low** | **Rotate existing 128/192-bit share tokens to 256-bit** | SEC-006 #492 changed `outer_circle_requests.share_token` and `care_briefs.share_token` DEFAULTs to 256-bit but did NOT rotate existing in-flight tokens. Existing tokens still exceed the 64-bit guessability floor (128-bit minimum is OWASP-compliant) so this is consistency cleanup, not vuln remediation. Implementation: new migration that regenerates each existing `share_token` with `gen_random_bytes(32)`, PLUS a notification email to outer-circle requesters / care-brief owners that their old link is invalidated. **Risk:** MEDIUM (link invalidation is user-visible — requires the email step). **Size:** M (2–3h). |
| SEC-009 | 🟢 Ready · **P2 / Medium** · sequenced after SEC-001 | **Populate Vercel's Development environment tier with local-tier values** | Mitigates the contributing-factor that caused SEC-001 (default `vercel env pull` pulls Production). Operator walkthrough now lives in `docs/project-info/runbooks/SECRETS_ROTATION-runbook.md` §9 ("Populate Vercel's Development environment tier") — landed via PR #498 in the pre-staging-mitigations sprint. After rotation completes, walk that §9 step-by-step (Vercel dashboard → Project → Settings → Environment Variables; for each of the 6 rotated secrets + the 3 Supabase URL/key vars, click "Add for Development" with a local-tier value); then verify via `vercel env pull --environment=development .env.local`. Going forward, the `vepull` alias from `SECRETS_ROTATION.md` §3 grabs SAFE values. Closes the leak-vector permanently. **Risk:** LOW (additive — does not change Production or Preview tiers). **Size:** S (~30 min UI work, no code). Sequenced AFTER SEC-001 actually rotates so you're not splitting attention. |
| TD-137 | 🟢 Ready · **P3 / Low** | **JournalCard author resolution — hoist `members.find()` from per-render to a `Map` (or pre-resolve in `useJournalData`)** | Surfaced 2026-05-15 by `/oop --from-sprint` review of `journal-meds-quick-wins` (PR #507 UX-041). Today `apps/web/app/(app)/journal/[recipientId]/JournalTimeline.tsx:161-163` does `members.find((m) => m.user_id === event.actor_id)?.display_name` per `JournalCard` render — O(N×M) for N events × M members. Fine at current scale (50 × 5); becomes wasted work at 200+ events with frequent re-renders (filter chips, mood toggles). Two clean paths, pure refactor with zero behavior change: (a) `useMemo` a `Map<user_id, display_name>` at `JournalTimeline` and pass it (or a resolver fn) down to `JournalCard`; (b) pre-resolve `authorDisplayName` inside `useJournalData`'s state shape so cards become oblivious to the members list. Path (b) is more invasive but eliminates a class of bug (cards drifting out of sync with member changes). **Risk:** LOW (purely internal). **Size:** XS (~30min for path (a); ~1h for path (b)). |
| TD-138 | 🟢 Ready · **P3 / Low** | **Consolidate `JournalEvent` type duplication into a shared types module** | Surfaced 2026-05-15 by `/oop --from-sprint` review of `journal-meds-quick-wins`. The `JournalEvent` type is locally duplicated across **5 files**: `apps/web/hooks/useJournalData.ts:19`, `apps/web/hooks/useJournalActions.ts:13`, `apps/web/app/(app)/journal/[recipientId]/JournalLayout.tsx:39`, `apps/web/app/(app)/journal/[recipientId]/JournalTimeline.tsx:129`, `apps/web/app/(app)/journal/[recipientId]/entry/[eventId]/EntryDetailClient.tsx`. UX-041 (PR #507) had to update 4 of those 5 to add `actor_id: string` because TypeScript's structural typing surfaces the missing field. The next person who adds a field will pay the same tax. Extract to `apps/web/types/journal.ts` (or co-locate with `useJournalData.ts` as the canonical source), re-export from all 5 sites. Pure refactor — `/oop` invariant-preserving. **Acceptance:** `grep -rn "^type JournalEvent" apps/web/` returns exactly 1 hit; `cd apps/web && npx tsc --noEmit` green. **Risk:** LOW. **Size:** XS (~30min). |

### SEO discoverability (SEO-001..007) — opened 2026-05-09

Roadmap §"SEO discoverability (post-launch)" added 2026-05-09. LAUNCH-003 shipped table-stakes meta + sitemap + JSON-LD; this slate goes deeper for organic discoverability. Tracked as a separate prefix to keep them visible during the post-launch push.

| ID | Status | Story | Notes |
|---|---|---|---|
| SEO-001 | ✅ Shipped · PR #386 | **Per-page `<title>` + meta description rewrite for primary intent keywords** | Every marketing route's metadata rewritten for intent-shaped titles (≤60 char) + descriptions (≤160 char). Shipped with Wave 12 Session A. |
| SEO-002 | ✅ Shipped · PR #386 | **Add `FAQPage` JSON-LD on `/`, `/pricing`, `/about`** | FAQPage JSON-LD added on `/contact` (existing 3-Q&A FAQ) and `/pricing` (new 3-Q&A "Pricing FAQ" section). `/about` skipped — comparison-table-shaped, not FAQ-shaped (would have been schema spam). Shipped with Wave 12 Session A. |
| SEO-003 | 🧊 Deferred | **Add `HowTo` JSON-LD on `/about` and the CareZone-alternative page** | Deferred 2026-05-09: `/carezone-alternative` was consolidated into `/about` via PRs #316/#317; `/about` lacks step-by-step content the schema would describe. Adding the schema without matching visible content = schema spam (Google penalizes). Re-visit when the human writes step-by-step caregiving content. |
| SEO-004 | ✅ Shipped · PR #386 | **`<h1>` hierarchy + internal linking audit** | h1 hierarchy was already clean (every marketing route has exactly one `<h1>`). Internal-linking gap closed: `MarketingFooter` previously linked only Privacy/Terms/Referrers/Contact — added Pricing, About, Trust. Shipped with Wave 12 Session A. |
| SEO-005 | 🟢 Ready | **Core Web Vitals tightening on `/`, `/pricing`, `/about`** | Last measured 2026-04-28 (`/` 86ms, `/pricing` 61ms, `/about` 63ms LCP) — solid but pre-image-heavy. Run Lighthouse + Chrome DevTools perf trace; defer below-fold images, inline above-fold critical CSS, audit the `next/font` config for FOIT. CWV is a confirmed ranking factor. ~3 hr. |
| SEO-006 | 🧑 Needs human (re-scoped 2026-05-09) | **Cornerstone content engine — 3–5 articles at `/learn/*`** | Build a thin MDX-based blog at `/learn/*` (Next.js App Router, static-only, no CMS — minimal infra). Three to five long-form articles on caregiver pain points: "Managing medications across a care team", "Sharing shift handoff notes that actually help", "When a parent's care needs grow beyond what one person can do", etc. Each article is internally linked, has its own JSON-LD `Article` markup, and lands in the sitemap. ~8 hr — **6 of those 8 are long-form copy writing where single creative voice matters; flagged 🧑 Needs human.** Infra (~2 hr) can be ready when the human carves out the writing time. |
| SEO-007 | 🧑 Needs human | **Verify in Google Search Console + Bing Webmaster Tools, submit sitemap** | Both consoles require ownership verification (DNS TXT or meta tag — meta tag works since marketing routes are SSG). Ownership tag goes in `(marketing)/layout.tsx`. Then submit `https://care-log.org/sitemap.xml`. Track index coverage weekly for the first month. Mostly setup, but gates SEO-001..006's measurable impact. ~30 min once human is at the keyboard. |

### Lighthouse a11y CI gating gap (TD-87) — opened 2026-04-29

Discovered during `/impeccable critique` post-merge verification of PR #269. The CI Lighthouse a11y workflow ran on the merged main but reported "success" without auditing anything — Vercel preview deployments are auth-gated (HTTP 401), and `scripts/lighthouse-a11y.mjs:27-33` treats 401/403 as a non-blocking skip. Net effect: the a11y score gate has been silently inactive on every preview-driven CI run. Local Lighthouse on the actual marketing routes still passed (96 / 100 / 94 on /, /about, /pricing) so no regression slipped through this time, but the gate is not protecting us.

| ID | Status | Story | Notes |
|---|---|---|---|
| TD-87 | 🟡 Spike | **Restore Lighthouse a11y gating in CI — pick a path** | The 401/403 skip path handles Vercel preview auth but leaves no working enforcement path. Three forking solution paths recorded; needs a decision before implementation: (a) configure Vercel project to disable password protection on preview deployments for marketing routes (simplest, but exposes pre-merge marketing builds); (b) run Lighthouse against a Playwright-served local build inside the CI job (slower but airtight); (c) skip on auth and run a separate post-deploy job against production after the merge lands. **Spike: pick a path.** Once decided, implementation ~2 hr; verify by intentionally introducing a low-contrast element on a feature branch and confirming the workflow now fails. |

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
| TD-98 | ✅ Shipped · PR #334 | **Text overflow / truncation pass on cards** | Med severity. `apps/web/components/dashboard/MedCard.tsx:192-200`: `<span className="flex-1 …">{med.name} · {med.dose}</span>` has no `min-w-0` / `truncate`. A 60-char drug name (e.g. *"Methylphenidate hydrochloride extended-release 36 mg"*) overflows the card or pushes the Log button off-screen on 320px. The `aria-label` on the Log button also inflates. Same risk: RecipientHeader, ShiftEventCard, JournalTimeline entry titles. Apply `min-w-0 truncate` (or 2-line clamp) and add a 60+ char fixture to the relevant component test. ~2 hr. |
| TD-99 | ✅ Shipped · PR #302 | **Per-route `error.tsx` boundaries** | High severity. Only `/dashboard` and `/journal/[recipientId]` have `error.tsx` boundaries. Settings, Messages, Education, Subscriptions, Billing, Visit Summary, History Export, Team Admin all crash to the root error boundary on any render error — losing in-flight form state. Add per-route `error.tsx` with retry + "go back" affordance to all 8 missing routes. ~2 hr. |
| TD-100 | ✅ Shipped · PR #336 | **Journal timeline cursor pagination + virtualization** | Med severity. `JournalTimeline.tsx` renders all DOM nodes for the recipient — a recipient with 2000 journal entries (a year of daily logs + meds) creates a heavy DOM tree. No `react-window` / `@tanstack/virtual` / cursor on the read path. Add cursor pagination + `IntersectionObserver` "load more" with a 200-entry threshold for client-side render. ~4 hr. |
| TD-101 | ✅ Shipped · PR #333 | **RTL smoke test** | Med severity. 107 tailwind logical-direction utility usages (`ms-/me-/ps-/pe-`) — solid baseline. But: zero `dir="rtl"` test fixture, custom CSS in `globals.css` uses physical properties in spots, app-shell rail is left-anchored without an inline-start variant. Not currently a shipped concern, but if CareSync expands to Spanish-speaking caregivers (a real persona) the editorial Fraunces blocks need an RTL audit. Add an RTL smoke test that loads `/dashboard` with `dir="rtl"` and screenshots the result. ~2 hr. |
| TD-102 | ✅ Shipped · PR #329 | **`mutations.retry: 0` in TrpcProvider** | Med severity. `apps/web/components/providers/TrpcProvider.tsx:16` sets `retry: 1` globally. For idempotent reads this is fine; for the implicit retries on `useMutation` it's silent and may double-write if the request reached the server but the response was lost. Set `mutations.retry: 0` explicitly; add explicit retry buttons on the surfaces that need them (handled by TD-96). ~0.5 hr. |
| TD-103 | ✅ Shipped · PR #331 | **Debounce journal + messages search inputs** | Low severity. No debounce on the journal search/filter inputs (sampled `JournalTimeline` filter row). `useMemo` filtering 200+ entries per keystroke is OK locally but stutters on cheap Android. Wrap journal filter in 200ms debounce; same pass for `/messages` search. Pairs naturally with TD-100. ~1 hr. |
| TD-104 | ✅ Shipped · PR #330 | **`pluralize(count, singular, plural)` helper** | Low severity. Currently zero `count !== 1 ? 's' : ''` ternaries (good — already cleaner than typical) but no helper exists either, so the pattern will reappear. Add `pluralize()` helper using `Intl.PluralRules` (or a thin string fallback); migrate 5–10 sites where "1 entry" / "2 entries" is currently hardcoded. Pairs with TD-95. ~1 hr. |
| A11Y-019 | ✅ Shipped · PR #332 | **SR-only live region for offline-queue + optimistic-update transitions** | Med severity. 23 `aria-live` / `role=status` usages across the app — sounds like coverage but most are decorative. The optimistic-update path in `JournalTimeline.tsx` and the offline-queue replay flow have **no live region** to announce "logged" / "queued offline" / "synced" / "rollback" to a screen reader. Mood color+text pairing rule is already honored everywhere sampled. Add a single SR-only `aria-live="polite"` region that subscribes to offline-queue events and optimistic-update rollbacks. ~1.5 hr. |
| A11Y-020 | ✅ Shipped · PR #438 | **`/signin` "Continue with email" button text fails WCAG AA contrast** | Discovered 2026-05-10 smoke walk. The primary CTA on `/signin` renders white text on `--color-primary-light` (`#E48A4A`) → ~2.5:1 contrast, well below the 4.5:1 AA floor for body text. Other primary CTAs across the app use `--color-primary` (`#D2691E`, ~3.45:1 — still borderline) or `--color-primary-pressed` (`#9C4A14`, 5.67:1 ✓ AA). Fix: change the SignInForm submit button background to `--color-primary-pressed` OR use the `--color-primary` deeper variant with darker text. Audit the rest of the app for the same anti-pattern (any button using `--color-primary-light` as its base background with white text). Touches `apps/web/app/signin/SignInForm.tsx` + sweep. |
| A11Y-021 | ✅ Shipped · PR #446 | **Sweep 30+ white-on-`--color-primary` CTAs across app + marketing for AA contrast** | Surfaced during A11Y-020 implementation 2026-05-10. PR #438 fixed signin only; the sweep grep (`bg-[var(--color-primary)]` paired with white/cream foreground) returned 30+ sites. Categories: marketing CTAs (HeroSection, MarketingNav, PricingCards, ContactForm, ForReferrersPage, HowItWorks), in-app buttons (ShiftsPanel, settings, history-export, dashboard, care-share, HandoffSummary), badges/chips (ThreadList, AppTabBar, TimeRailTimeline, MedCard, MedicationChipBar, TagFilter, SageRail), and AI surfaces (AIPanel, AIChatThread). White-on-`#D2691E` ≈ 3.80:1 — fails 4.5:1 AA for body text but may pass large-text 3:1 floor for badges. Per-site decision: migrate body-text-sized CTAs to `--color-primary-pressed` (`#9C4A14`, ~5.04:1 ✓); keep large-text badges where they pass 3:1. ~3 hr. |
| UX-053 | 🟢 Ready (re-scoped 2026-05-09) | **Empty-state pass: every `EmptyState` has a primary action** | Low severity. **Re-scoped:** spot-check 2026-05-09 found `MedCard.tsx:250-259` empty state already has a "Add one in Medications →" link affordance; OuterCirclePanel doesn't have an obvious empty-state copy to evaluate. Re-audit needed — narrow target list to JournalTimeline empty states + the 5 components currently importing `<EmptyState>`. ~1 hr. |

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

### CareSync 2.0 design handoff (UX-054..UX-060) — opened 2026-04-30

Source: second design prototype handoff (`docs/design/caresync-2-0/`, plan at `docs/design/caresync-2-0-plan.md`). The 2026-04-23 prior handoff (UX-14..UX-21) shipped BriefHero + Fraunces typography + Patterns strip + Handoff modal — gap-audited 2026-04-30 to drop those and the marketing hero (already editorial). Net new: Sage palette behind a theme switcher (violet stays default), card-header variants, Now Board, Meds schedule + adherence, Shifts Briefing/Lanes/Now-board, Journal prompted composer + mood spectrum + heatmap, recipient profile card. Six tracks; UX-054 is foundation, UX-055 is utility, UX-056..UX-060 fan out in parallel.

| ID | Status | Story | Notes |
|---|---|---|---|
| UX-054 | ✅ Shipped · PR #320 | **Sage palette + ThemeSwitcher (data-theme="sage|hearth|slate" + dark)** | Add Sage parlor tokens (eucalyptus `#5a7a5a`, putty `#f6f4ee`, ochre, clay) and Slate alternate as additional themes; current violet kept as `hearth` and stays default. Wire `data-theme` on `<html>` and a top-right ThemeSwitcher (palette + light/dark) reading/writing `localStorage.theme`. New: `apps/web/components/theme/ThemeSwitcher.tsx`. Touches: `apps/web/app/globals.css` (additive token blocks), `apps/web/app/(app)/layout.tsx`, `apps/web/app/(marketing)/layout.tsx`. **Out of scope:** flipping default to Sage — separate decision row. ~3 hr. |
| UX-055 | ✅ Shipped · PR #321 | **Card header variants (outline / accent left-bar / serif italic title)** | Tinted header is already in `card-header-tinted` pattern; add three additional variants per the prototype: `outline` (border-only), `accent` (left-bar in `--color-primary`), `serif` (Fraunces italic title via `headline-display em`). Expose as `<CardHeaderTinted>`, `<CardHeaderOutline>`, `<CardHeaderAccent>`, `<CardHeaderSerif>` in a new `apps/web/components/ui/CardHeaderVariants.tsx`; CSS classes in `globals.css` `@layer components`. `/tdd-ship` — write component tests asserting class composition + a11y semantics first. ~2 hr. |
| UX-056 | ✅ Shipped · PR #323 | **Today "Now Board" timeline layout** | New dashboard layout variant per prototype: vertical timeline with NOW marker, mood-bordered event cards, grouped Past / Now / Up Next blocks. New: `apps/web/components/dashboard/NowBoard.tsx`. Wire toggle in `DashboardViewToggle.tsx`. Reuses existing `careEvents.timeline` tRPC query. v1 mocks the NOW marker; auto-scroll-to-now is follow-up. ~4 hr. |
| UX-057 | ✅ Shipped · PR #325 | **Meds: per-med day-strip + 7-day adherence chart** | Per the prototype, MedCard gets a 24h day-strip with dose dots positioned by scheduled time and a 7-day adherence row (taken/missed/upcoming). New: `apps/web/components/medications/MedScheduleStrip.tsx`, `apps/web/components/medications/AdherenceChart.tsx`. Touches `apps/web/components/dashboard/MedCard.tsx`. Adherence pulls from existing `care_events` where `event_type='medication'`. Pure-helper `lib/medAdherence.ts` already exists from UX-20 — extend rather than duplicate. ~5 hr. **Owner: Opus (schema-aware).** |
| UX-058 | ✅ Shipped · PR #326 | **Shifts: Briefing handoff + Lanes schedule + Team Now-board** | Three new layouts per prototype. `BriefingHandoff` renders Sleep–Meds–Schedule blocks (replaces the legacy narrative when toggled). `ShiftLanes` is per-person swim-lane timeline with a NOW marker. `TeamNowBoard` groups the team into On-now / Up-next / Later / Off. New files only; existing `ShiftCalendar.tsx` and `HandoffSummary.tsx` (modal from UX-19) remain untouched. Toggle exposed on shifts route. ~6 hr. **Owner: Opus (multiple layouts + schema).** |
| UX-059 | ✅ Shipped · PR #324 | **Journal: prompted 3-question composer + mood spectrum + calendar heatmap sidebar** | Three additive variants. `PromptedComposer` is a 3-question form (today/concern/win) replacing the textarea when "prompted" mode selected; `MoodSpectrum` is a segmented control replacing the badge picker when "spectrum" selected; `MoodHeatmap` is a 5-week calendar in the journal sidebar. New files in `apps/web/components/journal/`. Existing `JournalEntryForm.tsx` and `JournalTimeline.tsx` get a small mode toggle; everything else additive. ~5 hr. |
| UX-060 | ✅ Shipped · PR #322 | **Recipient profile card** | New `apps/web/components/app/RecipientProfile.tsx` per prototype: avatar, name, mood badge, age, conditions, primary caregivers, "About" paragraph. Reads from existing `recipients` + `identity_vault` (PHI rule: surface name through `identityRepository.resolveIdentity` only, never raw). Mounted on a new tab/section of the recipient route. ~3 hr. |

### CareSync 2.0 wiring follow-ups (UX-061..064) — opened 2026-04-30

UX-054..060 shipped the presentational primitives. These four mount them onto their real surfaces. Plan: `docs/plans/plan-c-caresync-2-0-wiring.md`.

| ID | Status | Story | Notes |
|---|---|---|---|
| UX-061 | ✅ Shipped · PR #337 | **Wire `<MedScheduleStrip>` + `<AdherenceChart>` into MedCard** | UX-057 shipped both components as pure presentational. Derive a per-day taken/expected series from `care_events` + `medication_schedules` and render the strip + chart inside `MedCard`. New: `apps/web/lib/medAdherenceFromEvents.ts` adapter. Reuse existing `lib/medAdherence.ts`. ~3 hr. **Owner: Opus (schema-aware).** |
| UX-062 | ✅ Shipped · PR #339 | **Mount Shifts BriefingHandoff + ShiftLanes + TeamNowBoard on the shifts route** | UX-058 shipped the three layouts. Add a segmented control on the shifts route (`apps/web/app/(app)/journal/[recipientId]/?panel=shifts` per the gotcha — verify) that switches among Briefing / Lanes / Now-board. Existing `ShiftCalendar.tsx` and `HandoffSummary` modal remain untouched. ~4 hr. **Owner: Opus.** |
| UX-063 | ✅ Shipped · PR #338 | **Mount `<MoodHeatmap>` into JournalLayout sidebar** | UX-059 shipped the heatmap; integration was deliberately deferred. Render in the `JournalLayout` sidebar slot, fed by the existing journal-data hook. ~2 hr. |
| UX-064 | ✅ Shipped · PR #340 | **Mount `<RecipientProfile>` on a discoverable surface** | UX-060 shipped the card. Decide IA: separate `/recipient/[id]/profile` page vs. a tab in the existing journal route. Identity values must flow through `identityRepository.resolveIdentity` server-side; never read `identity_vault` from the client. ~3 hr. **Owner: Opus (PHI-sensitive).** |

### CareSync 2.0 enrichment (UX-065..066) — opened 2026-04-30

UX-062 + UX-064 shipped the surfaces but deliberately deferred narrative + relational data. These rows close those gaps.

| ID | Status | Story | Notes |
|---|---|---|---|
| UX-065 | 🟢 Ready | **BriefingHandoff narrative adapter for the shifts route** | UX-062 shipped a Calendar/Lanes/Now toggle on `ShiftsPanel` but left BriefingHandoff out — its `{summary, sleep, meds, schedule}` lines need source narratives that don't exist yet. Build a server-side adapter (`lib/handoffNarrative.ts` or extend `lib/handoffSummary.ts`) that turns the prior shift's care_events into 3 one-line summaries (sleep severity from sleep events, meds from medication events with given/missed counts, schedule from upcoming appointments + PT). Add Briefing as the 4th tab in `ShiftsPanel`. The existing "What did I miss?" modal (UX-19) covers the same surface but is modal-only — Briefing is the in-page toggle variant. ~4 hr. **Owner: Opus (schema + summarization).** |
| UX-066 | 🧊 Deferred · superseded by UX-103/104/105 | **RecipientProfile enrichment — mood / caregivers / About** | Filed 2026-04-30 as a single 5-hr row. UX-103 (CareTeamList adapter), UX-104 (likes/dislikes schema), UX-105 (emergency info schema) split the same surface into 3 implementable rows on 2026-05-01 — those are now the canonical work items. Strike here once a successor row ships. |

### CareSync handoff (frozen design, UX-077 follow-up) — opened 2026-05-01

Source: `docs/caresync-handoff/` (clickable React+Babel design prototype, frozen via constants in `app.jsx`'s `DESIGN` object). Plan: `docs/design/caresync-handoff-plan.md`. 28 stories shipped on 2026-05-01 (PRs #349..#365); see §7. UX-077 below is the only remaining row — deferred pending product decision.

| ID | Status | Story | Notes |
|---|---|---|---|
| UX-077 | 🟢 Ready | **Today route default flip — TimeRailTimeline as default, NowBoard behind `?layout=board`** | Deferred during 2026-05-01 PM session: there is no separate Today route — the dashboard already has a 3-way `DashboardViewToggle` (single / stacked / now). Flipping the default to TimeRailTimeline (or adding it as a 4th option) needs a product decision on whether the timeline view should replace one of the existing three or live alongside. The presentational components (`TimeRailTimeline`, `TimelineFilterChips`) shipped in #361 and are ready to wire once direction is decided. |

### CareSync handoff follow-ups (UX-095..UX-106) — opened 2026-05-01 PM

After the 28-story handoff session shipped (#349..#365), an honest audit revealed several presentational components are built + tested but not yet visible to users — they're orphaned (never mounted) or mounted with empty states pending data plumbing. These rows close those gaps. Plan: `docs/design/caresync-handoff-followups-plan.md`. Three waves: (8) Brief surface mount + adapters — no schema. (9) Shifts data — 2 of 3 need migrations. (10) Profile data — 2 of 3 need migrations. (11) UX-077 + default-flip decisions.

| ID | Status | Story | Notes |
|---|---|---|---|
| UX-095 | ✅ Shipped · PR #368 | **Brief surface mount** | Mounted SleepSparkline + ComingUpRows + ShiftQuoteNote + OnShiftSidebar + PatternCard into DashboardClient. |
| UX-096 | ✅ Shipped · PR #370 | **sleepFromEvents adapter** | Pure helper deriving 7-night sleep buckets from `care_events`. |
| UX-097 | ✅ Shipped · PR #369 | **comingUpEvents adapter** | Next ≤5 scheduled events helper for `<ComingUpRows>`. |
| UX-098 | ✅ Shipped · PR #369 | **deriveOnShift adapter** | Current/next caregiver + latest mood join helper. |
| UX-099 | ✅ Shipped · PR #370 | **detectPattern helper** | Threshold-driven 7d pattern signal for `<PatternCard>`. |
| UX-100 | ✅ Shipped · PR #374 | **ShiftWeekGrid blocks adapter** | `buildShiftWeekGridBlocks` helper + ShiftsPanel "Week" tab wire. |
| UX-101 | ✅ Shipped · PRs #375/376/377 | **Shift narrative-handoff schema + tRPC + dashboard mount** | Split into 3a (migration + pgTAP + types), 3b (upsertHandoff/getLatestHandoff + ShiftsPanel wire), 3c (ShiftQuoteNote on dashboard). |
| UX-102 | ✅ Shipped · PRs #378/379 | **shift_questions schema + tRPC + Questions tab wire** | Split into 4a (table + RLS + immutability trigger + 15 pgTAP tests) and 4b (list/create/resolve tRPC + composer + resolve flow in ShiftsPanel). |
| UX-103 | 🟢 Ready | **CareTeamList adapter on profile route — query memberships + display_names** | Server-side query in `recipient/[recipientId]/profile/page.tsx`: list memberships for the recipient's org, resolve display_names via `identityRepository`, derive role labels, pass to `<CareTeamList>`. Phone numbers deferred until a profile-edit story adds them. **No schema (uses existing tables).** ~3 hr. **Owner: Opus (PHI-sensitive identity resolution).** |
| UX-104 | 🟢 Ready | **Recipient likes/dislikes schema + edit affordance** | Migration: add `likes text[]` + `dislikes text[]` to `care_recipients` (or a new `recipient_profile` row table). Coordinator-only edit affordance (small inline composer on the profile page). Wire `<LikesDislikesList>` to read these. **Schema work — pgTAP coverage required.** ~5 hr. **Owner: Opus (schema + RLS).** Pairs with UX-066 (RecipientProfile enrichment). |
| UX-105 | 🟢 Ready | **Emergency info schema + edit affordance** | Migration: add `dnr_status text`, `emergency_contact jsonb` (name + relationship + phone), `hospital_preference text` to `care_recipients`. Coordinator-only edit affordance. Wire `<EmergencyFooterCard>` to read these via `identityRepository` (PHI sensitive). **Schema work + PHI — pgTAP coverage required.** ~6 hr. **Owner: Opus (schema + RLS + PHI).** |
| UX-106 | 🧑 Needs human | **Decision: flip default app shell to SageRail** | UX-068c shipped SageRail + SageTopBar behind `?shell=sage` opt-in. Decide whether to (a) flip the default and demote AppTabBar to legacy, (b) keep opt-in until further user testing, or (c) ship SageRail as the desktop chrome and keep AppTabBar mobile-only. ~1 hr exec once decided. |

### CI regression — opened 2026-04-30

| ID | Status | Story | Notes |
|---|---|---|---|
| TD-106 | ✅ Shipped · PR #343 | **Fix `e2e/export.spec.ts:81` — toast text drift after TD-96** | TD-96 (PR #306) standardized mutation-error toasts and changed `ExportButton`'s catch-block toast from `"Export failed. Please try again."` to `"The export didn't finish. Try again, or pick a smaller date range."`. The Playwright spec at `e2e/export.spec.ts:99-100` still asserts the old text → "export error message shown when API returns non-OK" fails on every PR with `Error: element(s) not found / Locator: getByText('Export failed. Please try again.')`. Mergify lets PRs through despite the failure, but the regression net is permanently red and any *new* export regression would now go undetected. Fix: update the spec's locator to match the current sonner toast (`"The export didn't finish."` or a tighter regex). Also worth checking for other catch-block toasts whose copy was rewritten by TD-96 and whose tests weren't updated. ~0.5 hr. |

### Tier 1/2 server testing sweep — Plan A (TD-77..82, TD-87)

Existing rows above. Plan: `docs/plans/plan-a-tier12-tests.md`. Six file-disjoint test files + one CI workflow tweak.

### Web hardening sweep — Plan B (TD-98, TD-100..104, A11Y-019)

Existing rows above. Plan: `docs/plans/plan-b-web-hardening.md`. Seven mostly-disjoint hardening tracks across truncation, pagination, RTL, retry config, debounce, pluralize, SR-only live region.

### Roadmap features (ON-64..68) — opened 2026-04-25

From `docs/project-info/product/ROADMAP.md` Phases 3–5. Greenlit 2026-04-25 to add to Ready queue. Sequencing rationale per ROADMAP.md §"Feature sequencing rationale".

| ID | Status | Story | Notes |
|---|---|---|---|

### Roadmap-promised features missing from BACKLOG (ON-70..74) — opened 2026-05-09

Surfaced by the 2026-05-09 audit (`docs/audits/2026-05-09-roadmap-and-harness-audit.md` §H): ROADMAP promises these features but no Ready row tracked them. Filed so they don't silently slip out of scope.

| ID | Status | Story | Notes |
|---|---|---|---|
| ON-70 | 🟢 Ready | **Coverage request board (`coverage_windows` table + claim flow + gap detector)** | Per ROADMAP Phase 2. New `coverage_windows` table separate from `shifts` — gap detection runs on coverage_windows, not shifts (decouples "what we scheduled" from "what was actually covered"). Coverage request flow: caregiver posts when can't make a shift; team members see it and can claim; gap detector alerts coordinator on uncovered windows. **Schema work + RLS — pgTAP coverage required.** ~5 days. |
| ON-71 | 🟢 Ready | **Refill alerts Inngest job (`supply_days_remaining ≤ 7` nightly)** | Per ROADMAP Phase 3. Nightly Inngest job that finds medications with `supply_days_remaining <= 7` and sends alert to coordinator + assigned caregiver with pharmacy contact pre-populated. Idempotency key: `refill:{medication_id}:{week_stamp}`. Pairs with the existing weekly digest cron infra. ~2 days. |
| ON-72 | 🧊 Deferred | **Prescription label scanning OCR pipeline** | Per ROADMAP Phase 3. Mobile camera → Apple Vision/Google ML Kit OCR → LLM parse → `ocr_jobs` status: needs_review → caregiver confirms → medication created. Never auto-creates without human confirmation. **Blocked by:** stable medication catalog (Phase 3 prereq before OCR makes sense). |
| ON-73 | 🧊 Deferred | **Burnout tracker** | Per ROADMAP Phase 4. Weekly check-in: how are YOU doing? Sleep, stress, support. If scores trend bad, surface respite resources. **Blocked by:** roadmap rationale says "needs 2-3 mo of data to show meaningful trends" — defer until families have that history. |
| ON-74 | 🟢 Ready | **Full history export (PDF / structured)** | Per ROADMAP Phase 4. Every journal entry, medication log, shift record, symptom reading. Formatted for a doctor or new care facility. Trust feature: families who can export everything are more likely to put everything in. ~3 days. **Pairs with /visit-summary work (UX-20) — share components.** |

### Audit-remediation follow-ups (TD-111) — opened 2026-05-09 PM

| ID | Status | Story | Notes |
|---|---|---|---|
| TD-111 | 🟢 Ready | **Skill dedup phase 2 — triage 13 divergent project skills against globals** | C.3 phase 1 (PR #394) deleted the 5 byte-identical project-skill shadows. 13 remain divergent: `backlog-dispatch` (40 vs 115), `backlog-sync` (72 vs 71), `dispatch` (148 vs 163), `live-test` (299 vs 135), `ollama` (184 vs 186), `plan-with-tests` (67 vs 107), `schema-dump` (100 vs 109), `session-end` (46 vs 46), `ship-story` (88 vs 90), `supabase-types` (43 vs 47), `tdd-ship` (95 vs 128), `test-gaps` (38 vs 47). Per-skill judgment: identical-after-format → delete project; project encodes carelog-specifics → rename to `<name>-carelog` so it doesn't shadow; project is genuinely better → promote to global, delete project. ~2 hr. |
| TD-112 | ✅ Shipped · 2026-05-09 | **`/backlog-sync` skill: stale-Ready detector** | Surfaced 2026-05-09: TD-78..82 sat as `🟢 Ready` for ~weeks despite the 5 referenced "New file: …" paths already existing on main from PRs #248–#258. The current skill walks `git log` for un-shipped commits but never cross-checks that Ready-row file references still represent missing work. Wave 13-B preflight caught it; the skill should have. **Add a step:** for each `🟢 Ready` row, grep the row text for `New file:\s*\`([^`]+)\`` patterns; if the path exists on disk, surface as `STALE_READY` candidate in the report (do not auto-flip — fall through to human or follow-up sync to confirm scope match). Also extend to `apps/web/.../path.ts` mentions inside the row body. Implementation lives at `~/.claude/skills/backlog-sync/SKILL.md` (user-level skill). ~30 min. |
| TD-113 | ✅ Shipped | **Tests for `careEventCommentsRepository.ts` (Tier 1 — PHI-adjacent)** | Comment threads on care events are caregiver narrative. No direct repository test. New file: `apps/web/server/repositories/__tests__/careEventCommentsRepository.test.ts`. Test: (a) cross-org boundary on `listForEvent`, (b) author-id stamping on `add`, (c) `update` rejects callers who didn't author, (d) `softDelete` flips visibility but preserves audit. ~1.5 hr. Surfaced by `docs/audits/2026-05-10-state-and-gaps.md` §3. |
| TD-114 | ✅ Shipped · PR #418 | **Tests for `medicationTaggingRepository.ts` CRUD (Tier 2)** | `medicationTagging.precision.test.ts` covers the matching algorithm only. The repository CRUD path (insert tag, remove tag, list-by-event) has no direct coverage. New file: `apps/web/server/repositories/__tests__/medicationTaggingRepository.test.ts`. ~1 hr. Surfaced by `docs/audits/2026-05-10-state-and-gaps.md` §3. |
| TD-115 | ✅ Shipped | **Tests for `shiftTradeRequestsRepository.ts` (Tier 2 — auth-adjacent state machine)** | Shift-trade flow has multiple state transitions (pending → claimed → approved/declined). RLS fences DB; the helper layer needs tests for who can transition which state. New file: `apps/web/server/repositories/__tests__/shiftTradeRequestsRepository.test.ts`. Cover: (a) coordinator-only approve, (b) claim is open to any team member with recipient access, (c) double-claim race surfaces a clear error. ~1.5 hr. Surfaced by `docs/audits/2026-05-10-state-and-gaps.md` §3. |
| TD-116 | ✅ Shipped | **Tests for `routers/moodEntries.ts` (Tier 1 — PHI write path)** | Mood logging tRPC router. No direct router test. New file: `apps/web/server/routers/__tests__/moodEntries.test.ts`. Cover: (a) auth boundary (`ctx.user = null` → 401), (b) `create` validates org/recipient membership, (c) `list` cross-recipient isolation, (d) timestamp validation rejects future dates. ~1.5 hr. Surfaced by `docs/audits/2026-05-10-state-and-gaps.md` §3. |
| TD-117 | ✅ Shipped · PR #433 + #436 | **Automated PHI-invariant test for analytics call sites** | Discovered 2026-05-10 PostHog usage assessment. The PHI rule (`posthog.identify()` and `posthog.capture()` use UUID only — never email, name, phone, dob, ssn) is currently enforced ONLY by inline `// PHI` comments + reviewer eyeballs. 37 call sites across 20 files; one slip ships a P0 leak. Need automated enforcement: either (a) custom ESLint rule that AST-walks `posthog.identify(...)`, `posthog.capture(...)`, `Sentry.setUser(...)`, `Sentry.setContext(...)` calls and fails the lint gate if any property key matches `/^(email\|name\|phone\|dob\|ssn\|first_name\|last_name\|full_name\|address\|zip\|street\|city)$/i`, OR (b) vitest test that grep-walks the same call sites and asserts properties shape against an explicit allowlist. Approach (a) is preferred — runs on Edit hook + CI lint, catches PRs at write-time not test-time. ADR-0001 codifies the rule; this is its enforcement. |
| TD-118 | ✅ Shipped · PR #442 | **Defense-in-depth: detect misconfigured `SUPABASE_SERVICE_ROLE_KEY` and surface a clearer error than the RLS message** | Discovered 2026-05-10 smoke walk. When `SUPABASE_SERVICE_ROLE_KEY` is missing, expired, or in the wrong format (e.g., `sb_secret_*` production-style key dropped into a local dev env), `supabaseAdmin` silently falls back to the anon role. The first server-side write — typically `POST /api/onboarding/create` — then 500s with `Org creation failed: new row violates row-level security policy for table "organizations"`. This is what users (and devs) see; it points at RLS instead of the real cause (env config). Two-part fix: (1) at server boot, validate the JWT is decodable and its `role` claim is `service_role`; if not, log a CRITICAL warning and refuse to start. (2) when `supabaseAdmin` operations fail with an RLS-class error, wrap in a clearer error: "Supabase admin client is not authenticated as service_role — check SUPABASE_SERVICE_ROLE_KEY env." Pairs with `docs/project-info/runbooks/SECRETS_ROTATION.md` Part 2 ("local Supabase JWT process"). ~1 hr. |
| TD-119 | ✅ Shipped · PR #447 + #448 | **Wire `wrapAdminError()` into existing `supabaseAdmin` write call sites** | Surfaced during TD-118 implementation 2026-05-10. PR #442 introduced `wrapAdminError()` (in `apps/web/server/supabaseAdmin.server.ts`) but only documented it as opt-in — the existing 30+ admin write sites still throw the raw PostgrestError. Sweep `grep -rn "supabaseAdmin" apps/web/server apps/web/app/api` and migrate any site that does `if (error) throw error` to `if (error) throw wrapAdminError(error)`. Routers in scope: `memberships`, `shiftTradeRequests`, `historyExport`, `notifications`, `benefits`, `outerCircle`, `burnout`, plus API route handlers. Pure mechanical refactor — no behavior change for the happy path. ~1.5 hr. |
| TD-120 | 🟢 Ready · **P2** | **Defense-in-depth refactor of `getCareTeamForRecipient` — switch to session-scoped supabase + RLS gate** | Surfaced 2026-05-10 by Sonnet adversarial gate on PR #451. `getCareTeamForRecipient(orgId, recipientId)` in `apps/web/server/repositories/membershipsRepository.ts` queries `memberships` via `supabaseAdmin` (service role) — no second-line auth check inside the function. Currently safe because the only caller (recipient profile page) gates on an RLS-scoped `care_recipients` SELECT first, but any future caller that skips the gate would leak member identities cross-org. UX-104's PR #452 already adopted the right pattern (session-scoped supabase client param + RLS as the gate). Refactor `getCareTeamForRecipient` to take a `supabase: SupabaseClient` param and use it for the memberships query; keep `supabaseAdmin` only for the per-member `auth.admin.getUserById` resolution. Update the page caller to pass `supabase`. ~30 min. |
| TD-121 | 🟢 Ready · **P3** | **Cap N+1 / DoS surface in `getCareTeamForRecipient`** | Surfaced 2026-05-10 by Sonnet adversarial gate on PR #451. `getCareTeamForRecipient` does `Promise.all` over memberships, calling `supabaseAdmin.auth.admin.getUserById` per member. Supabase Auth Admin API rate-limits at 50 req/s per project. An org with 30+ members + 2 concurrent profile loads could trip the limit. Fix: add `.limit(50)` to the memberships query in `apps/web/server/repositories/membershipsRepository.ts`; consider `Promise.allSettled` so a single Auth API blip doesn't 500 the page; longer-term, extend the `display_names` cache pattern to members (or carry display_name in `user_metadata` write-time). ~20 min for the cap; ~2 hr for the cache. |
| TD-122 | 🟢 Ready · **P4** | **Restructure `makeListChain` mock in membershipsRepository.test to not depend on `.not()` call count** | Surfaced 2026-05-10 by Sonnet adversarial gate on PR #451. The mock at `apps/web/server/repositories/__tests__/membershipsRepository.test.ts:163-166` counts `.not()` invocations and resolves on the second — fragile against query refactors. Adding a third `.not()` filter (e.g. soft-delete column) would silently stall the mock. Restructure so the mock returns the result on any `.not()` and assert filter contracts separately. ~15 min. |
| UX-103b | 🟢 Ready · **P3** | **Edit affordance for CareTeamList on recipient profile** | Follow-up to UX-103 (PR #451). The CareTeamList shell now displays real members but is read-only. Add: invite-new-member button + remove-member action (coordinator-only). Sequenced after UX-103 ships. Touches `apps/web/components/app/CareTeamList.tsx` + new tRPC `memberships.invite`/`memberships.remove` (or extend existing). ~1.5 hr. |
| UX-104b | 🟢 Ready · **P3** | **Edit affordance for LikesDislikesList on recipient profile** | Follow-up to UX-104 (PR #452). Add inline edit for the likes/dislikes lists on the recipient profile, writing back to `care_recipients.preferences jsonb`. Touches `apps/web/components/app/LikesDislikesList.tsx` (add edit mode) + new tRPC `recipients.updatePreferences`. PHI: not applicable — preferences are not identity-bound. ~1 hr. |
| UX-105b | 🟢 Ready · **P3** | **Edit affordance for EmergencyFooterCard on recipient profile** | Follow-up to UX-105 (PR #453). Add edit mode for DNR status, primary contact (name/relationship/phone), and hospital. Writes back to `identity_vault.contact_info jsonb`. **PHI**: name + phone are PHI per ADR-0001 — write path must go through service role with the same membership gate the read path uses. Touches `apps/web/components/app/EmergencyFooterCard.tsx` (add edit mode) + new repository function `updateEmergencyInfo` + tRPC procedure. ~1.5 hr. |
| TD-123 | 🟢 Ready · **P2** | **Stop Vercel preview from blocking auto-merge when the hosted-account deploy rate limit fires** | Surfaced 2026-05-10 PM. Hit twice in one evening: PR #453 (UX-105) and PR #431 (SECRETS_ROTATION runbook) both BLOCKED on `Vercel — Deployment rate limited — retry in 24 hours`. Hobby tier caps preview deploys per 24h window; a busy session blows through it and every subsequent PR fails the required `Vercel` check. Workarounds today were admin-merge bypass (manual). We still want preview deploys for visual diffs — just not on every backend/test PR, and not as a hard gate. Design space (planner picks): (a) **conditional preview** — wire a GitHub Actions filter so Vercel only deploys when the diff touches `apps/web/app/**`, `apps/web/components/**`, or `public/**`; backend/test/docs PRs skip Vercel entirely; (b) **demote required check** — make Vercel non-required in branch protection so a failed deploy is informational, not blocking; (c) **scheduled preview** — drop per-PR Vercel; deploy `main` to a staging URL on a daily cron + on push for visual regression review; (d) **upgrade to Vercel Pro** (~$20/mo, removes the rate limit but adds recurring cost — ADR consideration vs the bootstrap budget). Recommend (a) + (b) together: most PRs skip the deploy entirely, and the ones that DO touch UI no longer block on hosted-account billing flakes. ~1-2 hr to wire + verify. **Note 2026-05-10 PM-3**: part (a) shipped via PR #456; part (b) is a no-op — branch-protection inspection showed Vercel is NOT in `required_status_checks` (the BLOCKED state was driven by `needs-phi-review` label, see TD-127). |
| TD-124 | ✅ Shipped · PR #458 | **Extend `supabase/seed.sql` to create a working coordinator + recipient + memberships row** | Shipped 2026-05-10 PM-4. Three layers of breakage: (1) `supabase/config.toml` had `db.seed.enabled = false`; (2) `ON CONFLICT (email)` on `auth.users` was invalid (no unique constraint on email); (3) `ON CONFLICT (org_id, user_id, recipient_id)` on memberships was rejected because user_id is nullable in the unique index. Rewrote seed end-to-end: identity_vault first then RETURNING token, accepted_at on memberships, SELECT-or-INSERT for auth.users, dropped ON CONFLICT on memberships, EXCEPTION WHEN others THEN RAISE. |
| TD-125 | ✅ Shipped · PR #459 | **Silence Sentry 429s in local dev** | Shipped 2026-05-10 PM-4. Added `enabled: process.env.NODE_ENV === "production" \|\| process.env.SENTRY_FORCE_ENABLED === "true"` to all 3 Sentry config files (client/server/edge). `Sentry.init` still called so instrumentation references (`captureRequestError`, `captureRouterTransitionStart`) wire correctly. |
| TD-126 | 🧊 Deferred · 2026-05-10 PM-4 | **`priority` prop on the marketing landing hero image (LCP fix)** | **Deferred — premise wrong.** Investigation 2026-05-10 PM-4 (chrome-devtools performance trace): `HeroSection` is text-only (no `<Image>`); `hero-4.png` lives in `HowItWorks` below the fold. Adding `priority` to it would actively hurt LCP. Local LCP measured at **132ms** (well under the 2.5s "good" threshold), CLS 0.00, no render-blocking. The original Next.js console warning that triggered this row was a stale dev-time hint that no longer reflects current page structure. If a real LCP regression surfaces in production CrUX data, file a sharpened follow-up against the actual LCP element (likely the `headline-display` h1 + Fraunces variable font preload), not against `hero-4.png`. |
| TD-127 | ✅ Shipped · PR #460 | **Document `needs-phi-review` label removal protocol — or auto-validate** | Shipped 2026-05-10 PM-4. Path (a) chosen — wrote `docs/adr/0003-phi-review-label-protocol.md` codifying two paths: Path A (human review + scope comment + label removal) and Path B (orchestrator self-clear, narrow exception when diff touches none of analytics SDKs / identity_vault / PHI-class migrations). Self-clear forbidden when any subagent on the wave touched files in those categories. Future enhancement (b) AST-walk auto-validate left for follow-up. |
| UX-107 (triage) | ✅ Shipped · 2026-05-10 | **Visit recorder UI status triage** | Decision: schema-ahead-of-UI **by design** per PR #348 ("First slice of the Phase 4 visit recorder. Lands the storage contract so follow-up rows can wire mobile recording, the Inngest Whisper → Claude pipeline, and the web playback/edit surface"). Outcome: kept the migration on main; updated `ON-55` §5 row to reflect the actual shipped/remaining split (data-model done, UI deferred); fixed ROADMAP Phase 4 visit-recorder paragraph (was "TBD" → now documents the schema-ahead-of-UI design + ON-55 link). No new ON-NN row needed; ON-55 already covers the UI surface. Note: this row collided with the shipped sign-in-voice UX-107 (line 129); ID reused unintentionally. |

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
| LAUNCH-004 | ✅ Shipped · runbook | **Observability hardening** | All four sub-items closed: TD-73 rate-limit dashboard (PR #227), TD-74 digest delivery monitor (#227), TD-75 E2E green-streak gate (#227), Sentry SDK + source-maps plugin wired (PR #309 + earlier). 319-line runbook at `docs/project-info/runbooks/OBSERVABILITY.md`. The remaining `SENTRY_AUTH_TOKEN` env var is human-gated and tracked separately as TD-03. |
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

### OOP wave A adversarial-gate follow-ups (TD-129/130) — opened 2026-05-14

Source: Sonnet adversarial gates flagged two must-fixes on the OOP wave A PRs that did not land before `gh pr merge --auto --squash` fired. Both are narrow, single-file fixes with verifiable acceptance.

| ID | Status | Story | Notes |
|---|---|---|---|
| TD-129 | 🟢 Ready | **OOP-001 pgTAP — add `SET LOCAL ROLE service_role` test discipline** | PR #469 merged the `invite_tokens` pgTAP suite without asserting `service_role` can `EXECUTE consume_invite_token` and that grants are enforced. Defense-in-depth gap flagged by the Sonnet adversarial gate. Owned file: `supabase/tests/invite_tokens_rls.test.sql`. **Acceptance:** test wraps role-switch (`SET LOCAL ROLE service_role`) around the `consume_invite_token` execution path and asserts grant enforcement; `supabase test db` green. **Risk:** LOW. **Size:** S (~1h). |
| TD-130 | 🟢 Ready | **PDF export — restore `typeof string` narrowing on `payload.text`** | PR #470 merged the `CareEvent` union refactor with `apps/web/app/api/history/export/pdf/route.tsx` using `"text" in ev.payload && String(ev.payload.text \|\| "").length > 0`, which now renders non-string `payload.text` values (numbers, objects) by stringifying them — a behavior change vs. the pre-refactor `typeof payload.text === "string"` check. Flagged by the Sonnet adversarial gate as a semantic must-fix. Owned file: `apps/web/app/api/history/export/pdf/route.tsx`. **Acceptance:** route guards with `typeof === "string"` + length check, matching prior behavior; PDF export e2e/unit coverage green. **Risk:** LOW. **Size:** XS (~15min). |

---

### OOP refactor (OOP-*) — opened 2026-05-14

Source: `/oop` Phase 1 + Phase 2 audit. Plan doc: `docs/plans/2026-05-14-oop-refactor.md`. Fragments in `.claude/state/oop-phase{1,2}-{web,mobile,supabase,cross}.md`. **Invariant-preserving** — no external behavior changes. Suggested sprint sequencing in the plan doc §"Recommended sprint order".

| ID | Status | Story | Notes |
|---|---|---|---|
| OOP-001 | ✅ Shipped · PR #469 | **pgTAP for `invite_tokens` atomicity + expiry** | Promoted to §7 2026-05-14. |
| OOP-002 | ✅ Shipped · PR #468 | **Enable RLS + pgTAP on `journal_reactions`** | Promoted to §7 2026-05-14. |
| OOP-003 | 🧊 Struck (2026-05-14) | **pgTAP for messaging triad — `message_threads`, `message_thread_members`, `messages`** | Verified 2026-05-14 re-audit: `supabase/tests/messaging_rls.test.sql` already exists on main with `select plan(12)` and 13 assertion lines. Coverage is not zero. Original premise false; strike the row. |
| OOP-004 | ✅ Shipped · PR #475 | **OCR job state machine + row-level lock** | Promoted to §7 2026-05-14. |
| OOP-005 | ✅ Shipped · PR #470 | **`CareEvent` payload discriminated union + type guards** | Promoted to §7 2026-05-14. Follow-up: TD-130. |
| OOP-006 | ✅ Shipped · PR #476 | **Brief headline classifier → strategy chain** | Promoted to §7 2026-05-14. |
| OOP-007 | 🧊 Struck (2026-05-14) | **RLS helper `is_org_coordinator(uuid)` to dedupe ~23 inline checks** | Verified 2026-05-14 re-audit: `grep -rEc "EXISTS\(\s*SELECT.*FROM\s+(public\.)?memberships" supabase/migrations/` returns **0**. Helper `user_is_org_coordinator()` already defined at `supabase/migrations/20260327234330_core_schema.sql:344` and consumed by policies in core_schema.sql + shifts_schema_align.sql. Original premise false; strike the row. |
| OOP-008 | ✅ Shipped · PR #474 | **`care_briefs.recipient_id` immutability trigger** | Promoted to §7 2026-05-14 (narrowed per re-audit; `visit_recordings` already had its trigger). |
| OOP-009 | ✅ Shipped · PR #481 | **Mobile `Offline Queue` mutation routing via `PayloadMutator`** | Promoted to §7 2026-05-14. |
| OOP-010 | ✅ Shipped · PR #479 | **Mobile `SecureStore` key registry** | Promoted to §7 2026-05-14. |
| OOP-011 | ✅ Shipped · PR #480 | **Mobile tRPC `useMutationWithRefresh` composable** | Promoted to §7 2026-05-14. 6 of 7 named screens refactored; `schedule/index.tsx` honestly skipped as fully-divergent. |
| OOP-012 | ✅ Shipped · PR #478 | **`HandoffSummary` name hydration via `NameResolver` injection** | Promoted to §7 2026-05-14. |
| OOP-013 | ✅ Shipped · PR #482 | **Mobile push notification `NotificationRouter` registry** | Promoted to §7 2026-05-14. |
| OOP-014 | ✅ Shipped · PR #483 | **Mobile `useSyncStatus` singleton + AppState-aware polling** | Promoted to §7 2026-05-14. |
| OOP-015 | ✅ Shipped · PR #477 (PR1 only) | **Stripe webhook switch → handler-per-event map** | Promoted to §7 2026-05-14. PR1 (handler-map refactor) merged; PR2 (Sentry routing swap, behavior-changing) deferred — captured as a TD-* candidate during /closeout. |

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
**Status:** 🧊 Deferred (UI surface; data-model first slice shipped 2026-05-01 in PR #348)
**Why:** Audio note at a doctor visit → Whisper transcription → Claude structured extraction → `care_event` tagged to the appointment. Roadmap classifies this under Phase 4 (depth + retention).
**Shipped already (PR #348):** `visit_recordings` table + `visit_recording_status` enum + `'visit_note'` entry_type + RLS via `user_can_access_recipient()` + pgTAP regression net.
**Work remaining:** **(a) server** — tRPC router (`visitRecordings.create/list/confirm`); **(b) pipeline** — Inngest function (Whisper → Claude structured extraction → `care_event` insert); **(c) mobile** — `expo-av` recording + Supabase Storage upload; **(d) web** — playback + structured-fields review screen.
**Blocked by:** Phase 1–6 features fully stable; sufficient data volume to validate the use case (per #348's deferral criteria).

### ON-69 — Visit recorder (struck 2026-05-09 — duplicate of ON-55)
**Status:** 🧊 Deferred · duplicate of ON-55
**Note:** ON-55 covers the same Visit Recorder Phase 7 scope. Keeping ON-55 (lower ID).

### ON-56 — Data stewardship commitment page · ~0.5 day
**Status:** ✅ Shipped · PR #102
**Why:** PRODUCT_STRATEGY.md says "publish before first paying users." Builds trust with a population burned by CareZone's shutdown. Commitment: 12 months notice before shutdown, full data export always available, data never sold, no ads ever.
**Work:** New marketing page at `/trust`. Link from footer + signup flow. Plain language, no legalese. ~0.5 day.
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
| UX-035 | 🧊 Struck (2026-05-09) | **Gate `BriefHero` mock content behind feature flag or skeleton** | Verified 2026-05-09: `apps/web/components/dashboard/BriefHero.tsx` is now wired to `trpc.briefs.dashboardSummary` and `trpc.briefs.latestForRecipient` — no hardcoded mock content, no `TODO(UX-24+)` comment remains. Wave 9 (`BriefSection` mount + adapters) closed this gap. Strike the row. |
| UX-036 | ✅ Shipped · PR #224 | **Move `CommentItem`/`CommentThread` dark-mode overrides to `globals.css` tokens** | No `dark:bg-gray-*` matches remain in CommentItem/CommentThread. |
| UX-041 | ✅ Shipped · PR #507 | **Journal cards: surface author identity** | See §7 entry "2026-05-15 — Journal & meds quick-win trio". |
| UX-042 | ✅ Shipped · PR #505 | **Journal top bar: show recipient name not org name** | See §7 entry "2026-05-15 — Journal & meds quick-win trio". |
| UX-043 | ✅ Shipped · PR #506 | **`MedicationChecklist`: format scheduled times + design tokens** | See §7 entry "2026-05-15 — Journal & meds quick-win trio". |
| UX-044 | 🟢 Ready | **Wire or remove the broken "Leave organization" button in Settings** | `/impeccable critique` 2026-04-29: `apps/web/app/(app)/settings/page.tsx:613–623` shows a confirmation modal that resolves to a toast saying "go to Team panel and leave from there." A user who came to Settings to leave a team gets visual friction with no real action. This is worse than no button. Either implement the API call or remove the button entirely (replace with a small note + link to `/team/admin`). Trust-eroding placebo button is the worst case. |
| UX-046 | 🟡 Spike | **Clinician-readable share surface — does PRODUCT.md's promise have a route?** | `/impeccable critique` 2026-04-29 surfaced a category gap: PRODUCT.md says "a doctor's appointment starts with a real summary." `/care/[shareToken]` is the outer-circle volunteer-claim form (meals, errands), not a clinician share. `/visit-summary` is gated behind authentication and produces a print-only artifact the caregiver must physically deliver. The "real summary for the doctor" promise has no shipped surface. Spike: investigate whether (a) `visit-summary` should also produce a time-limited token URL the caregiver emails to the doctor, (b) a new `/clinician/[shareToken]` route is warranted, or (c) the existing `/brief/[shareToken]` flow already serves the use case if briefs default to clinician-friendly content. Founder/PM decision before any code. |
| UX-048 | 🟢 Ready | **Empty states polish** | `/impeccable clarify` 2026-04-29 audit found generic-SaaS empty-state copy across journal, medications, team, and dashboard surfaces ("No items", "No projects yet", "Get started"). Replace with PRODUCT.md-aligned warm·candid copy that names the subject + offers a next action ("No journal entries yet. Log how today went."). See `apps/web/copy-audit.md` §3 for the full list. |
| UX-049 | 🟢 Ready | **Auth + onboarding voice pass** | `/impeccable clarify` 2026-04-29 audit found tone mismatches in the auth flow: `SignInForm.tsx:115` button reads "Sign in" on what is actually a 6-digit OTP verify step ("Verify code" / "Verifying..." is correct). Onboarding has 3 different error strings, only 1 well-pitched. Auth callback / invite-load errors lack remediation. Sweep the 8 auth-surface findings in `apps/web/copy-audit.md` §2 and the onboarding findings in §1 Medium. |
| UX-050 | 🟢 Ready | **Journal mood + entry-form copy** | `/impeccable clarify` 2026-04-29 audit found tone risks in the journal — the surface where stakes are highest (PRODUCT.md: "the recipient is a person, not a chart"). Sweep mood-label copy, ShiftForm field labels, and the "Share update" button on what is actually a private journal post. See `apps/web/copy-audit.md` §4 for the full list. |
| UX-051 | 🧊 Deferred (2026-05-09) | **Legacy `care-log.org` → `caresync.app` cleanup** | Deferred 2026-05-09: `hello@caresync.app` and `privacy@caresync.app` are not yet provisioned (DNS + inbox). Replacing displayed addresses now would ship broken support links to paying users. Re-visit once DNS lands. Audit findings preserved: `apps/web/app/(app)/subscriptions/page.tsx:188`, `team/admin/TeamAdminClient.tsx:159`, plus marketing surfaces (privacy/terms/contact pages). Resend `from:` in `app/api/contact/route.ts` is also affected — separate Resend domain-verification step. |

---

## 7. Shipped (compact log)

### 2026-05-15 — Journal & meds quick-win trio (UX-041/042/043) — PRs #505/#506/#507
Sprint `journal-meds-quick-wins` (`/sprint` full pipeline) shipped three small, file-disjoint, user-facing fixes to journal + medication surfaces via direct-implementation wave (single orchestrator session, no parallel-dispatch). Opus adversarial gate was degraded for the planning phase (`/opus-on-opus` 529s); fell back to Sonnet reviewer per CLAUDE.md Opus-fallback rule across 3 review cycles (Must-fix: 2 → 1 → 0). Opus recovered post-merge per status.claude.com.
✅ **UX-041** (PR #507) `apps/web/app/(app)/journal/[recipientId]/JournalTimeline.tsx` — `JournalCard` now renders author display name (Geist 500 11px ink) above the timestamp eyebrow. `members.find(m => m.user_id === event.actor_id)?.display_name ?? "Former member"`. Added `actor_id` field to `JournalEvent` type across 4 of 5 duplicate copies (5th deferred to **TD-138**); threaded `members` prop through `JournalLayout → JournalTimeline → JournalCard`. Restores PRODUCT.md Principle 4 ("lead with names and voices before metrics").
✅ **UX-042** (PR #505) `apps/web/app/(app)/journal/[recipientId]/JournalLayout.tsx:177` — top-bar title now reads `currentRecipient?.display_name ?? org?.name ?? "Care Journal"`. Element preserved as `<span>` (no `<h1>` swap — would breach WCAG 4.1.2). Eyebrow restructure dropped (existing `{sectionLabel}` already covers desktop; mobile gain was illusory under `hidden sm:inline`).
✅ **UX-043** (PR #506) `apps/web/app/(app)/journal/[recipientId]/MedicationChecklist.tsx` — imports `formatClockTime` from `lib/format.ts` so schedule rows render `"Lisinopril 10mg — 8:00a"` instead of `"Lisinopril 10mg — 08:00:00"`. Raw Tailwind green/red utilities swapped for `--color-success-subtle` / `--color-surface-muted` design tokens per `.claude/rules/ui-standards.md`. Missed-button hover de-escalated from punitive red to neutral muted state (logging a missed dose is a neutral act).

**Follow-up seeds in §1:** TD-137 (JournalCard `members.find()` perf hoist) and TD-138 (5-way `JournalEvent` type consolidation) — both surfaced by `/oop --from-sprint` review at `.claude/state/oop-review-journal-meds-quick-wins.md` and seeded via PR #508.

**Hotfix this session:** PR #504 — `apps/web/app/(app)/page.tsx` (created by yesterday's TD-135 subagent that misread an in-existence "modify" instruction) caused a Next.js parallel-route collision with `(marketing)/page.tsx`. Deleted the invented file; main went green. Drove a CLAUDE.md retro entry for "verify owned-file paths actually exist before locking the plan."

### 2026-05-14 PM — Pre-staging mitigations (TD-134/135/136 + SEC-009 runbook guidance) — PRs #497/#498/#499/#500
Sprint `pre-staging-mitigations` (`/sprint` full pipeline) shipped the three pre-staging-tier safety nets seeded earlier in the day from the SEC-001 post-mortem, plus the operator-facing runbook update for SEC-009. `/wave §3b` parallel dispatch — 4 file-disjoint Sonnet tracks. Opus adversarial review was degraded per status.claude.com (529s) so /opus-on-opus fell back to Sonnet reviewer per /sprint Step 5 fallback policy; three review cycles (1 must-fix → 1 must-fix → 0 must-fix) cleared the plan before dispatch.
✅ **TD-134** (PR #500) `scripts/migration-check.sh` + root `package.json` `migration-check` script + 1-line bullet under `.claude/CLAUDE.md` Development Workflow. Subagent also compressed `.claude/CLAUDE.md` 227→156 lines to stay under the global 200-line cap rule (additive bullet would have breached); content preserved.
✅ **TD-135** (PR #499) `apps/web/lib/featureFlags.ts` server helper with **parameter-less `getFeatureFlag(flag)` signature** — distinctId derived internally from `supabase.auth.getUser()` (ADR-0001 anonymous UUID), no PHI parameter surface; `apps/web/hooks/useFeatureFlag.ts` client hook wrapping `useFeatureFlagEnabled ?? false`; `bootstrap: { featureFlags: {} }` added to `PostHogInit`; reference call site in `apps/web/app/(app)/page.tsx` (invisible data-attribute); ADR-0004 at 74 lines.
✅ **TD-136** (PR #497) `.github/workflows/migration-lint.yml` path-filtered on `supabase/migrations/**.sql` + `scripts/migration-lint.sh` statement-collapsing normalizer (awk strips `--` comments, `tr ';' '\n'` splits statements, second awk collapses whitespace) catching 3 risky patterns: `ADD COLUMN ... NOT NULL` without DEFAULT, `CREATE INDEX` without CONCURRENTLY, `DROP COLUMN`. `-- safe-migration: <reason>` opt-out; multi-line DDL self-test confirmed working.
✅ **SEC-009 runbook guidance** (PR #498 — does NOT close SEC-009 itself) inserted new §9 "Populate Vercel's Development environment tier" + new §12 "Optional: enable the new safety nets" into `docs/project-info/runbooks/SECRETS_ROTATION-runbook.md`; renumbered existing §9 (Scrub git history) → §10 and §10 (Close out SEC-001) → §11; regenerated HTML.

**SEC-009 itself stays Ready** in §1 — operator UI work in Vercel dashboard. T4 produced the guidance; the operator closes the row by walking runbook §9. Housekeeping PR #501 added ADR-0004 to `docs/adr/README.md` index.

### 2026-05-14 PM — OWASP audit followups (SEC-004/006 + TD-132) — PRs #491/#492/#493
Sprint `owasp-sec-followups` (`/sprint` full pipeline) closed the three deferred OWASP audit rows via `/wave §3b` parallel dispatch (Sonnet, 3 file-disjoint tracks). T3 (TD-132) pivoted from the audit's literal write-site cap to a DB-level CHECK constraint after comprehensive grep proved `ai_conversations` has no app-code INSERT/UPDATE site — pivot evidence embedded in the plan. Two `/opus-on-opus` passes: pass-1 1 must-fix + 3 should-fix, pass-2 cleared with the must-fix REJECTED-WITH-EVIDENCE after the grep was reproduced.
✅ **SEC-004** (PR #493) `apps/web/lib/ocrSanitize.ts` helper: 8KB byte-cap (codepoint-safe `TextEncoder`/`TextDecoder` truncation), `DRUG_NAME_PATTERN` allowlist, `sanitizeOcrFields` returning `{ fields, sanitized }`. Wired `capRawOcrText` into BOTH OCR Inngest stubs, `sanitizeOcrFields` into prescription only — closes audit FIND-003 parts 1+2 (part 3 audit-log site spun out as **SEC-007** below).
✅ **SEC-006** (PR #492) Migration `20260515010000_share_token_entropy_256.sql` (or near) bumping `outer_circle_requests.share_token` and `care_briefs.share_token` DEFAULTs to 256-bit (`gen_random_bytes(32)`). Existing tokens preserved; rotation deferred to **SEC-008**. Closes audit FIND-005.
✅ **TD-132** (PR #491) Migration `20260515020000_ai_conversations_messages_cap.sql` adds `CHECK (array_length(messages, 1) IS NULL OR array_length(messages, 1) <= 50)` with 4-arg `throws_ok` pgTAP coverage (50 ok, 51 raises `23514`). Archival job deferred to **TD-133** until a write site materializes. Closes audit FIND-007 cap-half.

**Follow-up seeds in §1:** SEC-007 (OCR audit log) / TD-133 (ai_conv archival) / SEC-008 (existing-token rotation) — pre-committed in the plan's §"Follow-up backlog rows" to trace the partial-closure carve-outs.

### 2026-05-14 — OWASP security wave (SEC-002/003/005 + TD-131) — PRs #486/#487/#488/#489
Sprint `owasp-sec-wave` (`/sprint` full pipeline) closed the highest-leverage findings from the morning's OWASP audit (`docs/security/2026-05-14-owasp-audit.md`) via `/wave §3b` parallel dispatch (Sonnet, 4 file-disjoint tracks). Pre-merge Sonnet adversarial gates ran on each PR; T3 (SEC-005) had 2 must-fixes patched by orchestrator (`thread_id`→`org_id` rename + integration test asserting count-only payload and no raw matchedKeys leak to Sentry/PostHog).
✅ **SEC-002** (PR #488) Stripe webhook `stripe_events` event-ID dedup table + `upsert ignoreDuplicates` dispatcher short-circuit + 4-arg `throws_ok` pgTAP — closes FIND-001 (replay protection).
✅ **SEC-003** (PR #489) `rateLimit(request, "brief/share")` mirroring sibling revoke endpoint — closes FIND-002.
✅ **SEC-005** (PR #487) `detectPhiSlip` post-filter + Sentry/PostHog signals on PHI-name reappearance in LLM output; UUID + counts only per ADR-0001; ESLint `carelog/no-phi-in-analytics` clean — closes FIND-004.
✅ **TD-131** (PR #486) `// SECURITY:` inline comment on `AIChatThread.tsx` `{msg.content}` render site + new `carelog/no-html-in-ai` ESLint rule scoped to `components/ai/` (forbids `dangerouslySetInnerHTML` + markdown-renderer imports) — closes FIND-006.

**Deferred to next chunk:** SEC-004 (OCR scaffold), SEC-006 (token entropy normalize), TD-132 (`ai_conversations` growth cap) — explicit non-goals of the just-shipped chunk per plan §"Non-goals".

### 2026-05-14 — OOP refactor Waves B/C/D (10 stories) — PRs #474..#483
Front-loaded combined plan (`docs/plans/2026-05-14-oop-waves-bcd.md`) shipped the 10 surviving OOP stories from the re-grounded Phase 2 audit (#472) across three sequential `/wave` dispatches. All invariant-preserving — no external behavior changes; full vitest + jest suites green at each merge.
✅ **OOP-004** (PR #475) OCR job state machine + optimistic-lock concurrency — extracted `OcrJobStateMachine.transitionTo()`; routes do `.eq("status", currentStatus)` and return 409 on race.
✅ **OOP-006** (PR #476) Brief headline classifier → strategy chain — 8 `HeadlineStrategy` classes; `headline.ts` 223→122 lines (helpers retained).
✅ **OOP-008** (PR #474) `care_briefs.recipient_id` BEFORE UPDATE trigger with `IS DISTINCT FROM` + 4-arg `throws_ok` + `SET LOCAL ROLE service_role` discipline test.
✅ **OOP-009** (PR #481) `PayloadMutator` interface + 3 per-kind mutators under `apps/mobile/lib/offlineMutators/`; `useOfflineWrite.ts` composes via registry.
✅ **OOP-010** (PR #479) Mobile `SecureStore` key registry — `KEYS` const with `v1:carelog:` namespace + per-key `migratedGet` fallback to preserve existing device state.
✅ **OOP-011** (PR #480) `useMutationWithRefresh` composable — 6 of 7 named screens refactored; `schedule/index.tsx` skipped per allowlist discipline (fully-divergent pattern).
✅ **OOP-012** (PR #478) `NameResolver` injection on `buildHandoffSummary()` — `CachedNameResolver` ref impl; snapshot test commits FIRST per push-early protocol.
✅ **OOP-013** (PR #482) `NotificationRouter` registry with Zod `NotificationPayload` schema; root dispatcher in `_layout.tsx` preserves OCR routing bit-for-bit. (Orchestrator pushed missing-barrel-export typecheck fix.)
✅ **OOP-014** (PR #483) `SyncStatusManager` singleton context — single 2s timer + AppState pause/resume; `useSyncStatus()` becomes a thin context consumer. (Orchestrator rebased + pushed after D4 subagent terminated locally.)
✅ **OOP-015** (PR #477) Stripe webhook handler map (PR1 of 2). 4 per-event handlers under `apps/web/app/api/stripe/webhook/handlers/`; `route.ts` 124→47 lines. PostHog error path preserved; PR2 (Sentry routing) deferred.

**Wave A→D telemetry:** 13 PRs total across the day (#468/#469/#470 Wave A this morning, plus #466 dep refresh + #467 E2E bit-rot fix, plus the 10 here). Push-early-after-first-commit protocol (introduced before Wave C after Wave B's 2-of-3 context-exhaustion rate) became load-bearing — Waves C and D landed with orchestrator code-takeover only on a typecheck fix (D3) and a rebase handoff (D4 subagent terminated post-commit).

### 2026-05-14 — OOP wave A (OOP-001/002/005) + TD-128 dep refresh + E2E bit-rot fix — PRs #466/#467/#468/#469/#470
Sprint `oop-wave-a` (`/sprint` full pipeline) shipped three invariant-preserving refactors via `/wave §3b` parallel dispatch (Sonnet, file-disjoint). Preceded by an emergency dep + e2e cascade: TD-128 next 16.2.6 + pnpm overrides (PR #466) cleared 14 high vulns; PR #467 fixed expense E2E date bit-rot (hardcoded `incurred_at: "2026-04-13"` fell outside ExpensePanel's 30-day rolling window on 2026-05-14) via relative-date sweep across `e2e/expenses.spec.ts` + `e2e/brief.spec.ts`. Sonnet adversarial gates flagged two must-fixes that didn't land before auto-merge fired → captured as TD-129/TD-130 in §1.
✅ **TD-128** Next 16.2.6 bump + protobufjs/opentelemetry pnpm overrides (PR #466) — cleared 14 high CVEs blocking OOP wave dep audit. Retroactive entry; no §1 row.
✅ **E2E bit-rot fix** (PR #467) — `expenses.spec.ts:61` + `brief.spec.ts` ISO timestamps swapped from hardcoded to `new Date().toISOString().slice(0, 10)`-derived. No backlog row; defensive sweep.
✅ **OOP-002** Enable RLS + pgTAP on `journal_reactions` (PR #468) — migration enables RLS with SELECT/INSERT/UPDATE policies (team via event→recipient join, `user_id = auth.uid()` + team) + pgTAP coverage. No app-behavior change.
✅ **OOP-001** pgTAP for `invite_tokens` atomicity + expiry (PR #469) — `supabase/tests/invite_tokens_rls.test.sql` covers 6 cases (valid/expired/email-mismatch/already-consumed/concurrent-accept/post-accept membership state). Adversarial-gate gap: missing `SET LOCAL ROLE service_role` discipline → TD-129.
✅ **OOP-005** `CareEvent` payload discriminated union + type guards (PR #470) — new `apps/web/lib/careEvent.ts` exports `MedicationEvent|JournalEvent|SymptomEvent|AppointmentEvent|ShiftEvent|ExpenseEvent|HandoffEvent` + `isXEvent()` guards; refactored 6 consumer sites. Adversarial-gate gap: `pdf/route.tsx` lost `typeof string` narrowing on `payload.text` → TD-130.

### 2026-05-10 PM-4 — Local-dev followups (TD-124/125/127) — PRs #458/#459/#460
Sprint `2026-05-10-pm-followups` shipped 3 of 4 planned tracks; T3 (TD-126) dropped after investigation showed the LCP premise was wrong. Wave executed direct mode after Opus-on-opus review.
✅ **TD-124** `supabase/seed.sql` end-to-end fix — config.toml flag + identity_vault precedence + SELECT-or-INSERT on auth.users (no email unique constraint) + drop ON CONFLICT on memberships (user_id nullable) (PR #458)
✅ **TD-125** Gate Sentry event-sending in dev via `enabled:` flag — silences Hobby-tier 429 storm; SENTRY_FORCE_ENABLED=true escape hatch (PR #459)
✅ **TD-127** ADR-0003 `needs-phi-review` label removal protocol — Path A human review / Path B narrow orchestrator self-clear (PR #460)
🧊 **TD-126** deferred — chrome-devtools performance trace measured local LCP at 132ms; HeroSection has no `<Image>`; hero-4.png is below the fold in HowItWorks (priority prop would hurt, not help).

### 2026-05-10 PM-3 — Recipient profile data wiring wave (UX-103/104/105) — PRs #451/#452/#453
Three sequential tracks all shipped this evening. Each component shell was previously scaffolded (UX-094) and rendered with empty/static props; this wave wired them to real data — no new schema (jsonb columns already existed).
✅ **UX-103** Wire CareTeamList — `getCareTeamForRecipient` in membershipsRepository (auth.admin.getUserById per member, briefs.ts:232 precedent) (PR #451)
✅ **UX-104** Wire LikesDislikesList — `getRecipientPreferences` in new recipientsRepository, session-scoped supabase client + Zod permissive parse defaults (PR #452)
✅ **UX-105** Wire EmergencyFooterCard — pure `parseEmergencyInfo` in identityRepository parsing already-resolved contact_info (no extra DB hop, identical PHI gate) (PR #453)

Sonnet adversarial gate caught 1 must-fix + 2 should-fix on the cumulative diff: T1 lacked defense-in-depth on `supabaseAdmin` query; T1 was N+1 on member-name resolution; T1 mock was fragile. Must-fix applied to T2 (now uses session-scoped supabase). T1 follow-ups filed as TD-120/121/122. Edit affordance for all 3 panels filed as UX-103b/104b/105b (out of scope per plan non-goals).

### 2026-05-10 PM-2 — Stale-Ready row reconcile (no code change)
Surfaced during /sprint planning: 6 Ready rows referenced files that already exist on main from earlier PRs. The /backlog-sync skill's §3a Stale-Ready detector wasn't run during the prior sync, so the rows persisted incorrectly. No new work — purely a status reconciliation.
✅ **TD-112** `/backlog-sync` skill: stale-Ready detector — `~/.claude/skills/backlog-sync/SKILL.md` §3a already in place (shipped 2026-05-09, row stale)
✅ **TD-113** `careEventCommentsRepository.test.ts` — 332 lines, 21 tests covering listComments / insertComment / editComment / softDeleteComment / getFanoutTargets
✅ **TD-114** `medicationTaggingRepository.test.ts` — PR #418
✅ **TD-115** `shiftTradeRequestsRepository.test.ts` — 471 lines, 18 tests covering createRequest / respondToRequest / acceptRequest (happy + status mismatch + partial failure) / forceOverride / expireStaleRequests
✅ **TD-116** `moodEntries.test.ts` — 349 lines, 19 tests covering sparkline auth / membership gate / day-bucket math / MOOD_SCORE / latestMood
✅ **TD-117** Automated PHI-invariant ESLint rule — PRs #433 + #436

### 2026-05-10 PM — Smoke-walk fixes + TD-118/119 admin-error hint sweep (PRs #438–#448)
Two waves on the same day. Wave 1 (smoke walk): 5 stories filed and shipped same-day after a manual UI walk-through. Wave 2 (A11Y-021 + TD-119 follow-ups): contrast sweep + `wrapAdminError` wiring across all admin call sites surfaced by TD-118.
✅ **A11Y-020** `/signin` CTA contrast — `--color-primary-pressed` for AA 5.04:1 (PR #438)
✅ **UX-114** Drop duplicate `/about` "Start your family's log" CTA after UX-112 (PR #439)
✅ **UX-115** Subordinate dashboard AI Assistant FAB via outline treatment to disambiguate from QuickLog (PR #440)
✅ **UX-113** Re-frame HowItWorks landscape hero — desktop crop fix + `aspect-[4/3]` (PRs #441, #443)
✅ **TD-118** Runtime guard for `SUPABASE_SERVICE_ROLE_KEY` misconfig — JWT shape sanity-check at first `supabaseAdmin` use, throws in dev / logs CRITICAL in preview+prod; introduces opt-in `wrapAdminError(error)` helper (PR #442)
✅ **A11Y-021** Sweep 28 white-on-`--color-primary` CTAs across app + marketing — body-text CTAs to `--color-primary-pressed`; 3 deliberate keeps annotated with WCAG large-text justification (PR #446)
✅ **TD-119** Wire `wrapAdminError()` into all admin call sites — 47 sites across 17 files (10 tRPC routers + 3 API route handlers, both initial 13-site + 34-site expansion). TRPCError sites hoist `wrapAdminError(error).message` to `message`, pass original PostgrestError as `cause` (server-only, preserved for Sentry; tRPC's `getDefaultErrorShape` doesn't include `cause`) (PRs #447, #448)

### 2026-05-10 — Wave 14 Part A — visit recorder triage
Read-only investigation per `docs/plans/wave-14-test-gaps-and-visit-recorder.md`. Decision: schema-ahead-of-UI **by design** per PR #348. Updated ROADMAP Phase 4 visit-recorder paragraph to document the design rationale; corrected ON-55 §5 row to reflect "data-model shipped, UI deferred" instead of "Phase 7 / future." No new ON-NN row needed — ON-55 already covers the UI surface.
✅ **UX-107 (triage)** closed; row dropped from §1.

### 2026-05-09 PM — Wave 13-A + retroactive TD-78..82 reconcile (PRs #396–#398)
Wave 13-A intent was UX-045 (PHI gate) + UX-051 (brand cleanup); UX-051 deferred mid-wave when DNS blocker surfaced. Wave 13-B (TD-78..82) aborted at preflight: all 5 test files already on main from earlier sprints — backlog rows were stale.
✅ **UX-045** Redact `content.dob` from `/api/brief/[shareToken]` unless `includes` opts in — fail-closed (PR #396)
✅ **fix(test)** ExpensePanel fixture relative-date — date-rollover flake hit every PR opened 2026-05-10 (PR #397)
✅ **fix(e2e)** shift-calendar helper drop racy conditional — `count()` doesn't auto-wait, ShiftsPanel layout-toggle Calendar tab needs a render cycle (PR #398)
✅ **TD-78..82** retroactively flipped to ✅ Shipped — files `apps/web/server/routers/__tests__/user.test.ts` (#248, 21 tests), `careEventsRepository.test.ts` (#249, 10 tests), `lib/__tests__/stripe.test.ts` (#250, 3 tests), `organizationsRepository.test.ts` (#253, 11 tests), `supabase/tests/care_events_client_id.test.sql` (#258, pgTAP) — coverage matches the original spec.
🧊 **UX-051** deferred — caresync.app inbox (`hello@`/`privacy@`) not yet provisioned; legacy `care-log.org` strings stay until DNS is set up.

### 2026-05-09 PM — Roadmap & harness audit remediation (PRs #387–#394)
Source: `docs/audits/2026-05-09-roadmap-and-harness-audit.md` + `docs/plans/audit-remediation-2026-05-09.md`. 8 chore PRs, ~3 hr active work.
✅ **A.1+A.2** Fixed 9 stale `Documents/projects/carelog` hook paths + worktree-cwd commit guard — restored silently-broken pgTAP-on-edit + mobile-typecheck regression nets (PR #387)
✅ **A.3+A.4** Backlog/roadmap stale-reference sweep (`/carezone-alternative` consolidated; ROADMAP "Weekly digest" was actually shipped) + ON-69/UX-066 strikes (PR #388)
✅ **C.1+C.2** Scoped tsc/eslint hooks to `apps/web` edits + dedupe allowlist 27→18 (PR #389)
✅ **D.3** Pre-commit eslint pass — catches React 19 react-hooks/purity errors locally (PR #390)
✅ **B.1+B.2** Resolved 4 stale Ready rows (UX-035 struck, UX-053 narrowed, SEO-006 → 🧑, TD-87 → 🟡 Spike) + filed 5 ROADMAP-promised rows ON-70..74 (PR #391)
✅ **D.4** /dispatch — early-push guideline + post-dispatch PR verifier (PR #392)
✅ **C.4** Split `.claude/CLAUDE.md` 412→233 lines (−43%); 189 lines moved to new `HARNESS_USAGE.md` runbook (PR #393)
✅ **C.3 phase 1** Deleted 5 byte-identical project skill shadows (project skills 26→21) (PR #394)
B.3 (memory hygiene) shipped out-of-band — repo-external. Plus Wave 12 Session A: SEO-001/002/004 shipped via PR #386 (rows promoted in this sync).

### 2026-05-09 PM — Wave 10 Auth flow hardening (PR #383)
Bundled four auth/onboarding stories into one PR — overlapping file scope (signin/page.tsx, layout.tsx, marketing chrome).
✅ **TD-108** Multi-org caregiver: replaced `.single()` with earliest-accepted-membership pick in `(app)/layout.tsx`
✅ **TD-109** `/signin` redirects authed visitors to `/dashboard` before render
✅ **UX-107** `/signin` + `/onboarding` h1s migrated to `.headline-display` Fraunces italic-em pattern
✅ **UX-108** New `MarketingNavSlim` brand-mark nav mounted on `/signin` + `/onboarding`

### 2026-05-09 — Wave 9 Shifts data plumbing (PRs #372–#379)
Closes the "Handoff / Week / Team / Questions" empty states in ShiftsPanel and finalizes the dashboard brief surface. UX-101/102 each split into multiple PRs at adversarial-review request to keep schema and wiring atomic.
✅ **UX-095 finalize** Brief surface wired to live adapters via new `briefs.dashboardSummary` tRPC + `<BriefSection>` component (PR #372)
✅ **chore(security)** Pin axios ≥1.15.1 + fast-uri ≥3.1.2 overrides; restore TD-29 warn-only on OSV/Trivy (PR #373)
✅ **UX-100** `buildShiftWeekGridBlocks` adapter — ShiftsPanel "Week" tab renders real blocks (PR #374)
✅ **UX-101a** `shifts.handoff_entries jsonb` column + 9 pgTAP tests + types regen (PR #375)
✅ **UX-101b** `shifts.upsertHandoff/getLatestHandoff` tRPC + ShiftsPanel "Handoff" tab wire + 12 logic tests (PR #376)
✅ **UX-101c** `<ShiftQuoteNote>` mount on dashboard via `getLatestHandoff` (PR #377)
✅ **UX-102a** `shift_questions` table + RLS + immutability trigger + 15 pgTAP tests (PR #378)
✅ **UX-102b** `shiftQuestions.list/create/resolve` tRPC + ShiftsPanel "Questions" tab composer + resolve flow + 10 logic tests (PR #379)

### 2026-05-08 — CareSync handoff follow-ups Wave 8 (PRs #367–#371)
✅ **UX-095** Brief surface mount — SleepSparkline + ComingUpRows + ShiftQuoteNote + OnShiftSidebar + PatternCard wired into DashboardClient (PR #368)
✅ **UX-096** `sleepFromEvents` adapter — 7-night sleep buckets from `care_events` (PR #370)
✅ **UX-097** `comingUpEvents` adapter — next ≤5 scheduled events for `<ComingUpRows>` (PR #369)
✅ **UX-098** `deriveOnShift` adapter — current/next caregiver + latest mood join (PR #369)
✅ **UX-099** `detectPattern` helper — threshold-driven 7d pattern signal for `<PatternCard>` (PR #370)

### 2026-05-01 PM — CareSync handoff (frozen design) (PRs #349–#365)
Source: `docs/caresync-handoff/`. 28 stories shipped in one session. Brand decision: Sage default; `hearth` + `slate` retired from runtime. UX-077 (Today route default flip) deferred — needs product decision.
✅ **UX-067** Flip default theme to Sage; retire `hearth`/`slate` runtime alternates (PR #351)
✅ **UX-068a** SageRail — dark `--app-shell` sidebar w/ brand mark, sections, recipient footer (PR #351)
✅ **UX-068b** SageTopBar — crumb + title + search + ⌘K chip + action slot (PR #350)
✅ **UX-068c** Mount SageRail + SageTopBar into `(app)` layout behind `?shell=sage` opt-in (PR #352)
✅ **UX-070** BriefHero default flip — bold display headline; italic via `?headline=italic` alt (PR #356)
✅ **UX-071** SleepSparkline — 7-day inline SVG sparkline + plain-language numbers (PR #353)
✅ **UX-072** ShiftQuoteNote — left-rule indented blockquote for previous-shift voice (PR #354)
✅ **UX-073** ComingUpRows — clean rows of next 4–5 events (PR #354)
✅ **UX-074** OnShiftSidebar + PatternCard — right-rail brief callouts (PR #355)
✅ **UX-075** TimeRailTimeline — vertical rail + chronological events + NOW pill + type icons (PR #361)
✅ **UX-076** TimelineFilterChips — multi-select chip toolbar (PR #361)
✅ **UX-078** MedAttentionHero — full-width hero card for missed-dose state w/ catch-up CTA (PR #358)
✅ **UX-079** RxGlyph — Fraunces italic ℞ component (PR #358)
✅ **UX-080** MedStatusBadge — On track / Catch up / Missed pill (PR #358)
✅ **UX-081** Mount MedAttentionHero + RxGlyph + MedStatusBadge into MedCard (PR #359)
✅ **UX-082** NarrativeHandoff — "Three things you need to know" composer + view (PR #363)
✅ **UX-083** ShiftWeekGrid — Mon–Sun × hours grid w/ per-person color blocks (PR #363)
✅ **UX-084** ShiftTeamList — plain stacked rows; replaces TeamNowBoard default (PR #363)
✅ **UX-085** OpenQuestionsCard — inbox-like callout below handoff (PR #363)
✅ **UX-086** Shifts route default flips — Narrative + WeekGrid + TeamList tabs default; legacy variants behind tabs (PR #365)
✅ **UX-087** JournalEntryForm inline default — confirmed no-op; default mode was already `"standard"` (inline composer + 3 mood badges)
✅ **UX-088** WeeklyMoodBars — bar chart of weekly mood distribution + top tags (PR #360)
✅ **UX-089** FridayExportHint — footer card explaining therapist Friday email (PR #360)
✅ **UX-090** Journal route default flips — WeeklyMoodBars default sidebar; MoodHeatmap behind `?sidebar=heatmap`; FridayExportHint mounted (PR #364)
✅ **UX-091** LikesDislikesList — side-by-side bulleted lists (PR #357)
✅ **UX-092** CareTeamList — stacked rows w/ phone + role (PR #357)
✅ **UX-093** EmergencyFooterCard — DNR / primary contact / hospital preference (PR #362)
✅ **UX-094** Profile route mount — composes RecipientProfile + LikesDislikesList + CareTeamList + EmergencyFooterCard (PR #364)

### 2026-05-01 — Plan C CareSync 2.0 wiring + journal pagination (PRs #336–#343)
✅ **TD-100** Journal timeline cursor pagination — `before`/`limit` on `/api/journal`, `loadMore` on `useJournalData`, IntersectionObserver sentinel + Load older button (PR #336)
✅ **UX-061** Wire `<MedScheduleStrip>` + `<AdherenceChart>` into MedCard — new `lib/medAdherenceFromEvents.ts` adapter + `medications.weekData` tRPC; bundles fix to `listScheduled` (`time_of_day` alias, drop nonexistent `org_id`) (PR #337)
✅ **UX-062** Shifts layout toggle (Calendar / Lanes / Now) — new `ShiftsPanel` + `lib/shiftLayouts.ts`; Briefing deferred to UX-065 (PR #339)
✅ **UX-063** Mount `<MoodHeatmap>` in JournalLayout sidebar — 2-col grid `lg:` breakpoint, sticky right rail (PR #338)
✅ **UX-064** `/recipient/[recipientId]/profile` route + journal Profile link — server-resolved identity via `identityRepository.resolveIdentity`; mood/caregivers/About deferred to UX-066 (PR #340)
✅ **TD-106** Fix `e2e/export.spec.ts:81` toast assertion drift after TD-96 — case-insensitive regex on stable substring (PR #343)

### 2026-04-30 PM — Plan B web hardening + Tier 1 testing (PRs #328–#334)
✅ **TD-77** `identityRepository` cross-org / malformed / expired token tests (PR #328)
✅ **TD-98** Truncation pass on long-text card spans — `min-w-0 truncate` on MedCard / RecipientHeader / ShiftEventCard / JournalTimeline (PR #334)
✅ **TD-101** RTL smoke test — logical-direction utility regression net (PR #333)
✅ **TD-102** Explicit `mutations.retry: 0` in TrpcProvider (PR #329)
✅ **TD-103** `useDebouncedValue` hook + journal/messages search wiring (PR #331)
✅ **TD-104** `pluralize()` helper using `Intl.PluralRules` + 5+ site migration (PR #330)
✅ **A11Y-019** SR-only `LiveRegion` for offline-queue + optimistic-update transitions (PR #332)

### 2026-04-30 — CareSync 2.0 design handoff (PRs #320–#326)
✅ **UX-054** Sage parlor palette + ThemeSwitcher (`data-theme="sage|hearth|slate"` + dark) (PR #320)
✅ **UX-055** Card header variants — outline / accent left-bar / serif italic (PR #321)
✅ **UX-056** Today "Now Board" timeline layout (PR #323)
✅ **UX-057** MedCard day-strip + 7-day adherence chart (presentational) (PR #325)
✅ **UX-058** Shifts BriefingHandoff + ShiftLanes + TeamNowBoard (presentational) (PR #326)
✅ **UX-059** Journal prompted composer + mood spectrum + heatmap (PR #324)
✅ **UX-060** RecipientProfile card (presentational) (PR #322)

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
