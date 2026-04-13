# Carelog — Phase 3 Backlog

**As of:** 2026-04-09 (codebase scan: 2026-04-09)
**Phase:** Medical module + Outer circle
**Prerequisite:** Phase 2 (scheduler) fully shipped.

**Scan summary:** All Phase 2 stories complete. Medical tables exist (medications, medication_schedules, ocr_jobs). Outer circle tables exist (outer_circle_requests, outer_circle_claims, care_briefs). `claim_outer_circle_slot()` Postgres function exists.

---

## Sequencing Overview

```
P3-01 Medication catalog UI
  └── P3-02 Admin log          (needs P3-01 for medication rows)
  └── P3-03 OCR pipeline       (needs P3-01 to create medication on confirm)
  └── P3-04 Refill alert       (needs P3-01 for medication rows to check)

P3-05 Outer circle board  ─── parallel with medical module
P3-06 Care brief          ─── parallel with medical module
```

---

## Medical Module

---

### P3-01 — Medication catalog UI

**Agent:** Claude Code (new router + UI, multi-file)

**Scan findings:**

- `medications` table exists: `id, org_id, recipient_id, name, dosage_mg, frequency_per_day, supply_days_remaining, notes, created_by`
- No tRPC router for medications yet
- No UI for medications

**Technical details:**

- Add `packages/schemas/src/medications.ts` — Zod schemas: `medicationCreateInput`, `medicationListInput`
- Add `apps/web/server/routers/medications.ts`:
  - `medications.list` — scoped to org+recipient, RLS-enforced
  - `medications.create` — coordinator only, validates fields
  - `medications.delete` — coordinator only, org-scoped
- Wire into `apps/web/server/trpc/router.ts`
- Add `apps/web/app/journal/[recipientId]/MedicationPanel.tsx`:
  - Collapsible panel below CoverageSettings (coordinator only for editing)
  - All roles see the medication list (read-only for non-coordinators)
  - Create form: name, dosage_mg (number), frequency_per_day (1-4), supply_days_remaining (optional), notes (optional)
  - List with delete button (coordinator only)

**Files to change:**

- `packages/schemas/src/medications.ts` — new
- `packages/schemas/src/index.ts` — re-export
- `apps/web/server/routers/medications.ts` — new
- `apps/web/server/trpc/router.ts` — wire medicationsRouter
- `apps/web/app/journal/[recipientId]/MedicationPanel.tsx` — new
- `apps/web/app/journal/[recipientId]/JournalClient.tsx` — render MedicationPanel
- `packages/schemas/src/__tests__/medications.test.ts` — new

**Business impact:** Medication tracking is a primary caregiving task. Without this, the OCR pipeline and refill alerts have no target.

**Acceptance criteria:**

- [ ] Coordinator can add a medication (name, dosage, frequency required)
- [ ] All roles see the medication list on the journal page
- [ ] Coordinator can delete a medication
- [ ] Zod validation rejects invalid dosage/frequency
- [ ] Vitest schema tests pass

**Blocked by:** nothing
**Blocks:** P3-02, P3-03, P3-04

---

### P3-02 — Medication administration log

**Agent:** Claude Code

**Scan findings:**

- `medication_schedules` table exists: `id, medication_id, org_id, recipient_id, scheduled_time, days_of_week` (jsonb)
- `care_events` with `event_type='medication'` and `entry_kind='system'` is the log target
- No administration UI exists

**Technical details:**

- New component: `apps/web/app/journal/[recipientId]/MedicationChecklist.tsx`
- Shows today's scheduled medications (from `medication_schedules` joined to `medications`)
- Each row: medication name + dose + scheduled time + "Gave it" / "Missed" buttons
- "Gave it" → `care_event { event_type: 'medication', entry_kind: 'system', payload: { medication_id, given: true, scheduled_time } }`
- "Missed" → `care_event { event_type: 'medication', entry_kind: 'system', payload: { medication_id, missed: true, scheduled_time } }`
- Button disabled once logged for the day (idempotency via care_events query)
- Add `medications.listScheduled` tRPC query — today's schedules for a recipient

