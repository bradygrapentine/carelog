# Carelog — Phase 5 Backlog

**As of:** 2026-04-09 (codebase scan: 2026-04-09)
**Phase:** Financial and legal — expense log, benefits navigator, document vault, end-of-life planner
**Prerequisite:** Phase 4 (depth and retention) fully shipped.

**Scan summary:** No Phase 5 tables exist. Identity vault pattern established (service role, one-time de-tokenize). `care_events` available as secondary log. Supabase Storage already wired (prescription-images bucket exists from P3-03 OCR).

---

## Sequencing Overview

```
P5-01 Shared expense log     ─── no prerequisites, can start immediately
P5-02 Benefits navigator     ─── no prerequisites, can start immediately
P5-03 Document vault         ─── requires Supabase Storage (already wired)
P5-04 End-of-life planner    ─── requires P5-03 (documents are stored there)
```

---

## P5-01 — Shared expense log

**Agent:** Claude Code (new table + tRPC router + UI)

**Scan findings:**
- No `expenses` table exists
- No expense tracking UI exists

**Technical details:**

### Schema
New table `expenses`:
```sql
CREATE TABLE expenses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id),
  recipient_id  uuid NOT NULL REFERENCES care_recipients(id),
  logged_by     uuid NOT NULL,  -- auth.users.id
  amount_cents  integer NOT NULL CHECK (amount_cents > 0),
  currency      text NOT NULL DEFAULT 'USD',
  category      text NOT NULL CHECK (category IN (
    'medication', 'supplies', 'equipment', 'home_modification',
    'aide_hours', 'transport', 'food', 'other'
  )),
  description   text NOT NULL,
  paid_by_name  text,  -- display name of who paid (denormalized)
  receipt_url   text,  -- optional Supabase Storage path
  incurred_at   date NOT NULL DEFAULT current_date,
  created_at    timestamptz NOT NULL DEFAULT now()
);
-- RLS: org members can read; caregivers + coordinators can insert; coordinator can delete
```

### tRPC router `apps/web/server/routers/expenses.ts`
- `expenses.list` — all org members; ordered by `incurred_at DESC`; optional `since` date filter
- `expenses.create` — coordinator/caregiver; validates amount > 0, category enum
- `expenses.delete` — coordinator only; org-scoped

