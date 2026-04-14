# Overnight Backlog

Stories in this file are picked up by the nightly development agent (runs 2am Chicago / 8am UTC).

## Format rules
- Mark completed stories `✅ DONE` — the agent skips them
- List prerequisites in `**Blocked by:**` — agent skips blocked stories
- One story per `###` heading with a unique ID (e.g. `ON-20`)

## Sequencing Overview

```
ON-15 Mobile a11y audit (Dynamic Type + VoiceOver) ─── carried over, needs device time
ON-20 Mobile accessibilityLabel sweep              ─── no deps, mechanical
ON-21 Web raw-hex audit + token migration          ─── no deps, mechanical
ON-22 pgTAP RLS test — notification_preferences    ─── no deps
ON-23 pgTAP RLS test — care_recipients             ─── no deps
ON-24 pgTAP RLS test — mood_entries                ─── no deps
ON-25 Zod schema tests for shared validators       ─── no deps
ON-26 Mobile empty-state copy pass                 ─── no deps
ON-27 Web alt-text audit                           ─── no deps, mechanical
ON-28 Mobile loading skeletons on list screens     ─── no deps
ON-29 Replace console.log with logger in apps/web  ─── no deps, mechanical
ON-30 Add JSDoc to shared packages/                ─── no deps
ON-31 E2E: settings page notification prefs        ─── no deps
ON-32 E2E: invite-accept happy path                ─── no deps
ON-33 Mobile: Sentry breadcrumbs on tRPC errors    ─── blocked by ON-17 (done)
ON-34 PostHog funnel events parity audit           ─── no deps
ON-35 .gitignore sonar-report.xml + .memsearch     ─── no deps, quick hygiene
ON-36 TODO/FIXME audit + ticket backfill           ─── no deps, report-only
ON-37 ts-prune unused exports sweep                ─── no deps
ON-38 Dependency freshness report                  ─── no deps, report-only
ON-39 Eliminate `any` types audit                  ─── no deps
ON-40 Vitest flakes: quarantine + log              ─── no deps
ON-41 Migrate stale snapshot tests                 ─── no deps
ON-42 Next.js `dynamic = "force-dynamic"` audit    ─── no deps, report
ON-43 In-app messaging (DM + group)                ─── HIGH complexity
ON-44 Comment threads on journal events            ─── MEDIUM
ON-45 Shift trade requests                         ─── MEDIUM
ON-46 Medication tagging + tag filters + doc links ─── MEDIUM-HIGH
```

All unblocked stories are independent — agent may run in parallel.

---

## Stories

---

### ON-15 — Mobile: accessibility audit against iOS Dynamic Type + screen reader

**Context:** Mobile uses fixed `fontSize` values throughout and isn't tested against iOS Dynamic Type. No verification that VoiceOver / TalkBack announce controls in a sensible order.

**Technical details:**
- Run app under iOS Dynamic Type (Larger Accessibility Sizes, max) on a physical device. Log every truncated / overlapping surface.
- For each `fontSize: N`, migrate to scaling via `PixelRatio.getFontScale()` or a `scaledSize()` helper capped at 1.5x.
- Run with VoiceOver + TalkBack: verify every `TouchableOpacity` has `accessibilityLabel`, focus order sensible, headings use `accessibilityRole="header"`.
- Fix top 3–5 issues; create follow-ups for the rest.

**Acceptance criteria:**
- [ ] App usable at 200% Dynamic Type on journal, medications, schedule
- [ ] VoiceOver can complete medication log flow end-to-end
- [ ] Report of remaining issues appended as ON-XX follow-ups

**Blocked by:** nothing
**Size:** ~1 day

---

### ON-20 — Mobile `accessibilityLabel` sweep on icon-only / emoji buttons

**Context:** Per `apps/mobile/CLAUDE.md`, every icon-only or emoji-only `TouchableOpacity`/`Pressable` must declare `accessibilityLabel` and `accessibilityRole="button"`. A grep across `apps/mobile/app` reveals many still missing.

**Instructions:**
1. `grep -rn "TouchableOpacity\|Pressable" apps/mobile/app | head`
2. For each match whose children render only an icon/emoji, add:
   - `accessibilityLabel="<short verb phrase>"`
   - `accessibilityRole="button"`
3. Keep text-bearing buttons as-is (their text is the accessible name).
4. Do NOT alter layout, navigation, or handlers.

