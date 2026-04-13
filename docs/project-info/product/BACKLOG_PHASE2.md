# Carelog — Phase 2 Backlog ✅ done

**As of:** 2026-04-07 (codebase scan: 2026-04-07)
**Phase:** Scheduler (shifts, coverage, gap detection)
**Prerequisite:** Phase 1 cleanup stories (P1-01–P1-03) must ship first.

**Scan summary:** P1-01 ✅ done | P1-02 ✅ done | P1-03 ✅ done | P2-01 ✅ done | P2-02 ✅ done | P2-03 ✅ done | P2-04 ✅ done | P2-05 ✅ done | P2-06 ✅ done | P2-07 ✅ done

---

## Sequencing Overview

```
P1-01 Display names → unblocks P1-03, P2-02, P2-03
P1-02 Invite redirect → unblocks P1-03
P1-03 Entry detail → ships independently after P1-01

P2-01 Shift model + tRPC → foundation for all Phase 2 UI
P2-02 Shift creation UI → needs P1-01, P2-01
P2-03 Shift list / caregiver view → needs P2-02
P2-04 Coverage window UI → needs P2-01
P2-05 Gap detector (Inngest) → needs P2-04
P2-06 Recurring shifts → needs P2-02, P2-05
P2-07 Shift digest section → needs P2-03, weekly digest already wired
```

---

## Phase 1 Cleanup (blocking Phase 2)

---

### ~~P1-01 — Display name resolution~~ ✅ DONE

**Scan findings:**

- `apps/web/app/api/members/route.ts` joins `user_profiles` in a batch query and returns `display_name`
- `apps/web/app/journal/[recipientId]/TeamPanel.tsx` renders `member.display_name` with "Team member" fallback

No further work needed.

**Blocked by:** nothing
**Blocks:** P1-03, P2-02, P2-03

---

### P1-02 — Pending invite redirect after sign-in ⚠️ PARTIAL

**Agent:** Continue.dev / Qwen3.5

**Scan findings:**

- `apps/web/app/invite/[token]/page.tsx` line 40 — saves token to `sessionStorage` as `pending_invite` ✅
- `apps/web/app/dashboard/DashboardClient.tsx` lines 32–38 — checks `pending_invite`, removes it, redirects to `/invite/TOKEN` ✅
- `apps/web/app/onboarding/OnboardingForm.tsx` — redirects to `/dashboard` after onboarding, does NOT check sessionStorage ❌

**Remaining work (one file only):**

- `apps/web/app/onboarding/OnboardingForm.tsx` — after redirect to `/dashboard`, check `sessionStorage.getItem('pending_invite')` and redirect to `/invite/TOKEN` instead

**Business impact:** New users (first invite ever) complete onboarding then land on dashboard — token is consumed by DashboardClient correctly. But if onboarding redirects elsewhere, the token could be missed. Verify the DashboardClient redirect fires reliably for new users before closing this.

**Acceptance criteria:**

- [ ] New user: completes onboarding → DashboardClient fires → redirected to invite accept page
- [ ] Existing user: signs in → redirected to invite accept page
- [ ] Token cleared from sessionStorage after successful accept
- [ ] If token expired/used: shown friendly error, redirected to dashboard

**Blocked by:** nothing
**Blocks:** P1-03 (full invite UX)

---

### P1-03 — Entry detail view ❌ NOT STARTED

**Agent:** Continue.dev / Qwen3.5

**Scan findings:** No detail page, no `getOne` query, timeline entries are not clickable. Fully unimplemented.

**Technical details:**

- No detail page exists yet — timeline entries are not clickable
- Should show: full entry text, mood tag, reactions (expanded), flag status, author name, timestamp
- Route: `app/journal/[recipientId]/entry/[eventId]/page.tsx`
- Data already available via `careEvents.timeline` tRPC query — single event fetch needed
- Add `careEvents.getOne` tRPC procedure (query by `event_id`, RLS-scoped)

**Files to change:**

- `apps/web/server/routers/careEvents.ts` — add `getOne` query
- `apps/web/app/journal/[recipientId]/JournalClient.tsx` — make entries clickable
- `apps/web/app/journal/[recipientId]/entry/[eventId]/page.tsx` — new page