### UI `apps/web/app/journal/[recipientId]/ExpensePanel.tsx`
- Collapsible panel on journal page (coordinator/caregiver can add; all roles read)
- List view: date, category badge, description, amount, who paid
- Summary row: total by category for the last 30 days
- Create form: amount, category select, description, paid_by (defaults to current user's name), date
- Split view (Phase 5b): shows per-contributor totals — "Brady paid $340, Mom paid $120"

**Files to change:**
- `supabase/migrations/YYYYMMDD_expenses.sql` — new table + RLS
- `supabase/tests/expenses_rls.test.sql` — pgTAP RLS tests
- `packages/schemas/src/expenses.ts` — `expenseCreateInput`, `expenseListInput`
- `packages/schemas/src/index.ts` — re-export
- `apps/web/server/routers/expenses.ts` — new
- `apps/web/server/trpc/router.ts` — wire expensesRouter
- `apps/web/app/journal/[recipientId]/ExpensePanel.tsx` — new
- `apps/web/app/journal/[recipientId]/JournalClient.tsx` — render ExpensePanel
- `packages/schemas/src/__tests__/expenses.test.ts` — new

**Business impact:** Reduces family conflict over "who paid what." Common pain point for multi-sibling caregiving situations.

**Acceptance criteria:**
- [ ] Coordinator/caregiver can log an expense with amount, category, description
- [ ] All roles can see the expense list and 30-day totals by category
- [ ] Supporter cannot create an expense (role-enforced)
- [ ] Amount stored as cents (integer) — no floating point
- [ ] Zod rejects negative/zero amounts and invalid categories
- [ ] Vitest schema tests pass; pgTAP RLS tests pass

**Blocked by:** nothing
**Blocks:** nothing

---

## P5-02 — Benefits navigator

**Agent:** Claude Code (static eligibility logic + UI panel)

**Scan findings:**
- No benefits-related tables or routes exist
- Care recipient age/DOB is in identity vault (service role access)
- No diagnosis data in structured form (only free-text care_events)
- Location not stored (no address field on care_recipients or organizations)

**Technical details:**

### Approach
MVP is a static eligibility screener — not a live benefits lookup API.
Present a checklist of questions; surface matching programs based on answers.

### UI `apps/web/app/journal/[recipientId]/BenefitsNavigator.tsx`
- Coordinator-only panel (not visible to other roles)
- Short screener: age ≥ 65? Veteran? Low income? Medicare enrolled? Medicaid enrolled?
- Results: list of matching programs with plain-language description + link to apply
- Programs covered (MVP): Medicare Part D Extra Help, Medicaid HCBS waiver, VA Aid & Attendance, PACE programs, state SHIP counseling
- No external API calls — all logic is local eligibility rules

### No new schema required
- Store screener answers in a `benefits_screenings` table for coordinator reference:
```sql
CREATE TABLE benefits_screenings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id),
  recipient_id uuid NOT NULL REFERENCES care_recipients(id),
  answers      jsonb NOT NULL,
  results      jsonb NOT NULL,  -- list of matched program keys
  created_by   uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
-- RLS: coordinator-only read/write
```

**Files to change:**
- `supabase/migrations/YYYYMMDD_benefits_screenings.sql` — new table + RLS
- `apps/web/server/routers/benefits.ts` — `benefits.screen` (save screening), `benefits.latest` (get last result)
- `apps/web/server/trpc/router.ts` — wire benefitsRouter
- `apps/web/app/journal/[recipientId]/BenefitsNavigator.tsx` — new
- `apps/web/lib/benefitsEligibility.ts` — pure eligibility logic (testable without DB)
- `apps/web/lib/__tests__/benefitsEligibility.test.ts` — new (pure function tests)
- `apps/web/app/journal/[recipientId]/JournalClient.tsx` — render BenefitsNavigator

**Business impact:** High perceived value, low implementation cost. Most families don't know what programs exist. This is a discovery tool, not an application tool.

**Acceptance criteria:**
- [ ] Coordinator can complete the screener and see matching programs
- [ ] Results are saved and retrievable (latest screening shown on revisit)
- [ ] Non-coordinator roles cannot access the panel
- [ ] Pure `eligibility(answers)` function has Vitest tests for each program's rules
- [ ] No external API calls — all logic is local

**Blocked by:** nothing
**Blocks:** nothing

---

## P5-03 — Document vault

**Agent:** Claude Code (Supabase Storage + new table + upload/download UI)

**Scan findings:**
- Supabase Storage already wired (prescription-images bucket used by P3-03)
- No `documents` table exists
- No document upload UI exists
- Identity vault pattern established — documents may reference sensitive data

**Technical details:**

### Schema
New table `documents`:
```sql
CREATE TABLE documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id),
  recipient_id  uuid NOT NULL REFERENCES care_recipients(id),
  uploaded_by   uuid NOT NULL,  -- auth.users.id
  display_name  text NOT NULL,
  doc_type      text NOT NULL CHECK (doc_type IN (
    'hipaa_authorization', 'power_of_attorney', 'advance_directive',
    'insurance_card', 'medication_list', 'other'
  )),
  storage_path  text NOT NULL,  -- path in 'care-documents' Supabase Storage bucket
  file_size     integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);
-- RLS: org members can read; coordinator can insert/delete
-- Storage bucket: private (no public URLs — signed URLs only)
```

### API routes
- `POST /api/documents/upload` — coordinator only; uploads to `care-documents` bucket; inserts documents row; returns `documentId`
- `GET /api/documents/[documentId]/download` — all org members; generates 60-second signed URL via `supabaseAdmin.storage.createSignedUrl()`; redirects to signed URL

### tRPC router `apps/web/server/routers/documents.ts`
- `documents.list` — all org members; returns document rows (no storage URLs)
- `documents.delete` — coordinator only; deletes row + removes from storage

### UI `apps/web/app/journal/[recipientId]/DocumentVault.tsx`
- Collapsible panel on journal page (coordinator only for upload/delete; all roles can view/download)
- Document list: type badge, display name, uploader, date, download button
- Upload form: file input, display name, type selector
- Download: opens signed URL in new tab

**Files to change:**
- `supabase/migrations/YYYYMMDD_documents.sql` — new table + RLS
- `supabase/tests/documents_rls.test.sql` — pgTAP RLS tests
- `apps/web/app/api/documents/upload/route.ts` — new
- `apps/web/app/api/documents/[documentId]/download/route.ts` — new
- `apps/web/app/api/documents/upload/route.test.ts` — new
- `apps/web/app/api/documents/[documentId]/download/route.test.ts` — new
- `apps/web/server/routers/documents.ts` — new
- `apps/web/server/trpc/router.ts` — wire documentsRouter
- `apps/web/app/journal/[recipientId]/DocumentVault.tsx` — new
- `apps/web/app/journal/[recipientId]/JournalClient.tsx` — render DocumentVault

**Business impact:** POA and advance directive in one place the whole team can access. Eliminates "where is the DNR?" crisis at 2am. High trust driver.

**Acceptance criteria:**
- [ ] Coordinator can upload a document (file + display name + type)
- [ ] All org members can view the document list and download via signed URL
- [ ] Signed URL expires after 60 seconds (no persistent public URL)
- [ ] Supporter cannot upload or delete documents (role-enforced)
- [ ] Coordinator can delete a document (removes from storage + table)
- [ ] pgTAP RLS tests pass; API route tests pass

**Blocked by:** nothing (Supabase Storage already wired)
**Blocks:** P5-04

---

## P5-04 — End-of-life planner

**Agent:** Claude Code (structured form + document attachments + access control)

**Scan findings:**
- No `eol_plans` table exists
- P5-03 document vault provides storage for attached documents
- Identity vault service role pattern applies here (names + contacts are sensitive)

**Technical details:**

### Schema
New table `eol_plans`:
```sql
CREATE TABLE eol_plans (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations(id),
  recipient_id        uuid NOT NULL REFERENCES care_recipients(id),
  created_by          uuid NOT NULL,
  healthcare_proxy    text,      -- name + contact (plain text — not vault-tokenized at MVP)
  resuscitation_pref  text CHECK (resuscitation_pref IN ('full', 'dnr', 'dnr_comfort_only')),
  funeral_pref        text,      -- free text
  legacy_message      text,      -- personal message to the family
  attorney_name       text,
  attorney_contact    text,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipient_id)          -- one plan per recipient
);
-- RLS: coordinator read/write only — not visible to caregivers/supporters
```

### tRPC router `apps/web/server/routers/eolPlan.ts`
- `eolPlan.get` — coordinator only; returns plan for recipient (null if none)
- `eolPlan.upsert` — coordinator only; creates or updates (UPSERT on recipient_id)

### UI `apps/web/app/journal/[recipientId]/EolPlanner.tsx`
- Coordinator-only panel — completely hidden from all other roles
- Form: healthcare proxy name + contact, resuscitation preference (radio), funeral preferences (textarea), legacy message (textarea), attorney name + contact
- Read-only display until "Edit" is clicked
- After save: "Saved. The team will never see this until you share it."
- Attached documents: list of documents tagged `doc_type: 'advance_directive'` from P5-03 vault (filtered view, no new upload needed)

**Files to change:**
- `supabase/migrations/YYYYMMDD_eol_plans.sql` — new table + RLS
- `supabase/tests/eol_plans_rls.test.sql` — pgTAP RLS tests (coordinator-only access)
- `packages/schemas/src/eolPlan.ts` — `eolPlanUpsertInput`
- `packages/schemas/src/index.ts` — re-export
- `apps/web/server/routers/eolPlan.ts` — new
- `apps/web/server/trpc/router.ts` — wire eolPlanRouter
- `apps/web/app/journal/[recipientId]/EolPlanner.tsx` — new
- `apps/web/app/journal/[recipientId]/JournalClient.tsx` — render EolPlanner (coordinator only)
- `packages/schemas/src/__tests__/eolPlan.test.ts` — new

**Business impact:** The conversation families put off. Having a structured place to store these decisions — and knowing it's private — removes the barrier. Elder law attorney referral channel opens once this ships.

**Acceptance criteria:**
- [ ] Coordinator can create/update an end-of-life plan
- [ ] Plan is completely hidden from caregiver, supporter, and aide roles
- [ ] Resuscitation preference constrained to valid enum values
- [ ] Advance directive documents from vault surfaced inline (read-only link)
- [ ] One plan per recipient (upsert, not append)
- [ ] pgTAP RLS tests confirm no non-coordinator access
- [ ] Vitest schema tests pass

**Blocked by:** P5-03 (document vault for advance directive attachment)
**Blocks:** nothing

---

## Agent Routing Summary

| Story | Status | Agent | Reason |
|-------|--------|-------|--------|
| P5-01 Shared expense log | ⬜ NOT STARTED | Claude Code | New table + router + UI, multi-file |
| P5-02 Benefits navigator | ⬜ NOT STARTED | Claude Code | Static eligibility logic + UI, no external API |
| P5-03 Document vault | ⬜ NOT STARTED | Claude Code | Storage integration, signed URLs, role-gated |
| P5-04 End-of-life planner | ⬜ NOT STARTED | Claude Code | Coordinator-only, sensitive data, P5-03 dependency |

---

## Definition of Done (all stories)

- [ ] Feature works end-to-end in local dev
- [ ] Role enforcement verified (wrong role cannot access)
- [ ] Vitest or pgTAP test added where logic is non-trivial
- [ ] No Turbopack JSX violations (no template literals in JSX props)
- [ ] TECH_DEBT.md updated if a known issue is resolved
- [ ] BUILD_STATUS.md checkbox checked
