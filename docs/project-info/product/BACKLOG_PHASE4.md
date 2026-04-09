# Carelog — Phase 4 Backlog

**As of:** 2026-04-09 (codebase scan: 2026-04-09, P4-03 shipped)
**Phase:** Depth and retention — symptom tracker, burnout tracker, full history export
**Prerequisite:** Phase 3 (medical + outer circle) fully shipped.

**Scan summary:** No Phase 4 tables exist. Phase 3 complete — medications, medication_schedules, ocr_jobs, outer_circle_requests, outer_circle_claims, care_briefs all present. care_events is the existing log target for symptom/burnout events.

---

## Sequencing Overview

```
P4-01 Symptom tracker schema + UI
  └── P4-03 Full history export  (needs symptom readings in care_events)

P4-02 Burnout tracker            ─── parallel with symptom tracker
P4-03 Full history export        ─── requires P4-01 complete, can start before P4-02
```

---

## P4-01 — Symptom tracker

**Agent:** Claude Code (new table + tRPC router + UI, multi-file)

**Scan findings:**
- No `symptom_readings` table exists
- `care_events` with `event_type='symptom'` and `entry_kind='system'` is the secondary log target
- No tRPC router or UI for symptoms

**Technical details:**

### Schema
New table `symptom_readings`:
```sql
CREATE TABLE symptom_readings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id),
  recipient_id  uuid NOT NULL REFERENCES care_recipients(id),
  logged_by     uuid NOT NULL,  -- auth.users.id
  pain_level    smallint CHECK (pain_level BETWEEN 0 AND 10),
  mood          text CHECK (mood IN ('good','okay','difficult','crisis')),
  appetite      text CHECK (appetite IN ('normal','reduced','poor','none')),
  mobility      text CHECK (mobility IN ('normal','limited','assisted','bedbound')),
  notes         text,
  recorded_at   timestamptz NOT NULL DEFAULT now()
);
-- RLS: org members can read; caregivers + coordinators can insert
```

### tRPC router `apps/web/server/routers/symptoms.ts`
- `symptoms.log` — coordinator/caregiver only; inserts row + fires `care_event { event_type: 'symptom', entry_kind: 'system' }`
- `symptoms.list` — all org members; ordered by `recorded_at DESC`, limit 30

### UI `apps/web/app/journal/[recipientId]/SymptomPanel.tsx`
- Collapsible panel on journal page (below MedicationPanel)
- All roles see recent readings (last 7 days compact view)
- Coordinator/caregiver see log form: pain slider (0–10), mood select, appetite select, mobility select, notes textarea
- Timeline shows symptom events compactly (system style)

**Files to change:**
- `supabase/migrations/YYYYMMDD_symptom_readings.sql` — new table + RLS
- `supabase/tests/symptom_readings_rls.test.sql` — pgTAP RLS tests
- `packages/schemas/src/symptoms.ts` — `symptomLogInput`, `symptomListInput`
- `packages/schemas/src/index.ts` — re-export
- `apps/web/server/routers/symptoms.ts` — new
- `apps/web/server/trpc/router.ts` — wire symptomsRouter
- `apps/web/app/journal/[recipientId]/SymptomPanel.tsx` — new
- `apps/web/app/journal/[recipientId]/JournalClient.tsx` — render SymptomPanel
- `packages/schemas/src/__tests__/symptoms.test.ts` — new

**Business impact:** Trend data makes "flag for doctor" entries more meaningful. Gives the history export something to show beyond journal text.

**Acceptance criteria:**
- [ ] Coordinator/caregiver can log a symptom reading (pain, mood, appetite, mobility)
- [ ] All roles see recent readings on the journal page
- [ ] Supporter cannot log symptoms (role-enforced)
- [ ] Zod validation rejects out-of-range pain levels
- [ ] care_event created alongside symptom_reading (system style, compact in timeline)
- [ ] Vitest schema tests pass; pgTAP RLS tests pass

**Blocked by:** nothing
**Blocks:** P4-03

---

## P4-02 — Burnout tracker

**Agent:** Claude Code (new table + tRPC router + weekly check-in UI)

**Scan findings:**
- No `burnout_checkins` table exists
- No Inngest function for burnout alerts
- Existing weekly digest Inngest function can be extended

**Technical details:**

### Schema
New table `burnout_checkins`:
```sql
CREATE TABLE burnout_checkins (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id),
  user_id      uuid NOT NULL,  -- auth.users.id (the caregiver checking in)
  sleep_score  smallint CHECK (sleep_score BETWEEN 1 AND 5),
  stress_score smallint CHECK (stress_score BETWEEN 1 AND 5),
  support_score smallint CHECK (support_score BETWEEN 1 AND 5),
  notes        text,
  week_stamp   text NOT NULL,  -- 'YYYY-WW' for idempotency
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_stamp)
);
-- RLS: user can only read/write their own rows; coordinator can read all for their org
```

### tRPC router `apps/web/server/routers/burnout.ts`
- `burnout.checkIn` — any role; UPSERT on `(user_id, week_stamp)`; returns `{ alreadyDone: boolean }`
- `burnout.myHistory` — returns current user's last 12 check-ins
- `burnout.orgSummary` — coordinator only; returns aggregated scores per member this month (no individual breakdowns, just trends)

