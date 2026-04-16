# Carelog — Master Backlog

> **This is the single source of truth for all planned work.** Every task — feature, bug, tech debt, infra, polish — is tracked here with a lifecycle status. Read this file **before** starting any task. Update it **immediately** when status changes. If it isn't here, it isn't planned. Run `/backlog-sync` at least once a day (and on session start) to reconcile against git/PRs.

Last consolidated: **2026-04-14** (codebase scan same day). Last `/backlog-sync`: 2026-04-14 (session start × 3).

Replaces: `OVERNIGHT_BACKLOG.md`, `BACKLOG_PHASE2–5.md`, `BACKLOG_UI_REDESIGN.md`, `docs/superpowers/plans/CLAUDE_BACKLOG.md`. `BUILD_STATUS.md` and `TECH_DEBT.md` are **historical logs only** — new work is tracked here.

Human account-signup tasks (Supabase/Vercel/Stripe/etc.) live in `docs/project-info/runbooks/THIRD_PARTY_SETUP.md` and are referenced from §8.

---

## Human Feature Ideas
> Don't make additions here. I will add ideas here when they come to me. Add backlog items as I add them (should add this to the backlog sync). Ask me questions to fill out the design.

- LLM Chatbot agent integrated in UI that can execute actions in the UI, answer questions, analyze data, etc (open to other ways of using an LLM agent in the app, very loose idea here obviously).
- Practical Ways to Use the LLM (Real-World Prompts)
    - Summarize & Stay on Top of Updates
        Ask: “Summarize all new messages and wellness journal entries from the last 48 hours.”
        → Gets a clear overview without scrolling through everything.
    - Messaging the Team
        Ask: “Draft a polite message to the team about grandma’s increased sundowning and request evening help.”
        → Generates ready-to-send messages; you can edit and post directly in the group chat.
    - Managing the Team’s Schedule
        Ask: “Review the calendar for next week and suggest how to cover medication times and meals with available family members.”
        → It analyzes gaps and proposes balanced assignments.
    - Managing Documentation
        Ask: “Find and summarize the latest care plan and any medication changes from uploaded documents.”
        → Quickly locates and condenses key info.
    - Medication Management
        Ask: “Check today’s medication adherence and flag any missed doses or potential interactions from the list.”
        → Pulls data and alerts you proactively.
    - Safety & Remote Monitoring
        Ask: “Analyze recent sensor/motion data — any unusual patterns like night wandering?”
        → Turns raw alerts into actionable insights.
    - Symptom & Wellness Tracking
        Ask: “What trends are showing in grandma’s mood, sleep, and agitation logs this month?”
        → Spots patterns (e.g., sundowning triggers) and suggests simple adjustments.
    - Caregiver Self-Care & Support
        Ask: “I’m feeling overwhelmed today — suggest a quick 10-minute self-care break and breathing exercise.”
        → Provides personalized, on-demand emotional support.
    - Education & Behavior Guidance
        Ask: “Grandma is repeating questions constantly — give me 3 evidence-based strategies for dementia and how to log this in the journal.”
        → Delivers tailored tips without leaving the app.

- Education & Behavior Guidance: Access to dementia-specific tips, behavior management strategies, research updates, or AI-driven advice for handling common challenges.

- Add calendar to shift scheduling page
---

## 0. Status board (at-a-glance)

Counts reflect items in §1–§6 only; §7 is the shipped log.

| Lifecycle | Count | Where |
|---|---|---|
| 🟢 Ready | 2 | §1 · TD-02, TD-03 |
| ⚡ In progress | 1 | §1 · PP-006 |
| 🔎 In review | 7 | §1 · PP-001, PP-004, A11Y-003 · §2 ON-21, ON-26, ON-28, ON-29 |
| 🔴 Blocked | 5 | §2 ON-31 · §3 PP-007–010 |
| 🌙 Overnight queue | 9 | §2 · ON-15, ON-20, ON-27, ON-30, ON-33, ON-37, ON-39, A11Y-004, A11Y-010 |
| 🧊 Deferred | 12 | §6 UX polish (11) + §3 PP-013 |
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
| PP-001 | 🔎 In review · Branch: feat/mobile-team-admin | — | feat/mobile-team-admin | **Mobile: team admin actions** | Mobile `(app)/team` shows members only. Add change-role / remove / re-invite gated on admin role. pgTAP coverage exists already. AC: parity with web `/team/admin`. |
| PP-004 | 🔎 In review | — | feat/pp004-settings · PR #36 | **Web: unified settings hub** | Today scattered across panels. Create `/settings` with profile, notification prefs, timezone, language, danger zone. |
| A11Y-003 | 🔎 In review | — | feat/mobile-a11y-lint | **Mobile: `eslint-plugin-react-native-a11y`** | Add dep, set `recommended`. Matches web approach. |
| A11Y-005 | 🔎 In review | — | feat/a11y-005-vitest-axe | **Web: `vitest-axe` a11y assertions on primitives** | Card, Button, Input test coverage (3 of 5: Label + Dialog components do not yet exist). Tests: 173 passing. Added `vitest-axe` dep. |

