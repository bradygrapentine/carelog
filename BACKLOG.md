# Carelog — Master Backlog

> **This is the single source of truth for all planned work.** Every task — feature, bug, tech debt, infra, polish — is tracked here with a lifecycle status. Read this file **before** starting any task. Update it **immediately** when status changes. If it isn't here, it isn't planned. Run `/backlog-sync` at least once a day (and on session start) to reconcile against git/PRs.

Last consolidated: **2026-04-14** (codebase scan same day). Last `/backlog-sync`: **2026-04-15**.

Replaces: `OVERNIGHT_BACKLOG.md`, `BACKLOG_PHASE2–5.md`, `BACKLOG_UI_REDESIGN.md`, `docs/superpowers/plans/CLAUDE_BACKLOG.md`. `BUILD_STATUS.md` and `TECH_DEBT.md` are **historical logs only** — new work is tracked here.

Human account-signup tasks (Supabase/Vercel/Stripe/etc.) live in `docs/project-info/runbooks/THIRD_PARTY_SETUP.md` and are referenced from §8.

---

## 0. Status board (at-a-glance)

Counts reflect items in §1–§6 only; §7 is the shipped log.

| Lifecycle | Count | Where |
|---|---|---|
| 🟢 Ready | 2 | §1 TD-02, TD-03 |
| ⚡ In progress | 1 | §1 PP-006 |
| 🔎 In review | 8 | §2 TD-05 #61 · ON-37 #62 · ON-48 #58 · §4 A11Y-005 #59 · A11Y-006 #63 · §6 UX-01 #54 · UX-05 #60 · UX-07 #53 |
| 🔴 Blocked | 4 | §3 PP-007..010 (blocked by PP-006) |
| 🌙 Overnight queue | 2 | §2 ON-15, ON-31 |
| 🧊 Deferred | 8 | §6 UX-02/04/08/09/11 (5) + §1 PP-013 + §3 PP-002/003 |
| 🧑 Needs human | 3 | §8 |

> If this table looks stale, run `/backlog-sync` — it rewrites it from the story rows below.

---

## Legend

| Tag | Meaning |
|---|---|
| 🟢 | **Ready** — scoped, unblocked, not yet picked up |
| ⚡ | **In progress** — an agent or human is actively working on it |
| 🔎 | **In review** — PR open, awaiting review or CI |
| 🌙 | **Overnight-eligible** — picked up by the nightly agent (2 am CT / 8 am UTC). Must be mechanical, low risk, no shared-state conflicts. |
| 🧊 | **Deferred** — intentionally parked |
| ✅ | **Shipped** — moved to §7 |
| 🔴 | **Blocked** — prerequisite open; note `Blocked by:` inline |
| 🧑 | **Needs human** — account signup, env var, click-through — see §8 |

Every active row **must** include a `Status:` field (`Ready` / `In progress` / `In review` / `Blocked` / `Shipped`) and, when applicable, `Owner:` (agent name, human, or `nightly`) and `Branch:`/`PR:` once work starts. `/backlog-sync` fills what it can infer.

**Story-ID prefixes**
- `ON-*` — overnight-originated stories (mobile a11y, mechanical sweeps, large features)
- `PP-*` — platform parity (web/iOS/Android)
- `A11Y-*` — accessibility tooling
- `UX-*` — deferred UI redesign polish
- `TD-*` — tech debt (newly opened; historical items live in `docs/project-info/technology/TECH_DEBT.md`)
- `P2-*`..`P5-*` — phase backlogs (all shipped, retained as a log in §7)
- `B*`/`D*`/`A*`/`C*` — before-launch Claude tasks (shipped where no 🧑 gate)

---

## 1. Active / next-up

| ID | Status | Owner | Branch / PR | Story | Notes |
|---|---|---|---|---|---|
| PP-006 | ⚡ In progress · 🔴 blocks PP-007/008/009/010 | — | — | **Android prebuild + boot verification** | `apps/mobile/android/` has never been generated. Run `(cd apps/mobile && npx expo prebuild -p android --clean)`, decide commit-vs-gitignore (align with `ios/`), verify `pnpm --filter mobile android` boots on an emulator. AC: debug APK builds on CI. |

### New tech-debt (TD-*) — opened 2026-04-14

| ID | Status | Story | Notes |
|---|---|---|---|
| TD-02 | 🟢 Ready | **Dynamic Type + screen-reader audit (mobile)** | Surfaced in BUILD_STATUS Wave 4. Physical device required. Supersedes the BUILD_STATUS checkbox — track here. |
| TD-03 | 🟢 Ready | **Sentry source maps upload** | BUILD_STATUS: "source maps pending `SENTRY_AUTH_TOKEN`". Needs 🧑 env var in Vercel. |