**Acceptance criteria:**
- [ ] `grep` returns no icon-only interactive elements lacking `accessibilityLabel`
- [ ] `cd apps/mobile && pnpm test` passes
- [ ] `pnpm typecheck` clean

**Blocked by:** nothing
**Size:** ~2 hours

---

### ON-21 — Web: raw-hex audit + token migration

**Context:** Per `.claude/rules/ui-standards.md`: "Never write raw hex in a component file." Some legacy components under `apps/web/app/` still inline hex values.

**Instructions:**
1. `grep -rn "#[0-9a-fA-F]\{3,8\}" apps/web/app apps/web/components` — produce report
2. For each finding, replace with the closest `var(--color-*)` token from `apps/web/app/globals.css`
3. If no close token exists, STOP for that file and add a note in the PR description — do NOT invent a token
4. Skip `.svg`, `.ico`, and files under `public/`

**Acceptance criteria:**
- [ ] No raw hex in `.tsx`/`.ts` under `apps/web/app` or `apps/web/components` (except documented exceptions)
- [ ] Visual spot-check on dashboard, journal, billing
- [ ] `pnpm typecheck` + `pnpm test` green

**Blocked by:** nothing
**Size:** ~3 hours

---

### ON-22 — pgTAP RLS test: `notification_preferences`

**Context:** `notification_preferences` table has an owner-only RLS policy. No pgTAP coverage today.

**Instructions:**
- Follow `supabase/tests/expenses_rls.test.sql` as template
- Read `supabase/CLAUDE.md` for conventions (4-arg `throws_ok`)
- Cases: owner select/update self (pass), cross-user select/update (blocked), anon blocked

**Files to create:**
- `supabase/tests/notification_preferences_rls.test.sql`

**Acceptance:** `supabase test db` passes with new file included.

**Blocked by:** nothing
**Size:** ~1 hour

---

### ON-23 — pgTAP RLS test: `care_recipients`

**Context:** `care_recipients` is the root of org scoping. Coverage gap must be closed before any multi-tenant launch.

**Instructions:**
- Template: closest existing `*_rls.test.sql` with org membership checks
- Cases: org member can select; non-member cannot select; only coordinator can insert/update/delete; anon blocked on all ops

**Files to create:**
- `supabase/tests/care_recipients_rls.test.sql`

**Acceptance:** `supabase test db` passes with all 5+ assertions.

**Blocked by:** nothing
**Size:** ~1.5 hours

---

### ON-24 — pgTAP RLS test: `mood_entries`

**Context:** Mood entries are PHI and need tight org-scoped RLS coverage.

**Instructions:**
- Cases: org member can read mood entries for recipients in their org; cannot read other orgs'; only the author can update/delete their own entry; anon blocked

**Files to create:**
- `supabase/tests/mood_entries_rls.test.sql`

**Acceptance:** `supabase test db` passes.

**Blocked by:** nothing
**Size:** ~1.5 hours

---

### ON-25 — Zod schema tests for shared validators

**Context:** `packages/shared/src/schemas/` (or equivalent) holds Zod schemas reused across web + mobile. Some lack unit tests; a regression here silently breaks both apps.

**Instructions:**
1. `find packages -name "*.ts" -path "*schema*"` to enumerate
2. For each schema without a matching `.test.ts`, write a minimal vitest: one valid case + 2–3 invalid edge cases (missing required, wrong type, boundary violations)
3. Follow existing test patterns in the package

**Acceptance:**
- [ ] Every exported schema in `packages/shared` has a test file
- [ ] `pnpm test` green

**Blocked by:** nothing
**Size:** ~3 hours

---

### ON-26 — Mobile empty-state copy pass

**Context:** Per UX rules, empty states must "explain why there's nothing + offer a next action. No bare 'No data.'". Several mobile screens still show terse placeholders.

**Instructions:**
1. Grep mobile screens for literal strings: "No data", "Nothing here", "Empty", "No results"
2. For each, rewrite in the Carelog voice (see `docs/project-info/product/UX_DECISIONS.md` for tone) with a concrete next action CTA
3. Keep visual layout identical

**Acceptance:**
- [ ] Every list/section in mobile has an empty state with explanation + CTA
- [ ] `cd apps/mobile && pnpm test` green

**Blocked by:** nothing
**Size:** ~2 hours

---

### ON-27 — Web alt-text audit

**Context:** Per UI standards: every `<Image>` / `<img>` needs meaningful `alt`; decoratives use `alt="" aria-hidden="true"`.