**Files to change:**

- `apps/web/server/routers/medications.ts` — add `listScheduled` query
- `apps/web/app/journal/[recipientId]/MedicationChecklist.tsx` — new
- `apps/web/app/journal/[recipientId]/JournalClient.tsx` — render MedicationChecklist

**Business impact:** Closes the loop on medication adherence. The care_events log + flagging system means doctors can see missed medication patterns.

**Acceptance criteria:**

- [ ] Today's scheduled medications appear in checklist
- [ ] "Gave it" / "Missed" creates correct care_event
- [ ] Buttons disable after logging (no double-logging same medication same day)
- [ ] Timeline shows medication events with compact system style

**Blocked by:** P3-01
**Blocks:** nothing

---

### P3-03 — OCR prescription label scan

**Agent:** Claude Code (Inngest pipeline, multi-file)

**Scan findings:**

- `ocr_jobs` table exists: `id, org_id, recipient_id, image_url, status (pending|processing|needs_review|confirmed), raw_text, parsed_payload, created_by`
- No Inngest function for OCR exists
- No upload UI exists

**Technical details:**

- UI flow: coordinator uploads image (file input) → POST to `/api/ocr/upload` → Inngest job triggered
- Inngest function `ocrPrescription`:
  - Triggered by `ocr/job.created` event
  - Calls external OCR API (stub with `process.env.OCR_API_KEY` — no-op if absent)
  - Parses medication name, dosage, frequency from raw text (regex-based fallback)
  - Updates `ocr_jobs` to `needs_review` with `parsed_payload`
- Coordinator sees a "Review scan" panel when `ocr_jobs.status = 'needs_review'`
- Confirming creates a medication row and sets `ocr_jobs.status = confirmed`

**Files to change:**

- `apps/web/app/api/ocr/upload/route.ts` — POST: uploads image, creates ocr_job, fires Inngest event
- `apps/web/inngest/functions/ocrPrescription.ts` — Inngest function
- `apps/web/app/api/inngest/route.ts` — register ocrPrescription
- `apps/web/app/journal/[recipientId]/OcrReviewPanel.tsx` — shows pending scans for review/confirmation
- `apps/web/app/journal/[recipientId]/JournalClient.tsx` — render OcrReviewPanel (coordinator only)

**Business impact:** Removes manual data entry for medications. OCR-to-confirmation is the core value for professional aides managing complex medication regimens.

**Acceptance criteria:**

- [ ] Coordinator can upload a prescription image
- [ ] Inngest function runs and updates `ocr_jobs.status` to `needs_review`
- [ ] Coordinator sees parsed fields, can confirm or discard
- [ ] Confirming creates a medication row
- [ ] No-ops gracefully when `OCR_API_KEY` is absent (local dev)

**Blocked by:** P3-01
**Blocks:** nothing

---

### P3-04 — Refill alert

TODO

**Scan findings:**

- `medications.supply_days_remaining` column exists
- No alert mechanism exists yet

**Technical details:**

- New Inngest function `refillAlert` — cron `TZ=UTC 0 7 * * *` (daily 7am UTC, 1hr after gap detector)
- Pure function `detectLowSupply(medications)` → medications with `supply_days_remaining <= 7`
- For each low-supply medication: create `care_event { event_type: 'task', entry_kind: 'system', payload: { refill_needed: true, medication_id, days_remaining } }`
- Idempotent: check for existing event with same `medication_id` today before inserting
- Register in `apps/web/app/api/inngest/route.ts`

**Files to change:**

- `apps/web/inngest/functions/refillAlert.ts` — new (pure function + Inngest handler)
- `apps/web/inngest/functions/__tests__/refillAlert.test.ts` — new
- `apps/web/app/api/inngest/route.ts` — register refillAlert