---

## 2. Overnight queue 🌙

Picked up automatically by the nightly agent. Rules: mark `✅` when done; list `**Blocked by:**` if a prerequisite is still open; one story per `###`; stay under ~4 hrs of work.

All items below are independent (no shared-state conflicts) — the agent may fan out in parallel.

### 🌙 ON-15 — Mobile: accessibility audit (iOS Dynamic Type + VoiceOver)
**Why:** Mobile uses fixed `fontSize` throughout; never tested against 200% Dynamic Type or VoiceOver navigation order.
**Work:** Run app under max Larger Accessibility Sizes on journal/medications/schedule; migrate fixed sizes to `PixelRatio.getFontScale()` capped at 1.5×. VoiceOver-complete a medication-log flow end-to-end. File follow-up ON-XX for issues deferred.
**AC:** app usable at 200% DT on 3 key screens; VoiceOver finishes the med-log flow.
**Size:** ~1 day. **Blocked by:** nothing.

### 🌙 ON-20 — Mobile `accessibilityLabel` sweep on icon-only / emoji buttons
**Why:** per `apps/mobile/CLAUDE.md`, every icon-only `Touchable/Pressable` must declare `accessibilityLabel` + `accessibilityRole="button"`. Many still missing.
**Work:** grep mobile for icon-only interactives; add labels + role; do NOT alter layout/handlers.
**AC:** grep returns 0; `cd apps/mobile && pnpm test` + `pnpm typecheck` green.
**Size:** ~2 hr. **Blocked by:** nothing.

### 🌙 ON-21 — Web raw-hex audit + token migration · 🔎 PR #34
**Why:** `.claude/rules/ui-standards.md` forbids raw hex in component files.
**Work:** `grep -rn "#[0-9a-fA-F]\{3,8\}" apps/web/app apps/web/components`; replace with closest `var(--color-*)`. If no close token, add note in PR — do NOT invent a token. Skip `.svg/.ico/public/`.
**AC:** no raw hex in `.tsx/.ts`; visual spot-check on dashboard + journal + billing; `pnpm typecheck` + `pnpm test` green.
**Size:** ~3 hr. **Branch:** feat/on21-raw-hex

### ✅ ON-22 — pgTAP RLS test: `notification_preferences`
Owner-only RLS, no pgTAP coverage. Template: `supabase/tests/expenses_rls.test.sql`. Cases: owner r/w self pass, cross-user blocked, anon blocked. **AC:** `supabase test db` passes. **Size:** 1 hr.

### ✅ ON-23 — pgTAP RLS test: `care_recipients`
Root of org scoping — cannot ship multi-tenant without this. Cases: org member reads; non-member blocked; only coordinator can insert/update/delete; anon blocked on all. **AC:** `supabase test db` passes with 5+ assertions. **Size:** 1.5 hr.

### ✅ ON-24 — pgTAP RLS test: `mood_entries`
PHI. Cases: org member reads for in-org recipients only; author-only update/delete; anon blocked. **Size:** 1.5 hr.

### ✅ ON-25 — Zod schema tests for shared validators
`find packages -name "*.ts" -path "*schema*"`; for each without a `.test.ts`, add one valid case + 2–3 invalid edge cases. **AC:** every exported schema in `packages/shared` has a test. **Size:** 3 hr.

### 🌙 ON-26 — Mobile empty-state copy pass
Grep mobile for "No data", "Nothing here", "Empty", "No results"; rewrite in Carelog voice (see `UX_DECISIONS.md`) with a concrete next-action CTA. Keep layouts identical. **Size:** 2 hr.
**Status:** 🔎 In review, Branch: feat/mobile-ux

### 🌙 ON-27 — Web alt-text audit
`grep -rn "<Image\|<img "`; verify meaningful `alt`; decoratives get `alt="" aria-hidden="true"`. **AC:** `eslint --rule 'jsx-a11y/alt-text: error'` clean. **Size:** 1 hr. *(Overlap with A11Y-002 — run A11Y-002 first; this becomes a no-op.)*

### 🌙 ON-28 — Mobile loading skeletons on list screens
Add `<Skeleton>` to `apps/mobile/components/`, use on journal, medications, documents, team index screens. Respect dark mode via `useAppTheme()`. **Size:** 3 hr.
**Status:** 🔎 In review, Branch: feat/mobile-ux