**Instructions:**
1. `grep -rn "<Image\|<img " apps/web/app apps/web/components`
2. For each, verify `alt` present and meaningful; fix violations
3. Decorative illustrations get `alt="" aria-hidden="true"`

**Acceptance:**
- [ ] `eslint --rule 'jsx-a11y/alt-text: error'` clean for web
- [ ] `pnpm typecheck` + `pnpm test` green

**Blocked by:** nothing
**Size:** ~1 hour

---

### ON-28 — Mobile: loading skeletons on list screens

**Context:** List screens currently show a centered spinner during initial load. Skeletons read more polished and reduce perceived latency.

**Instructions:**
1. Add a reusable `<Skeleton>` component in `apps/mobile/components/Skeleton.tsx` (animated opacity, token-driven colors via `useAppTheme()`)
2. Use in `journal/index.tsx`, `medications/index.tsx`, `documents/index.tsx`, `team/index.tsx` for the list region
3. Keep spinner for non-list async states (submit buttons, etc.)

**Acceptance:**
- [ ] Four list screens render skeleton rows on initial load
- [ ] Respects dark mode via `useAppTheme()`
- [ ] Mobile Jest green

**Blocked by:** nothing
**Size:** ~3 hours

---

### ON-29 — Replace `console.log` with logger in `apps/web`

**Context:** Stray `console.log` calls leak into production bundles. Web has a structured logger; use it everywhere.

**Instructions:**
1. `grep -rn "console\.\(log\|warn\|error\)" apps/web/app apps/web/lib apps/web/server`
2. Replace with the project logger (check `apps/web/lib/logger.ts` or equivalent)
3. Skip test files and scripts

**Acceptance:**
- [ ] No `console.*` in production web source (tests/scripts excluded)
- [ ] `pnpm lint` clean
- [ ] `pnpm test` green

**Blocked by:** nothing
**Size:** ~1 hour

---

### ON-30 — Add JSDoc to public exports in `packages/shared`

**Context:** Shared package exports lack doc comments, making editor autocomplete less useful across web + mobile.

**Instructions:**
- For each exported function/type in `packages/shared/src`, add a one-line JSDoc describing purpose (not implementation)
- Skip obvious names (`isString`) — only doc where usage isn't self-evident
- Do NOT invent behavior; read the implementation

**Acceptance:**
- [ ] Public exports in `packages/shared` have JSDoc where non-obvious
- [ ] `pnpm typecheck` green

**Blocked by:** nothing
**Size:** ~2 hours

---

### ON-31 — E2E: settings page notification preferences

**Context:** Notification prefs page has unit tests but no end-to-end flow coverage.

**Instructions:**
1. Read `apps/web/app/(app)/settings/notifications/` (or similar) first
2. Write `e2e/notification-preferences.spec.ts`: sign in, toggle a pref, reload, assert persisted
3. Follow `e2e/CLAUDE.md` conventions

**Acceptance:**
- [ ] `pnpm exec playwright test e2e/notification-preferences.spec.ts` passes

**Blocked by:** nothing
**Size:** ~2 hours

---

### ON-32 — E2E: invite-accept happy path

**Context:** Invite creation flow has been hardened but invite acceptance has no E2E test.

**Instructions:**
1. Read invite creation + acceptance route handlers
2. Write `e2e/invite-accept.spec.ts`: coordinator creates invite, second browser context visits invite URL, accepts, lands on dashboard with correct role
3. Use Playwright multi-context pattern

**Acceptance:**
- [ ] `pnpm exec playwright test e2e/invite-accept.spec.ts` passes
- [ ] Test covers expired invite rejection as secondary case

**Blocked by:** nothing
**Size:** ~3 hours

---

### ON-33 — Mobile: Sentry breadcrumbs on tRPC errors

**Context:** ON-17 wired Sentry but tRPC client errors currently surface as generic `Error: query failed` events without context. Add a tRPC link that records a breadcrumb with the procedure name and input shape (no PII).

**Instructions:**
1. Add a Sentry breadcrumb in the tRPC error link: procedure path, operation type — NEVER the input values (could be PHI)
2. Scrub `email`, `name`, and free-text fields before any breadcrumb is added
3. Verify by intentionally triggering a tRPC error and checking the Sentry event

**Acceptance:**
- [ ] Sentry events from mobile include procedure breadcrumbs
- [ ] No PII in breadcrumb data
- [ ] Mobile Jest green