### New tech-debt (TD-*) — opened 2026-04-14

| ID | Status | Story | Notes |
|---|---|---|---|
| TD-01 | ✅ Shipped | **Harden `any` remaining usages** | 10 → 0 (100% reduction). `ExportDocument`, `careEvents` router, `export/route` all typed precisely. |
| TD-02 | 🟢 Ready | **Dynamic Type + screen-reader audit (mobile)** | Surfaced in BUILD_STATUS Wave 4. Physical device required. Supersedes the BUILD_STATUS checkbox — track here. |
| TD-03 | 🟢 Ready | **Sentry source maps upload** | BUILD_STATUS: "source maps pending `SENTRY_AUTH_TOKEN`". Needs 🧑 env var in Vercel. |
| TD-04 | ✅ Shipped | **Consolidate `images/` → `apps/web/public/images/`** | Root `images/` dir already absent — nothing to move. |

---

## 2. Overnight queue 🌙

Picked up automatically by the nightly agent. Rules: mark `✅` when done; list `**Blocked by:**` if a prerequisite is still open; one story per `###`; stay under ~4 hrs of work.

All items below are independent (no shared-state conflicts) — the agent may fan out in parallel.

### 🌙 ON-15 — Mobile: accessibility audit (iOS Dynamic Type + VoiceOver)
**Why:** Mobile uses fixed `fontSize` throughout; never tested against 200% Dynamic Type or VoiceOver navigation order.
**Work:** Run app under max Larger Accessibility Sizes on journal/medications/schedule; migrate fixed sizes to `PixelRatio.getFontScale()` capped at 1.5×. VoiceOver-complete a medication-log flow end-to-end. File follow-up ON-XX for issues deferred.
**AC:** app usable at 200% DT on 3 key screens; VoiceOver finishes the med-log flow.
**Size:** ~1 day. **Blocked by:** nothing.

### ✅ ON-20 — Mobile `accessibilityLabel` sweep on icon-only / emoji buttons
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

### 🔎 ON-30 — JSDoc on public exports in `packages/shared`
One-line JSDoc on each exported function/type where purpose isn't obvious. Do NOT invent behavior. **Size:** 2 hr.

### 🌙 ON-31 — E2E: settings page notification prefs
Write `e2e/notification-preferences.spec.ts`: sign-in, toggle pref, reload, assert persisted. Follow `e2e/CLAUDE.md`. **Size:** 2 hr. **Blocked by:** PP-004 (if settings page is the new hub).

### ✅ ON-32 — E2E: invite-accept happy path
Write `e2e/invite-accept.spec.ts` using multi-context pattern. Coordinator creates invite → second browser accepts → lands on dashboard with correct role. Cover expired-invite rejection as secondary. **Size:** 3 hr.

### 🔎 ON-33 — Mobile: Sentry breadcrumbs on tRPC errors
Add breadcrumb with procedure name + operation type (NEVER input values — PHI). Scrub `email`, `name`, free-text. Verify by triggering an error. **Size:** 2 hr.

### ✅ ON-34 — PostHog funnel events: web ↔ mobile parity audit
Grep both apps for `posthog.capture(` calls; produce diff table at `docs/project-info/technology/ANALYTICS_EVENTS.md`. Report only — no new events. **Size:** 1 hr.

### ✅ 🌙 ON-35 — `.gitignore` hygiene
Add `apps/web/sonar-report.xml` + `.memsearch/` to root `.gitignore`; `git rm --cached` both. Verify no other generated artifacts remain tracked. **Size:** 15 min.

### ✅ ON-36 — TODO/FIXME audit + backlog backfill
Grep `TODO|FIXME|XXX|HACK` across apps/packages/supabase. Classify: resolve <10 min, convert to new backlog entry (reference ID in comment), or delete if obsolete. Report at `docs/project-info/technology/TODO_AUDIT.md`. **Size:** 2 hr.

### 🌙 ON-37 — `ts-prune` unused exports sweep
`pnpm dlx ts-prune -p apps/web/tsconfig.json` and mobile. Annotate false positives, delete true orphans. Verify with grep across all apps before deleting workspace `index.ts` exports. **AC:** report reduced ≥50%. **Size:** 3 hr.

### ✅ 🌙 ON-38 — Dependency freshness report
`pnpm outdated -r` + `pnpm audit --prod`. Write `docs/project-info/technology/DEPENDENCY_AUDIT.md`: advisories, major lags, recommended upgrade order. Report only. **Size:** 1 hr.