### UI
- `apps/web/app/journal/[recipientId]/BurnoutCheckin.tsx` — weekly check-in widget
  - Appears for caregiver/coordinator roles only
  - Shows "How are YOU doing this week?" prompt
  - Three sliders: sleep (1–5), stress (1–5), support (1–5) + optional notes
  - Submit disabled once checked in for the current week (idempotent)
  - After submit: shows "Check-in saved. We'll remind you next week."

### Inngest alert
- Extend `weeklyDigest.ts` or new function `burnoutAlert.ts`
- If any caregiver has `stress_score >= 4` for 2+ consecutive weeks: create system care_event flagged for coordinator
- Idempotency: `burnout-alert:{userId}:{weekStamp}`

**Files to change:**
- `supabase/migrations/YYYYMMDD_burnout_checkins.sql` — new table + RLS
- `supabase/tests/burnout_checkins_rls.test.sql` — pgTAP RLS tests
- `packages/schemas/src/burnout.ts` — `burnoutCheckInInput`, `burnoutHistoryInput`
- `packages/schemas/src/index.ts` — re-export
- `apps/web/server/routers/burnout.ts` — new
- `apps/web/server/trpc/router.ts` — wire burnoutRouter
- `apps/web/app/journal/[recipientId]/BurnoutCheckin.tsx` — new
- `apps/web/app/journal/[recipientId]/JournalClient.tsx` — render BurnoutCheckin
- `apps/web/inngest/functions/burnoutAlert.ts` — new (or extend weeklyDigest)
- `apps/web/app/api/inngest/route.ts` — register burnoutAlert
- `apps/web/inngest/functions/__tests__/burnoutAlert.test.ts` — new

**Business impact:** The differentiator nobody else builds. Caregiver retention driver. Makes families feel seen, not just logged.

**Acceptance criteria:**
- [ ] Caregiver can submit a weekly check-in (sleep, stress, support scores)
- [ ] Check-in is idempotent — submitting twice in the same week updates, not duplicates
- [ ] Supporter role cannot submit a check-in
- [ ] Coordinator sees aggregate trend (not individual scores broken out by name)
- [ ] Inngest alert fires when caregiver stress ≥ 4 for 2+ weeks
- [ ] Alert is idempotent (no duplicate care_events same week)
- [ ] Vitest tests pass; pgTAP RLS tests pass

**Blocked by:** nothing
**Blocks:** nothing

---

## P4-03 — Full history export

**Agent:** Claude Code (API route + PDF generation or structured JSON)

**Scan findings:**
- No export route exists
- `care_events`, `symptom_readings` (after P4-01), `medications`, `shifts` all available
- `care_briefs` is point-in-time snapshot — export is cumulative
- Identity vault service role pattern already established

**Technical details:**

### Export format
Two formats:
1. **JSON** — machine-readable, includes everything
2. **PDF** — formatted, doctor-friendly; use `@react-pdf/renderer` or similar

### API route `apps/web/app/api/export/route.ts`
- `POST /api/export` — coordinator only
- Body: `{ orgId, recipientId, format: 'json' | 'pdf', since?: ISO date }`
- Server reads:
  - Identity vault (once, service role) → real name + DOB
  - `care_events` — human entries + system events, ordered by `created_at`
  - `symptom_readings` — all readings in range
  - `medications` — active + deleted (with deleted_at)
  - `shifts` — completed shifts with assignee names
- For JSON: return as `application/json` download
- For PDF: stream `application/pdf` response
- No export row stored — generated on demand, not cached (unlike care_brief)

### UI
- "Export full history" button in coordinator settings or TeamPanel
- Format selector (JSON / PDF)
- Optional date range picker
- Download triggers immediately — no async job for MVP

**Files to change:**
- `apps/web/app/api/export/route.ts` — new
- `apps/web/app/api/export/route.test.ts` — new (auth/role/format validation)
- `apps/web/app/journal/[recipientId]/ExportButton.tsx` — new (coordinator only)
- `apps/web/app/journal/[recipientId]/JournalClient.tsx` — render ExportButton

**Business impact:** Trust builder — families who can export everything put everything in. Also the doctor handoff flow for new specialists.

**Acceptance criteria:**
- [ ] Coordinator can trigger a JSON export download
- [ ] Coordinator can trigger a PDF export download
- [ ] Non-coordinator role returns 403
- [ ] Export includes: care_events, symptom_readings, medications, shifts
- [ ] Vault accessed exactly once at export time — real name + DOB in output
- [ ] Date range filter works (since parameter)

**Blocked by:** P4-01 (symptom_readings table must exist)
**Blocks:** nothing

---

## Agent Routing Summary

| Story | Status | Agent | Reason |
|-------|--------|-------|--------|
| P4-01 Symptom tracker | ✅ SHIPPED 2026-04-10 | Claude Code | New table + router + UI, multi-file |
| P4-02 Burnout tracker | ✅ SHIPPED 2026-04-10 | Claude Code | New table + router + UI + Inngest alert |
| P4-03 Full history export | ✅ SHIPPED 2026-04-09 | Claude Code | API route + PDF/JSON generation, vault access |

---

## Definition of Done (all stories)

- [ ] Feature works end-to-end in local dev
- [ ] Role enforcement verified (wrong role cannot access)
- [ ] Vitest or pgTAP test added where logic is non-trivial
- [ ] No Turbopack JSX violations (no template literals in JSX props)
- [ ] TECH_DEBT.md updated if a known issue is resolved
- [ ] BUILD_STATUS.md checkbox checked