**Blocked by:** ON-17 (done)
**Size:** ~2 hours

---

### ON-34 — PostHog funnel events: web ↔ mobile parity audit

**Context:** ON-18 wired PostHog on mobile. We need a documented list confirming the same event names fire from both platforms so cross-platform funnels work.

**Instructions:**
1. Grep `apps/web` for all `posthog.capture(` calls — list event names
2. Grep `apps/mobile` for the same — list event names
3. Produce a diff table in `docs/project-info/technology/ANALYTICS_EVENTS.md` showing web-only, mobile-only, both
4. Do NOT add new events in this story — scope is report only

**Acceptance:**
- [ ] `ANALYTICS_EVENTS.md` created with diff table
- [ ] Follow-up stories filed for any unintentional gaps

**Blocked by:** nothing
**Size:** ~1 hour

---

### ON-35 — `.gitignore` `sonar-report.xml` + `.memsearch/`

**Context:** `git status` shows `apps/web/sonar-report.xml` and `.memsearch/memory/2026-04-13.md` as modified — machine-generated, should never be committed.

**Instructions:**
1. Add to root `.gitignore`: `apps/web/sonar-report.xml`, `.memsearch/`
2. `git rm --cached apps/web/sonar-report.xml .memsearch/memory/*.md`
3. Verify no other generated artifacts remain tracked

**Acceptance:**
- [ ] Files untracked; `git status` clean after sonar/memsearch runs

**Blocked by:** nothing
**Size:** ~15 min

---

### ON-36 — TODO/FIXME audit + backlog backfill

**Context:** TODO/FIXME comments accumulate silently.

**Instructions:**
1. `grep -rn "TODO\|FIXME\|XXX\|HACK" apps packages supabase --include="*.ts" --include="*.tsx" --include="*.sql"`
2. Classify each: resolve in <10 min, convert to new `ON-XX` entry (update comment to reference ID), or delete if obsolete
3. Summary at `docs/project-info/technology/TODO_AUDIT.md`

**Acceptance:**
- [ ] Report committed with counts by category
- [ ] Every remaining TODO references an ON-XX ticket

**Blocked by:** nothing
**Size:** ~2 hours

---

### ON-37 — `ts-prune` unused exports sweep

**Instructions:**
1. `pnpm dlx ts-prune -p apps/web/tsconfig.json` and `-p apps/mobile/tsconfig.json`
2. Annotate false positives ("used in module"); delete true orphans
3. Do NOT delete exports from workspace `index.ts` consumed elsewhere — verify with grep across all apps

**Acceptance:**
- [ ] `ts-prune` report reduced ≥50%
- [ ] `pnpm typecheck` + `pnpm test` green

**Blocked by:** nothing
**Size:** ~3 hours

---

### ON-38 — Dependency freshness report

**Instructions:**
1. `pnpm outdated -r` and `pnpm audit --prod` — capture output
2. Write `docs/project-info/technology/DEPENDENCY_AUDIT.md`: security advisories, major lags, recommended upgrade order
3. Do NOT upgrade anything — report only

**Acceptance:**
- [ ] Report committed
- [ ] Each security advisory has a follow-up ON-XX ticket

**Blocked by:** nothing
**Size:** ~1 hour

---

### ON-39 — Eliminate `any` types

**Context:** Per CLAUDE.md: "Don't use `any` type without explicit approval."

**Instructions:**
1. `grep -rn ": any\b\|<any>\|as any" apps packages --include="*.ts" --include="*.tsx"`
2. Replace each with precise type or `unknown` + narrowing
3. Do NOT disable ESLint rule to sweep under the rug

**Acceptance:**
- [ ] `any` count reduced ≥80%
- [ ] `pnpm typecheck` + `pnpm test` green

**Blocked by:** nothing
**Size:** ~4 hours

---

### ON-40 — Vitest flake detection + quarantine

**Instructions:**
1. Run `pnpm test` 5 times; diff pass/fail sets
2. For any test that failed ≥1, `.skip` with `// FLAKY: ON-XX` comment linking new backlog story
3. Report at `docs/project-info/technology/FLAKE_REPORT.md`

**Acceptance:**
- [ ] `pnpm test` passes 5/5 after quarantine
- [ ] Every skipped test has an ON-XX follow-up

**Blocked by:** nothing
**Size:** ~2 hours

---

### ON-41 — Audit stale snapshot tests