### 🌙 ON-29 — Replace `console.log` with logger in `apps/web` · 🔎 PR #35
Grep `console\.(log|warn|error)` in `apps/web/app|lib|server`; replace with project logger (`apps/web/lib/logger.ts`). Skip tests/scripts. **AC:** no `console.*` in prod source; `pnpm lint` clean. **Size:** 1 hr. **Branch:** feat/on29-console-logger

### ✅ ON-30 — JSDoc on public exports in `packages/shared`
One-line JSDoc on each exported function/type where purpose isn't obvious. Do NOT invent behavior. **Size:** 2 hr. **Branch:** feat/on30-jsdoc-shared. Shipped PR #50.

### 🌙 ON-31 — E2E: settings page notification prefs
Write `e2e/notification-preferences.spec.ts`: sign-in, toggle pref, reload, assert persisted. Follow `e2e/CLAUDE.md`. **Size:** 2 hr. **Blocked by:** PP-004 (if settings page is the new hub).

### 🌙 ON-32 — E2E: invite-accept happy path
Write `e2e/invite-accept.spec.ts` using multi-context pattern. Coordinator creates invite → second browser accepts → lands on dashboard with correct role. Cover expired-invite rejection as secondary. **Size:** 3 hr.

### ✅ ON-33 — Mobile: Sentry breadcrumbs on tRPC errors
Add breadcrumb with procedure name + operation type (NEVER input values — PHI). Scrub `email`, `name`, free-text. Verify by triggering an error. **Size:** 2 hr. **Branch:** feat/on33-mobile-sentry-breadcrumbs. Shipped PR #51.

### 🌙 ON-34 — PostHog funnel events: web ↔ mobile parity audit
Grep both apps for `posthog.capture(` calls; produce diff table at `docs/project-info/technology/ANALYTICS_EVENTS.md`. Report only — no new events. **Size:** 1 hr.

### ✅ 🌙 ON-35 — `.gitignore` hygiene
Add `apps/web/sonar-report.xml` + `.memsearch/` to root `.gitignore`; `git rm --cached` both. Verify no other generated artifacts remain tracked. **Size:** 15 min.

### 🌙 ON-36 — TODO/FIXME audit + backlog backfill
Grep `TODO|FIXME|XXX|HACK` across apps/packages/supabase. Classify: resolve <10 min, convert to new backlog entry (reference ID in comment), or delete if obsolete. Report at `docs/project-info/technology/TODO_AUDIT.md`. **Size:** 2 hr.

### 🔎 ON-37 — `ts-prune` unused exports sweep
`pnpm dlx ts-prune -p apps/web/tsconfig.json` and mobile. Annotate false positives, delete true orphans. Verify with grep across all apps before deleting workspace `index.ts` exports. **AC:** report reduced ≥50%. **Size:** 3 hr.
**PR:** #62. Mobile: 55 → 10 flags (82% reduction). Expo Router defaults + test helpers annotated; `getPostHog()` deleted.

### ✅ 🌙 ON-38 — Dependency freshness report
`pnpm outdated -r` + `pnpm audit --prod`. Write `docs/project-info/technology/DEPENDENCY_AUDIT.md`: advisories, major lags, recommended upgrade order. Report only. **Size:** 1 hr.

### ✅ ON-39 — Eliminate `any` types
Grep `: any\b|<any>|as any` in apps/packages. Replace with precise type or `unknown` + narrowing. Do NOT disable ESLint rule. **AC:** `any` count reduced ≥80%. **Size:** 4 hr.
**Branch:** feat/on39-eliminate-any. Production `any` count: 1 → 0 (100% reduction). Shipped PR #52.

### 🔎 ON-48 — Add neutral design tokens + update brief page · ~1 hr
19 TODOs in `apps/web/app/brief/[shareToken]/page.tsx` flag missing neutral gray tokens. Added `--color-neutral-{50,100,200,400}` and `--color-white` to `globals.css`; replaced all inline hex in brief page. **PR:** #58. **Size:** 1 hr.

### 🔎 TD-05 — Regenerate Supabase TypeScript types after messaging migration
Regenerated message_threads, message_thread_members, messages types after messaging migration. Removed 10 `as any` casts from messagesRepository.ts.
**AC:** `pnpm typecheck` clean with zero `as any` in messagesRepository.ts. **Size:** 15 min. **PR:** #61.

---

## 3. Platform parity (PP-*)