**Business impact:** Supporters need to see full context before reacting. Truncated timeline is fine for scanning; detail view is needed for reading. Needed before mobile launch.

**Acceptance criteria:**

- [ ] Clicking an entry in the timeline navigates to detail view
- [ ] Full text, mood, author name, timestamp rendered
- [ ] Reactions shown with count + "you reacted" state
- [ ] Flag badge shown for flagged entries
- [ ] Back button returns to timeline at correct scroll position
- [ ] Supporters see read-only view (no flag button)

**Blocked by:** P1-01 (author name), P1-02 (nice-to-have)
**Blocks:** nothing in Phase 2

---

## Phase 2 — Scheduler

---

### P2-01 — Shift tRPC router + Zod schema ❌ NOT STARTED

**Agent:** Claude Code (multi-file, RLS-adjacent)

**Technical details:**

- `shifts` table exists: `id, org_id, recipient_id, assignee_user_id, start_at, end_at, status (scheduled|in_progress|completed|cancelled), notes, created_by`
- Add `packages/schemas/src/shifts.ts` — Zod schema for shift create/update
- Add `apps/web/server/routers/shifts.ts`:
  - `shifts.list` — shifts for a recipient, date-range param, paginated
  - `shifts.create` — coordinator only, validates non-overlapping (same assignee)
  - `shifts.update` — coordinator only (status, notes, reassign)
  - `shifts.cancel` — coordinator only, sets status=cancelled
- Wire into `apps/web/server/trpc/index.ts`
- RLS: coordinator can create/update, assignee can read their own shifts, supporters read-only

**Business impact:** Shifts are the scheduler's data layer. All Phase 2 UI depends on this being solid.

**Acceptance criteria:**

- [ ] `shifts.create` rejects overlapping shifts for same assignee (DB-level check or fn)
- [ ] `shifts.list` returns shifts filtered by recipient, date range
- [ ] `shifts.cancel` requires coordinator role (protectedProcedure + role check)
- [ ] Zod schema validates start_at < end_at
- [ ] Vitest unit tests for schema validation
- [ ] pgTAP test: non-coordinator cannot insert shift

**Blocked by:** nothing
**Blocks:** P2-02, P2-03, P2-04

---

### P2-02 — Shift creation UI ❌ NOT STARTED

**Agent:** Claude Code + frontend-design (coordinator-only form)

**Technical details:**