**Instructions:**
1. `find . -name "__snapshots__" -type d`
2. Review each; replace full-tree snapshots with targeted assertions where feasible
3. Regenerate intentionally-kept snapshots with `pnpm test -u`

**Acceptance:**
- [ ] No snapshot >~100 lines without a justification comment
- [ ] `pnpm test` green

**Blocked by:** nothing
**Size:** ~3 hours

---

### ON-42 — Next.js caching directive audit

**Context:** Routes may be over- or under-cached. Auth-calling server components should be dynamic; pure reads can be static/ISR.

**Instructions:**
1. Grep `apps/web/app` for `export const dynamic`, `revalidate`, `fetchCache`
2. Verify each matches intent (auth = dynamic, marketing = static)
3. Report at `docs/project-info/technology/CACHING_AUDIT.md`: route → directive → recommendation
4. Do NOT change directives — report only

**Acceptance:**
- [ ] Report committed; flagged routes have follow-up ON-XX tickets

**Blocked by:** nothing
**Size:** ~2 hours

---

### ON-43 — In-app messaging for teams (DM + group)

**Context:** Today the only communication surface in Carelog is the care journal. Families still fall back to group texts for side conversations ("can you cover Tuesday?", "quick question about dad's insurance"), which splinters context away from the app. Add first-class messaging so threads live alongside the rest of the care record — without polluting the journal.

**Technical details:**
- New tables (all org-scoped, RLS enforced via `org_memberships`):
  - `message_threads` — `id, org_id, kind ('dm' | 'group'), title (nullable for dm), created_by, created_at, last_message_at`
  - `message_thread_members` — `thread_id, user_id, role ('member' | 'admin'), joined_at, last_read_at`
  - `messages` — `id, thread_id, author_id, body text, created_at, edited_at, deleted_at`
- RLS: user can read a thread only if they are a `message_thread_members` row AND share an org membership with the thread. Writes follow same rule.
- tRPC router `messagesRouter`: `listThreads`, `getThread(threadId, cursor)`, `sendMessage`, `createDm(userId)`, `createGroup(name, memberIds)`, `markRead(threadId)`.
- Realtime via Supabase Realtime on the `messages` table, filtered by thread membership.
- Web UI: `/messages` shell with thread list on the left, active thread on the right; composer with Enter-to-send; unread badges on sidebar nav.
- Mobile UI: two screens — thread list and thread view (FlatList with inverted prop for chat style).
- Push notifications on new message when `last_read_at` < `last_message_at` AND recipient has `messages` notification pref enabled.
- pgTAP tests for all RLS cases (owner read own thread, non-member blocked, cross-org blocked, anon blocked).

**Acceptance criteria:**
- [ ] Migration + pgTAP coverage for both tables
- [ ] DM creation is idempotent (selecting the same user twice returns the existing thread)
- [ ] Unread count accurate across web + mobile
- [ ] Realtime updates arrive within ~1s on both platforms
- [ ] Push notification fires only for users with pref enabled
- [ ] No PII in analytics events beyond UUIDs

**Blocked by:** nothing
**Blocks:** nothing
**Size:** ~3 days (split across 2–3 PRs: schema/RLS, web UI, mobile UI + push)

---

### ON-44 — Comment threads on care events in Journal

**Context:** A journal entry often prompts a short back-and-forth ("did she actually eat it?", "should I flag for the doctor?"). Today those conversations happen off-platform. Attach lightweight comment threads to every care event so the discussion lives with the event it's about.

**Technical details:**
- New table `care_event_comments`: `id, care_event_id (fk care_events), author_id, body, created_at, edited_at, deleted_at`
- RLS mirrors `care_events`: if you can read the event, you can read its comments; you can only update/delete your own comment.
- tRPC `careEvents.comments.list(eventId)` and `careEvents.comments.add({ eventId, body })`.
- Web: collapsible comment block beneath each event in `JournalFeed`; shows a count badge when collapsed. Composer is a single-line expander that grows to a textarea.
- Mobile: tap a journal entry → event detail screen → comments list + composer.
- Realtime subscription on `care_event_comments` keyed by `care_event_id` for the active feed window.
- Soft delete only (keep audit trail per `docs/project-info/technology/SECURITY_MODEL.md`).
- pgTAP tests: author can edit/delete own, non-author cannot, cross-org cannot read.