Full table + stories: `docs/project-info/product/PLATFORM_PARITY.md`. Active items are listed in §1 above. Remaining:

| ID | Priority | Story | Status |
|---|---|---|---|
| PP-002 | P2 | Mobile: onboarding wizard (first-run flow) | ⏳ |
| PP-003 | P2 | Mobile: read-only subscription view + "manage on web" CTA | ⏳ |
| PP-005 | P2 | Web: push notifications (browser Push API) | ⏳ |
| PP-007 | P1 | Android: push notification verification (FCM token + deep-link tap) | 🔴 PP-006 |
| PP-008 | P1 | Android: app-links verification (`assetlinks.json`, autoVerify) | 🔴 PP-006 + 🧑 |
| PP-009 | P2 | Android: visual QA pass (screenshot every screen vs iOS) | 🔴 PP-006 |
| PP-010 | P2 | Android: document-share intent verification | 🔴 PP-006 |
| PP-011 | P2 | Offline behavior spec + write-queue for journal entries | ⏳ |
| PP-012 | P3 | Consolidate URL scheme (`yourcarelog://` ↔ brand `carelog`) | ⏳ |
| PP-013 | 🧊 P3 | Wear OS companion | Parked for v2 |

---

## 4. Accessibility (A11Y-*)

Full plan + scoring: `docs/project-info/technology/ACCESSIBILITY.md`. Active in §1; overnight-eligible in §2. Remaining:

| ID | Priority | Story |
|---|---|---|
| 🔎 A11Y-005 | P2 | `vitest-axe` assertions on shared web primitives (Card, Button, Input, Label, Dialog) | **PR:** #59 |
| 🔎 A11Y-006 | P2 | Mobile a11y snapshot test per top-level screen (every Pressable has label + role) | **PR:** #63. 15 test files scaffolded; all `it.skip` pending tRPC mock infra. Follow-up: A11Y-011. |
| A11Y-007 | P2 | Lighthouse a11y audit on each Vercel preview via `chrome-devtools-mcp` |
| A11Y-008 | P2 | Extend `mobile-ui` skill with VoiceOver/TalkBack enable/disable + narrate workflow |
| A11Y-009 | P3 | Honor `prefers-reduced-motion` (web) + `AccessibilityInfo.isReduceMotionEnabled()` (mobile) |
| 🟢 A11Y-011 | P2 | Shared tRPC mock provider for mobile test rendering — unblocks A11Y-006 a11y snapshot tests. Build a `renderWithTrpc()` wrapper in `apps/mobile/__tests__/helpers/` that stubs all used tRPC queries with empty-array defaults. **AC:** A11Y-006 test files can `it(...)` instead of `it.skip(...)`. |

---

## 5. Large features (multi-day, not overnight-eligible)

### ON-44 — Comment threads on care events · ~1.5 days
Table `care_event_comments` (author, body, edited_at, deleted_at). RLS mirrors `care_events`. tRPC `careEvents.comments.list/add`. Web: collapsible block beneath each event with count badge. Mobile: tap entry → event detail → comments + composer. Realtime subscription keyed by `care_event_id`. Soft delete only. pgTAP: author-only edit/delete, cross-org cannot read.

### ON-45 — Shift trade requests · ~2 days
Table `shift_trade_requests` (shift_id, requested_by, target_user_id nullable, status, message). Only assignee opens; target-only accept if set, else any caregiver. Acceptance atomically reassigns `shifts.assigned_user_id` + marks accepted in one transaction. Coordinator force-override logs to `audit_events`. Inngest cron `shiftTrades.expire` every 15 min marks ≤24 h stale requests expired + pushes. pgTAP for every state transition.

### ON-46 — Medication tagging + tag filters + document links · ~2.5 days
Junction tables `care_event_medications` and `document_medications` with `confidence ('manual' | 'auto')`. Auto-tag on journal-insert via server-side text-match against org's active meds + common aliases. Auto-tag documents via OCR `extracted_text`. tRPC `medications.listWithStats`, `medications.get` (with linked docs + recent events), tag/untag mutations. Journal + Vault chip-filter bars. Medication detail gains "Linked documents" + "Recent mentions". Server-side only — no PHI emailed out. Auto-tag ≥80% precision on a 10-item synthetic sample. **Blocked by:** ON-10 document FTS / OCR pipeline ✅.

---

## 6. Deferred UI polish (UX-*) — intentionally parked

From `BACKLOG_UI_REDESIGN.md`. Ordered by impact.