**Business impact:** Proactive alert prevents "we ran out of Lisinopril at 8pm" scenarios. High caregiver stress reduction.

**Acceptance criteria:**

- [ ] Cron runs daily at 7am UTC
- [ ] Creates system care_event for each medication with ≤7 days remaining
- [ ] Idempotent — no duplicate events for same medication same day
- [ ] Pure `detectLowSupply()` function has Vitest tests
- [ ] `// @vitest-environment node` at top of test file (supabaseAdmin guard)

**Blocked by:** P3-01 (medication rows must exist)
**Blocks:** nothing

---

## Outer Circle

---

### P3-05 — Volunteer request board

**Agent:** Claude Code (new public route, no-account flow)

**Scan findings:**

- `outer_circle_requests` table: `id, org_id, recipient_id, share_token (32-byte hex), title, description, slots_total, slots_filled, active`
- `outer_circle_claims` table: `id, request_id, claimer_name, claimer_email, claim_note, claimed_at`
- `claim_outer_circle_slot()` Postgres function exists — atomic, prevents double-booking
- RLS on `outer_circle_requests`: `USING (true)` — open read, intentional
- No UI or routes exist yet

**Technical details:**

- Coordinator creates a request: `/api/outer-circle/[shareToken]` → POST to create request, generates `share_token`
- Public board: `apps/web/app/care/[shareToken]/page.tsx` — no auth required
  - Shows: title, description, slots remaining, claim form
  - Claim form: name, email, note → POST `/api/outer-circle/[shareToken]/claim`
  - API route calls `claim_outer_circle_slot()` RPC function
  - 200 = claimed, 409 = slots full
- Coordinator view: list of requests + who claimed each slot

**Files to change:**

- `apps/web/app/api/outer-circle/route.ts` — POST create request (coordinator only)
- `apps/web/app/api/outer-circle/[shareToken]/route.ts` — GET board data
- `apps/web/app/api/outer-circle/[shareToken]/claim/route.ts` — POST claim slot (no auth)
- `apps/web/app/care/[shareToken]/page.tsx` — public board page (new route)
- `apps/web/app/journal/[recipientId]/OuterCirclePanel.tsx` — coordinator creates/manages requests

**Business impact:** Enables volunteer coordination without requiring platform accounts. Critical for community care models.

**Acceptance criteria:**

- [ ] Coordinator creates request → gets shareable URL
- [ ] Anyone with URL can claim a slot without signing in
- [ ] `claim_outer_circle_slot()` prevents double-booking (atomic)
- [ ] Slots-full state shown on public board
- [ ] Coordinator sees list of claims per request

**Blocked by:** nothing
**Blocks:** nothing

---

### P3-06 — Care brief generator

**Agent:** Claude Code (vault access pattern, snapshot model)

**Scan findings:**

- `care_briefs` table: `id, org_id, recipient_id, share_token, snapshot (jsonb), created_by, revoked`
- Vault access pattern: service role reads identity once at creation, never again
- No UI or routes exist yet

**Technical details:**

- Coordinator generates brief: button in TeamPanel or settings → POST `/api/brief`
  - Server reads identity vault once (service role) → de-tokenizes name + DOB
  - Reads recent care_events (last 30 days, human entries only)
  - Stores snapshot jsonb: `{ name, dob, summary, entries[], generated_at }`
  - Returns `shareToken`
- Public view: `apps/web/app/brief/[shareToken]/page.tsx` — no auth required
  - Reads `care_briefs` where `revoked = false`
  - Renders: name, generated date, recent entries (text + mood + flag status)
  - No link back to platform — it's a document
- Revoke: DELETE `/api/brief/[shareToken]` → sets `revoked = true`

**Files to change:**