- New panel or modal on journal page (coordinator role only)
- Fields: date, start time, end time, assignee (dropdown from team members), notes (optional)
- Assignee dropdown populated from `memberships.list` — requires display names (P1-01)
- Calls `shifts.create` tRPC mutation
- On success: shift appears in shift list (P2-03)
- Follow ENTERPRISE_PRINCIPLES.md #5 — read all form values before any `await`
- No template literals in JSX props (principle #1)

**Files to change:**

- `apps/web/app/journal/[recipientId]/` — add `ShiftForm.tsx` component
- `apps/web/app/journal/[recipientId]/JournalClient.tsx` — render `<ShiftForm>` for coordinators

**Business impact:** Core value prop. Without this, shifts live only in the DB. Coordinators need to assign caregivers to time slots.

**Acceptance criteria:**

- [ ] Form only visible to coordinators
- [ ] Assignee dropdown shows team member names (not UUIDs)
- [ ] Validation: end time > start time, assignee required
- [ ] Submit creates shift, form resets
- [ ] Error state shown if mutation fails
- [ ] Optimistic UI not required (low-frequency action)

**Blocked by:** P1-01 (display names), P2-01 (tRPC)
**Blocks:** P2-03

---

### ~~P2-03 — Shift list / caregiver view~~ ✅ DONE

**Agent:** Continue.dev / Qwen3.5

**Technical details:**

- New section on journal page: "Upcoming shifts" — visible to all roles, scoped to current week + next 7 days
- Calls `shifts.list` with date range
- Caregiver sees only their own shifts highlighted
- Coordinator sees all shifts
- Supporter sees all shifts (read-only)
- Status badge: scheduled (gray) | in_progress (blue) | completed (green) | cancelled (strikethrough)

**Files to change:**

- `apps/web/app/journal/[recipientId]/` — add `ShiftList.tsx`
- `apps/web/app/journal/[recipientId]/JournalClient.tsx` — render `<ShiftList>`

**Business impact:** Caregivers need to see their schedule. The coordinator needs to confirm coverage at a glance. This is the shift schedule's primary visibility surface.

**Acceptance criteria:**

- [ ] Shows shifts for current week, grouped by day
- [ ] Caregiver's own shifts shown with "Your shift" label
- [ ] Status badge rendered per status value
- [ ] Empty state: "No shifts scheduled this week."
- [ ] Coordinator can click a shift to cancel it (calls `shifts.cancel`)

**Blocked by:** P2-02
**Blocks:** P2-07

---

### ~~P2-04 — Coverage window UI~~ ✅ DONE

**Agent:** Continue.dev / Qwen3.5

**Technical details:**

- `coverage_windows` table exists: `id, org_id, recipient_id, start_at, end_at, label, required_role`
- Coverage windows = expected care periods (e.g., "Weekday mornings 7am–12pm, Caregiver required")
- New settings-adjacent page or modal: "Coverage expectations"
- Coordinator creates/edits coverage windows
- Windows are the baseline the gap detector compares shifts against

**Files to change:**

- `apps/web/server/routers/` — add `coverageWindows.ts` tRPC router (list, create, delete)
- `apps/web/app/journal/[recipientId]/` — add `CoverageSettings.tsx` (coordinator-only)
- `apps/web/server/trpc/index.ts` — wire router

**Business impact:** Coverage windows are useless without UI. Without them, the gap detector has nothing to compare shifts to. This is the configuration step that makes gap detection meaningful.

**Acceptance criteria:**

- [ ] Coordinator can create a recurring coverage window (day of week + time range + required role)
- [ ] Windows listed, deletable
- [ ] Validation: end_at > start_at, required_role is valid enum
- [ ] Non-coordinators cannot access the UI (role check)

**Blocked by:** P2-01
**Blocks:** P2-05

---

### ~~P2-05 — Gap detector (Inngest background job)~~ ✅ DONE

**Agent:** Claude Code (Inngest + multi-file)

**Technical details:**

- Inngest is already wired (`apps/web/inngest/client.ts`, `/api/inngest`)
- New function: `detectCoverageGaps` — runs nightly (cron: `0 6 * * *` UTC)
- Logic: for each org, for each coverage_window in next 7 days, check if a shift exists covering the window
- Gap = coverage_window with no overlapping shift for the required role
- Output: creates a `care_event` of `event_type: 'task'` with payload `{ gap: true, window_id, start_at, end_at }` — surfaces in coordinator's timeline
- `digestMinuteOffset()` from `packages/utils` already exists for stagger — use it

**Files to change:**

- `apps/web/inngest/` — add `detectCoverageGaps.ts`
- `apps/web/inngest/client.ts` — export new function
- `apps/web/app/api/inngest/route.ts` — register new function

**Business impact:** The gap detector is Carelog's proactive value. It's the difference between "a scheduling tool" and "the thing that tells you when grandma has no caregiver on Thursday." High retention impact.

**Acceptance criteria:**

- [ ] Inngest function runs daily at 6am UTC
- [ ] Creates a care_event for each detected gap (idempotent — no duplicates for same gap)
- [ ] Gap events appear in coordinator's timeline with distinct entry_kind='system'
- [ ] Gap events include: start_at, end_at, required role label
- [ ] Vitest test for gap detection logic (pure function, no Inngest dependency)

**Blocked by:** P2-04
**Blocks:** P2-06

---

### ~~P2-06 — Recurring shifts~~ ✅ DONE

**Agent:** Claude Code (schema extension + transaction logic)

**Scan findings:**

- `supabase/migrations/20260327234330_core_schema.sql` already has `recurrence` jsonb column and `recurring` boolean on the `shifts` table ✅
- **Note:** column is named `recurrence` (not `recurrence_rule` as originally planned) — use existing name
- No ShiftForm UI, no tRPC handling for bulk creation ❌

**Technical details:**

- DB schema ready — no migration needed
- `shifts.create` needs to accept optional `recurrence: { freq: 'weekly', day_of_week: number, weeks: number }`
- Creates N shift rows in a single DB transaction, sets `recurring=true` and `recurrence` jsonb on each
- Cancelling one in a series: "cancel this shift" or "cancel all future" (UI choice)

**Files to change:**

- `packages/schemas/src/shifts.ts` — extend schema with optional recurrence (once P2-01 creates this file)
- `apps/web/server/routers/shifts.ts` — handle bulk creation in transaction
- `apps/web/app/journal/[recipientId]/ShiftForm.tsx` — add "Repeat weekly" toggle + week count

**Business impact:** Most caregiving schedules are recurring. Single-shift creation is annoying at scale. Weekly recurring shifts unlock the scheduling loop for long-term care plans.

**Acceptance criteria:**

- [ ] ShiftForm has "Repeat weekly for N weeks" option (1–12 weeks)
- [ ] Creates N shift rows, all linked by shared `recurrence_rule`
- [ ] Cancelling one shift in a series: "cancel this shift" or "cancel all future" (UI choice)
- [ ] Vitest: schema validates recurrence correctly
- [ ] Migration is additive only (nullable column)

**Blocked by:** P2-02, P2-05
**Blocks:** nothing

---

### ~~P2-07 — Shift section in weekly digest~~ ✅ DONE

**Agent:** Continue.dev / Qwen3.5

**Technical details:**

- Weekly digest Inngest function already exists and sends HTML email via Resend
- Add a "This week's schedule" section: list of shifts for the coming week, grouped by day
- Query `shifts.list` inside the digest function (server-side, service role)
- Only show if shifts exist — don't show an empty section
- Tone: "Here's who's helping this week" (see UX_DECISIONS.md — digest is a letter, not a report)

**Files to change:**

- `apps/web/inngest/weeklyDigest.ts` — add shift query + HTML section
- `apps/web/server/repositories/` — add `shiftRepository.ts` with `getShiftsForWeek(orgId, recipientId, start, end)`

**Business impact:** Supporters and distant family members get visibility into who's providing care each week. Reduces "how is everything going?" check-ins. Increases digest open rates.

**Acceptance criteria:**

- [ ] Digest includes shift schedule section when shifts exist
- [ ] No section rendered if no shifts for the week
- [ ] Shift entries show: day, time range, caregiver name (from display_names)
- [ ] HTML renders cleanly in email clients (inline styles, no Tailwind classes)
- [ ] Tone matches rest of digest (warm, not clinical)

**Blocked by:** P2-03
**Blocks:** nothing

---

## Agent Routing Summary

| Story                      | Status  | Agent                         | Reason                                      |
| -------------------------- | ------- | ----------------------------- | ------------------------------------------- |
| P1-01 Display names        | ✅ DONE | —                             | Complete                                    |
| P1-02 Invite redirect      | ✅ DONE | Continue.dev / Qwen3.5        | OnboardingForm missing sessionStorage check |
| P1-03 Entry detail         | ✅ DONE | Continue.dev / Qwen3.5        | New page, no architecture decisions         |
| P2-01 Shift tRPC + schema  | ✅ DONE | Claude Code                   | RLS-adjacent, multi-file, new router        |
| P2-02 Shift creation UI    | ✅ DONE | Claude Code + frontend-design | Coordinator form, role enforcement          |
| P2-03 Shift list           | ✅ DONE | —                             | Complete                                    |
| P2-04 Coverage window UI   | ✅ DONE | —                             | Complete                                    |
| P2-05 Gap detector         | ✅ DONE | —                             | Complete                                    |
| P2-06 Recurring shifts     | ✅ DONE | —                             | Complete                                    |
| P2-07 Digest shift section | ✅ DONE | —                             | Complete                                    |

**QA:** Dispatch parallel subagents (`superpowers:dispatching-parallel-agents`) or `/ollama` for each story — run after implementation, before marking done.

---

## Definition of Done (all stories)

- [ ] Feature works end-to-end in local dev
- [ ] Role enforcement verified (wrong role cannot access)
- [ ] Vitest or pgTAP test added where logic is non-trivial
- [ ] No new Turbopack JSX violations (ENTERPRISE_PRINCIPLES.md #1)
- [ ] No template literals in JSX props
- [ ] TECH_DEBT.md updated if a known issue is resolved
- [ ] BUILD_STATUS.md checkbox checked