### 🔎 ON-39 — Eliminate `any` types
Grep `: any\b|<any>|as any` in apps/packages. Replace with precise type or `unknown` + narrowing. Do NOT disable ESLint rule. **AC:** `any` count reduced ≥80%. **Size:** 4 hr.

### ✅ ON-40 — Vitest flake detection + quarantine
Run `pnpm test` 5×; `.skip` any intermittent failure with `// FLAKY: ON-XX` linking new story. Report at `docs/project-info/technology/FLAKE_REPORT.md`. **Size:** 2 hr.

### ✅ ON-41 — Audit stale snapshot tests
Review each `__snapshots__` dir. Replace full-tree snapshots with targeted assertions where feasible. **AC:** no snapshot >100 lines without a justification comment. **Size:** 3 hr.

### ✅ 🌙 ON-42 — Next.js caching directive audit
Grep `export const dynamic|revalidate|fetchCache` in `apps/web/app`. Verify each matches intent (auth = dynamic, marketing = static). Report at `docs/project-info/technology/CACHING_AUDIT.md`. Report only. **Size:** 2 hr.

### ⚡ A11Y-004 — Token contrast validator script
Write `scripts/a11y-contrast.mjs` that parses `apps/web/app/globals.css` `@theme inline` tokens, checks WCAG ratios for ink/bg pairings (≥4.5:1 text, ≥3:1 large/borders), exits non-zero on violation. Wire into `pnpm lint`. **Size:** ~1 hr.

### ✅ A11Y-010 — Add colorblindness walkthrough to UI review checklist
Amend `.claude/rules/ui-standards.md` with a "run key screens through Chrome DevTools' colorblind simulator" step. **Size:** 15 min.

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
| A11Y-005 | P2 | `vitest-axe` assertions on shared web primitives (Card, Button, Input, Label, Dialog) |
| A11Y-006 | P2 | Mobile a11y snapshot test per top-level screen (every Pressable has label + role) |
| A11Y-007 | P2 | Lighthouse a11y audit on each Vercel preview via `chrome-devtools-mcp` |
| A11Y-008 | P2 | Extend `mobile-ui` skill with VoiceOver/TalkBack enable/disable + narrate workflow |
| A11Y-009 | P3 | Honor `prefers-reduced-motion` (web) + `AccessibilityInfo.isReduceMotionEnabled()` (mobile) |

---

## 5. Large features (multi-day, not overnight-eligible)

### ON-43 — In-app messaging (DM + group) · ~3 days
Tables `message_threads`, `message_thread_members`, `messages` (all org-scoped, RLS via `org_memberships`). tRPC `messagesRouter` (listThreads, getThread, sendMessage, createDm, createGroup, markRead). Supabase Realtime on `messages` filtered by thread membership. Web `/messages` shell + composer; mobile 2-screen list + inverted FlatList. Push on new message when `last_read_at < last_message_at` AND pref enabled. pgTAP RLS for all cases. DM creation idempotent (same user → same thread). **Split:** schema/RLS · web UI · mobile UI + push.

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
- **UX-01** — Loading skeletons across panels (shadcn Skeleton + Suspense per panel). *Partial mobile coverage via ON-28.*
- **UX-02** — Illustrated empty states (journal, medications, team, vault). Pairs with copywriter pass.
- **UX-03** — Micro-interactions (card hover lift, mood press, sidebar active, toasts). Tailwind `transition` + Radix animation primitives.

### Medium
- **UX-04** — Full dark mode via Tailwind `@theme` dark variant + `prefers-color-scheme`.
- **UX-05** — Mobile-optimized journal entry (bottom-sheet + horizontal mood row).
- **UX-06** — Sidebar tooltip labels on hover (shadcn `Tooltip`).
- **UX-07** — Active-panel breadcrumb / dynamic page title ("Dad · Medications"). Needs SidebarContext.

### Lower
- **UX-08** — Storybook component library (post-launch, when component count warrants).
- **UX-09** — Visual regression testing (Percy/Chromatic or Playwright screenshot diffs) — meaningful *after* dark mode ships.
- **UX-10** — Export styling (`/brief/[token]`, `/care/[token]`) — align read-only share pages with token system.
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

### A11Y tooling + messaging (2026-04-14)
✅ A11Y-001 `@axe-core/playwright` wired into e2e `afterEach`, fails on serious/critical · A11Y-002 `eslint-plugin-jsx-a11y` at `error` for alt-text, keyboard, static-element rules (PR #39) · ON-43 In-app messaging: DM + group threads, Supabase Realtime, read receipts, delayed push via Inngest, full pgTAP RLS (PR #49)

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