**Acceptance criteria:**
- [ ] Comment count badge matches actual count
- [ ] Edit + delete only available on own comments
- [ ] Comments render inline on web and on the event detail screen on mobile
- [ ] Realtime updates in both clients
- [ ] pgTAP green for RLS on the new table

**Blocked by:** nothing
**Blocks:** nothing
**Size:** ~1.5 days

---

### ON-45 — Shift trade requests

**Context:** The shifts scheduler supports creating and cancelling shifts but not transferring them. A caregiver who needs to swap a Tuesday evening has to cancel and hope the coordinator notices and re-fills. Add a first-class trade-request flow so swaps happen cleanly without dropping coverage.

**Technical details:**
- New table `shift_trade_requests`: `id, shift_id, requested_by, target_user_id (nullable — null means "open to anyone"), status ('pending' | 'accepted' | 'declined' | 'cancelled' | 'expired'), message text, created_at, resolved_at`
- Business rules:
  - Only the shift assignee can open a request.
  - If `target_user_id` is set → only that user can accept.
  - If null → any org member with the right role (caregiver) can accept.
  - Acceptance atomically reassigns the `shifts.assigned_user_id` and marks the request `accepted` (single transaction).
  - Coordinator can force-override at any time.
  - Requests auto-expire 24h before shift start.
- tRPC `shiftTrades.request`, `shiftTrades.accept`, `shiftTrades.decline`, `shiftTrades.cancel`, `shiftTrades.list`.
- Web: button on each of your upcoming shifts "Request trade"; Trades inbox shows pending requests you can accept.
- Mobile: same, plus push notification to target user (or to all eligible users for open requests).
- Inngest cron `shiftTrades.expire` runs every 15 min, marks stale requests expired and pushes a notification to the original requester.
- pgTAP: only assignee can request; only target (or any caregiver if open) can accept; coordinator can override; acceptance updates shift + request in one tx.

**Acceptance criteria:**
- [ ] Accepting a trade reassigns the shift atomically (no ghost windows where both users are assigned)
- [ ] Push notification fires on request, on accept, and on expiry
- [ ] Coordinator override logs to `audit_events`
- [ ] pgTAP tests green for all state transitions

**Blocked by:** nothing
**Blocks:** nothing
**Size:** ~2 days

---

### ON-46 — Medication tagging + tag filters + document links

**Context:** As a care circle accumulates months of journal entries and documents, finding "everything about gabapentin" is painful. Add medication-aware tagging: care events and documents that mention a specific medication can be tagged with it, the Journal and Vault can filter by tag, and each medication's detail page surfaces the linked documents and recent mentions.

**Technical details:**
- New junction tables:
  - `care_event_medications` — `care_event_id, medication_id, confidence ('manual' | 'auto'), created_at`
  - `document_medications` — `document_id, medication_id, confidence, created_at`
- Both tables inherit org scoping via the parent table's RLS (add pgTAP coverage).
- Auto-tagging:
  - On journal entry insert, run a lightweight server-side text match against the org's active medication names + common aliases (e.g. "gaba" → gabapentin). Insert `confidence='auto'` links.
  - On document OCR (reuse the existing pipeline from ON-10), run the same matcher against `extracted_text`.
  - Manual tag UI lets a user add/remove tags regardless of auto matches.
- tRPC:
  - `medications.listWithStats` — returns each med with counts of linked events + linked docs in the last 30 days
  - `medications.get(medicationId)` — returns the med plus its linked documents and recent events (paginated)
  - `careEvents.tagMedication` / `untagMedication`
  - `documents.tagMedication` / `untagMedication`
- Journal filter bar: chip list of medications in the org; selecting one filters the feed to events tagged with that med.
- Vault filter: same chip list filters document list.
- Medication detail page (web + mobile): adds a "Linked documents" section + a "Recent mentions" feed.
- Do NOT let auto-tagging email-out PHI: all matching happens server-side against the user's own org data.

**Acceptance criteria:**
- [ ] Tagging survives round-trip edit/delete
- [ ] Filter chips update counts live as events are added
- [ ] Auto-tag precision spot-checked on 10 synthetic entries: ≥80% correct matches, no false positives on unrelated words
- [ ] Document → medication link appears on both sides (medication detail AND document detail)
- [ ] pgTAP: non-org member cannot read junction rows; only coordinators can force-untag another user's manual tag
- [ ] Web + mobile filter UIs consistent

**Blocked by:** ON-10 (document FTS / OCR pipeline — shipped)
**Blocks:** nothing
**Size:** ~2.5 days
