# Carelog — Master Backlog

> **This is the single source of truth for all planned work.** Every task — feature, bug, tech debt, infra, polish — is tracked here with a lifecycle status. Read this file **before** starting any task. Update it **immediately** when status changes. If it isn't here, it isn't planned. Run `/backlog-sync` at least once a day (and on session start) to reconcile against git/PRs.

Last consolidated: **2026-04-16** (codebase scan same day). Last `/backlog-sync`: **2026-04-17** (session 03:12).

Replaces: `OVERNIGHT_BACKLOG.md`, `BACKLOG_PHASE2–5.md`, `BACKLOG_UI_REDESIGN.md`, `docs/superpowers/plans/CLAUDE_BACKLOG.md`. `BUILD_STATUS.md` and `TECH_DEBT.md` are **historical logs only** — new work is tracked here.

Human account-signup tasks (Supabase/Vercel/Stripe/etc.) live in `docs/project-info/runbooks/THIRD_PARTY_SETUP.md` and are referenced from §8.

---

## 0. Status board (at-a-glance)

Counts reflect items in §1–§6 only; §7 is the shipped log.

| Lifecycle | Count | Where |
|---|---|---|
| 🟢 Ready | 2 | TD-03 · §3 PP-009 |
| 🔎 In review | 0 | — |
| 🔴 Blocked | 0 | — |
| 🌙 Overnight queue | 0 | — |
| 🧊 Deferred | 5 | §5 ON-55 · §6 UX-08/09/11 · §3 PP-013 |
| 🧑 Needs human | 4 | §5 ON-54 · §8 A2 · C3 · PP-008 |

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
| TD-11 | ✅ Shipped · 2026-04-17 | **data-testid sweep for medication components** | All data-testids already existed in MedicationPanel.tsx + MedicationChecklist.tsx; e2e spec already uses them. No code changes needed. |
| TD-06 | ✅ Shipped · PR #98 | **Add `dark:` variants to ON-44/ON-45 components** | dark: sweep across Comment + TradeRequest components; contrast patch (avatar/badge gray-900+gray-50, fixed hover) committed directly to main. |
| TD-07 | ✅ Shipped · PR #94 | **Alert → Toast sweep** | Replaced 6 `alert()` calls with sonner toasts across JournalClient, settings, subscriptions, TeamAdmin. Invite URL now copies to clipboard before toast. |
| TD-08 | ✅ Shipped · PR #95 | **Supabase types regen + `as any` cleanup** | Regenerated `database.types.ts`; removed 10 `as any` casts from `careEventCommentsRepository.ts`. |
| TD-09 | ✅ Shipped · PR #96 | **ShiftList edit mode** | Added `shifts.update` tRPC mutation + ShiftForm edit-mode props + inline edit panel in ShiftList with `editingShift` state. |
| TD-10 | ✅ Shipped · PR #97 | **JournalClient refactor** | Extracted `useJournalData`, `useOfflineQueue`, `useJournalActions` hooks + `JournalLayout` component. JournalClient.tsx: 624 → 107 lines. |

---

## 2. Overnight queue 🌙

Picked up automatically by the nightly agent. Rules: mark `✅` when done; list `**Blocked by:**` if a prerequisite is still open; one story per `###`; stay under ~4 hrs of work.

All items below are independent (no shared-state conflicts) — the agent may fan out in parallel.

### 🌙 ON-15 — Mobile: accessibility audit (iOS Dynamic Type + VoiceOver)
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

Full plan + scoring: `docs/project-info/technology/ACCESSIBILITY.md`. Active in §1; overnight-eligible in §2. Remaining:

| ID | Priority | Story |
|---|---|---|
| — | — | All A11Y stories shipped; new work tracked in §1. |

---

## 5. Large features (multi-day, not overnight-eligible)

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

### Lower
- **UX-08** — Storybook component library (post-launch, when component count warrants).
- **UX-09** — Visual regression testing (Percy/Chromatic or Playwright screenshot diffs).
- **UX-11** — Onboarding flow redesign — low traffic, functional as-is.

---

## 7. Shipped (compact log)

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