- `apps/web/app/api/brief/route.ts` — POST create brief (coordinator only)
- `apps/web/app/api/brief/[shareToken]/route.ts` — GET brief (public)
- `apps/web/app/api/brief/[shareToken]/revoke/route.ts` — POST revoke
- `apps/web/app/brief/[shareToken]/page.tsx` — public snapshot page
- `apps/web/app/journal/[recipientId]/JournalClient.tsx` — "Generate care brief" button (coordinator)

**Business impact:** Enables one-click doctor briefing. Removes the "please summarize everything for the new specialist" burden. High perceived value, low implementation cost.

**Acceptance criteria:**

- [ ] Coordinator generates brief → gets shareable URL
- [ ] Brief renders at public URL without auth
- [ ] Revoke sets `revoked=true` → URL returns 404
- [ ] Vault accessed exactly once (at creation) — no vault reads at view time
- [ ] Snapshot includes: recipient name, generated date, recent entries (up to 10)

**Blocked by:** nothing
**Blocks:** nothing

---

## Agent Routing Summary

| Story                    | Status                | Agent       | Reason                                    |
| ------------------------ | --------------------- | ----------- | ----------------------------------------- |
| P3-01 Medication catalog | ✅ SHIPPED 2026-04-09 | Claude Code | New router + UI, multi-file               |
| P3-02 Admin log          | ✅ SHIPPED 2026-04-09 | Claude Code | Checklist UI + care_event writes          |
| P3-03 OCR pipeline       | ✅ SHIPPED 2026-04-09 | Claude Code | Inngest pipeline, file upload, multi-file |
| P3-04 Refill alert       | ✅ SHIPPED 2026-04-09 | Claude Code | Follows gapDetector pattern, 5 tests      |
| P3-05 Outer circle       | ✅ SHIPPED 2026-04-09 | Claude Code | New public route, no-auth flow            |
| P3-06 Care brief         | ✅ SHIPPED 2026-04-09 | Claude Code | Vault access pattern, snapshot model      |

---

## E2E Test Gaps (lower-priority)

These flows are not yet covered by Playwright specs. Implement when the feature is stable
and the E2E suite has reliable infra (mailpit, Supabase local, Chromium warm).

| Gap | File to create | Notes |
|-----|---------------|-------|
| Expenses list — coordinator adds expense, appears in list | `e2e/expenses.spec.ts` | tRPC-backed; use `page.route('**/trpc/expenses*')` for fast path |
| Team admin remove-member flow | `e2e/team-admin.spec.ts` (extend) | Requires multi-user context; coordinator removes caregiver |
| Outer circle creation from coordinator side | `e2e/outer-circle.spec.ts` (extend) | Coordinator opens request form; mocked `page.route('**/api/outer-circle')` |
| Care brief generation and share URL | `e2e/care-brief.spec.ts` | Mock `/api/brief` POST; verify share URL appears in coordinator "More" panel |
| EOL planner save flow (coordinator) | `e2e/eol-planner.spec.ts` | EolPlanner component on "More" panel; fill fields and verify save confirmation |
| Benefits navigator coordinator view | `e2e/benefits.spec.ts` | BenefitsNavigator in "More" panel; coordinator-only |
| Contact page form submission | `e2e/contact.spec.ts` | Public page `/contact`; submit form, verify success message |
| Burnout privacy suppression | Extend `e2e/burnout.spec.ts` | Requires seeding 1–2 check-ins; verify coordinator summary never shows raw scores |
| OCR review panel — review and confirm | `e2e/ocr-review.spec.ts` | Coordinator flow; mock OCR job list via `page.route('**/trpc/documents*')` |

---

## Definition of Done (all stories)

- [ ] Feature works end-to-end in local dev
- [ ] Role enforcement verified (wrong role cannot access)
- [ ] Vitest or pgTAP test added where logic is non-trivial
- [ ] No Turbopack JSX violations (no template literals in JSX props)
- [ ] TECH_DEBT.md updated if a known issue is resolved
- [ ] BUILD_STATUS.md checkbox checked