### High
- **🔎 UX-01** — Loading skeletons across panels (shadcn Skeleton + Suspense per panel). *Partial mobile coverage via ON-28.* **PR:** #54
- **UX-02** — Illustrated empty states (journal, medications, team, vault). Pairs with copywriter pass.

### Medium
- **UX-04** — Full dark mode via Tailwind `@theme` dark variant + `prefers-color-scheme`.
- **🔎 UX-05** — Mobile-optimized journal entry (bottom-sheet + horizontal mood row). **PR:** #60. BottomSheet + MoodRow; FAB trigger; 852 tests green.
~~- **UX-06** — Sidebar tooltip labels on hover (shadcn `Tooltip`).~~ ✅ Shipped 2026-04-14
- **🔎 UX-07** — Active-panel breadcrumb / dynamic page title ("Dad · Medications"). Needs SidebarContext. **PR:** #53

### Lower
- **UX-08** — Storybook component library (post-launch, when component count warrants).
- **UX-09** — Visual regression testing (Percy/Chromatic or Playwright screenshot diffs) — meaningful *after* dark mode ships.
- **UX-11** — Onboarding flow redesign — low traffic, functional as-is.

---

## 7. Shipped (compact log)

### Phase 1 — Cleanup (2026-04-07)
✅ P1-01 Display names · P1-02 Invite redirect · P1-03 Entry detail route

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
✅ **UX-10** Export page token alignment — `/brief/[token]` + `/care/[token]` migrated from inline hex to design tokens; tinted CardHeader pattern applied
✅ **TD-01** Harden remaining `any` usages (PR #47)
✅ **UX-03** Micro-interactions — card hover lift (`transition-shadow hover:shadow-md`) + button press feedback (`motion-safe:active:scale-[0.97]`) in `card.tsx` + `button.tsx` (branch: feat/ux-03-micro-interactions)
✅ **TD-04** Consolidate `images/` → `apps/web/public/images/` (root dir absent — no-op confirmed)
✅ **UX-06** Sidebar tooltip labels on hover — `TooltipProvider` + `Tooltip`/`TooltipContent side="right"` wrapping icon-only buttons in `SidebarNav` when `showLabels=false` (branch: feat/ux-06-sidebar-tooltips)

---

## 8. Human setup (pre-launch)

Canonical reference: `docs/project-info/runbooks/THIRD_PARTY_SETUP.md`. These tasks require signing into third-party consoles and cannot be automated:

- **Supabase cloud** — project, keys, connection string
- **Vercel** — project + all env vars
- **Sentry** — DSN verification
- **PostHog** — project + key + privacy settings
- **Inngest cloud** — keys + register app post-deploy
- **Resend** — API key + domain verification
- **Stripe** — account + product + prices + webhook endpoint
- **Firebase / FCM** — Android push (`google-services.json` → EAS)
- **Deep-link verification files** — AASA (iOS) + `assetlinks.json` (Android) served from the marketing domain (prerequisite for PP-008)
- **APNs `.p8` key** — via EAS credentials

Claude work that's **gated on the above** (cannot start until the human completes the corresponding step):
- 🧑 **A2** — `supabase link --project-ref <ref>` + `db push` + bucket create + `supabase test db` against cloud *(needs Supabase cloud keys)*
- 🧑 **C3** — update weekly digest FROM address to `notifications@<verified-domain>` *(needs Resend verified domain)*
- 🧑 **PP-008** — Android app-links verification *(needs `assetlinks.json` on a live domain + EAS build SHA-256)*

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
- On a **daily cron** via `/schedule` so the nightly agent sees fresh state
- Any time the §0 status board looks stale

Never delete a story silently — either move to §7 (shipped) or mark 🧊 with a reason.

---

## 11. Overnight-agent contract (what the nightly agent can assume)

- Before picking up any ON-* row, run `/backlog-sync` and claim the row by flipping its `Status:` to `⚡ In progress` + `Owner: nightly` in the first commit
- `pnpm` at the repo root is the entry point; each app has its own workspace scripts
- `supabase start` must be running for any pgTAP test
- macOS host; `./scripts/mobile-ui.sh` is available for any mobile visual check (iOS or Android)
- `/ollama` is available for mechanical fan-out; `/create-migration` for schema work; `/review` before committing RLS/PHI touches
- **Never** skip hooks (`--no-verify`). If a hook fails, investigate — don't bypass
- **Never** commit to `main` — every story lands on a branch + PR
- If a story is blocked by new information discovered mid-work, update the story's `**Blocked by:**` here and stop — don't improvise scope
