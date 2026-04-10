# Phase 5: Finances + Documents — Design Spec

**Date:** 2026-04-09
**Status:** Approved
**Wave:** Phase 5 (all four stories)

---

## Overview

Four new features extending the journal page: shared expense tracking, benefits eligibility screening, document vault, and end-of-life planning. Implemented in two waves.

**Wave 1 (parallel worktree subagents):**
- P5-01 Shared expense log
- P5-02 Benefits navigator

**Wave 2 (sequential):**
- P5-03 Document vault
- P5-04 End-of-life planner (depends on P5-03)

---

## Wave 1

### P5-01 — Shared Expense Log

**Business value:** Reduces family conflict over "who paid what." Common pain point for multi-sibling caregiving.

#### Schema

```sql
CREATE TABLE expenses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id),
  recipient_id  uuid NOT NULL REFERENCES care_recipients(id),
  logged_by     uuid NOT NULL,  -- auth.users.id
  amount        numeric(10,2) NOT NULL CHECK (amount > 0),
  currency      text NOT NULL DEFAULT 'USD',
  category      text NOT NULL CHECK (category IN (
    'medication', 'supplies', 'equipment', 'home_modification',
    'aide_hours', 'transport', 'food', 'other'
  )),
  description   text NOT NULL,
  paid_by_name  text,
  receipt_url   text,
  incurred_at   date NOT NULL DEFAULT current_date,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

**RLS:** All org members read. Caregiver + coordinator insert. Coordinator delete.

#### tRPC router: `apps/web/server/routers/expenses.ts`

- `expenses.list` — all org members; ordered `incurred_at DESC`; optional `since` date filter
- `expenses.create` — coordinator/caregiver; validates `amount > 0`, category enum
- `expenses.delete` — coordinator only; org-scoped

#### Zod schema: `packages/schemas/src/expenses.ts`

```ts
expenseCreateInput: z.object({
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  category: z.enum(['medication', 'supplies', 'equipment', 'home_modification',
    'aide_hours', 'transport', 'food', 'other']),
  description: z.string().min(1),
  paid_by_name: z.string().optional(),
  incurred_at: z.string(), // ISO date string
})
```

#### UI: `apps/web/app/journal/[recipientId]/ExpensePanel.tsx`

- Collapsible panel — all roles see it; caregiver + coordinator can add; coordinator can delete
- List view: date, category badge, description, amount, who paid
- Summary row: total by category for last 30 days
- Create form: amount, category select, description, paid_by (defaults to current user's name), date

#### Files

- `supabase/migrations/YYYYMMDD_expenses.sql`
- `supabase/tests/expenses_rls.test.sql`
- `packages/schemas/src/expenses.ts`
- `packages/schemas/src/index.ts` — re-export
- `packages/schemas/src/__tests__/expenses.test.ts`
- `apps/web/server/routers/expenses.ts`
- `apps/web/server/trpc/router.ts` — wire expensesRouter
- `apps/web/app/journal/[recipientId]/ExpensePanel.tsx`
- `apps/web/app/journal/[recipientId]/JournalClient.tsx` — render ExpensePanel

#### Acceptance criteria

- [ ] Coordinator/caregiver can log an expense with amount, category, description
- [ ] All roles can see expense list and 30-day totals by category
- [ ] Supporter cannot create an expense (role-enforced)
- [ ] `numeric(10,2)` — no floating-point precision loss
- [ ] Zod rejects negative/zero amounts and invalid categories
- [ ] Vitest schema tests pass; pgTAP RLS tests pass

---

### P5-02 — Benefits Navigator

**Business value:** Most families don't know what programs exist. High perceived value, low implementation cost.

#### Schema

```sql
CREATE TABLE benefits_screenings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id),
  recipient_id uuid NOT NULL REFERENCES care_recipients(id),
  answers      jsonb NOT NULL,
  results      jsonb NOT NULL,
  created_by   uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

**RLS:** Coordinator-only read/write.

#### Eligibility logic: `apps/web/lib/benefitsEligibility.ts`

Pure function — no DB, no external API calls, fully testable:

```ts
type ScreenerAnswers = {
  age65plus: boolean
  veteran: boolean
  lowIncome: boolean
  medicareEnrolled: boolean
  medicaidEnrolled: boolean
}

type BenefitProgram = {
  key: string
  name: string
  description: string
  applyUrl: string
}

function eligibility(answers: ScreenerAnswers): BenefitProgram[]
```

**Programs covered (MVP):**
- Medicare Part D Extra Help
- Medicaid HCBS waiver
- VA Aid & Attendance
- PACE programs
- State SHIP counseling

#### tRPC router: `apps/web/server/routers/benefits.ts`

- `benefits.screen` — coordinator only; saves answers + results
- `benefits.latest` — coordinator only; returns most recent screening for recipient

#### UI: `apps/web/app/journal/[recipientId]/BenefitsNavigator.tsx`

- Coordinator-only panel — hidden from all other roles
- Short screener: age ≥ 65? Veteran? Low income? Medicare enrolled? Medicaid enrolled?
- Results: matching programs with plain-language description + link to apply
- On revisit: shows last saved results with option to re-run screener

#### Files

- `supabase/migrations/YYYYMMDD_benefits_screenings.sql`
- `apps/web/lib/benefitsEligibility.ts`
- `apps/web/lib/__tests__/benefitsEligibility.test.ts`
- `apps/web/server/routers/benefits.ts`
- `apps/web/server/trpc/router.ts` — wire benefitsRouter
- `apps/web/app/journal/[recipientId]/BenefitsNavigator.tsx`
- `apps/web/app/journal/[recipientId]/JournalClient.tsx` — render BenefitsNavigator

#### Acceptance criteria

- [ ] Coordinator can complete screener and see matching programs
- [ ] Results are saved and retrievable (latest shown on revisit)
- [ ] Non-coordinator roles cannot access the panel
- [ ] Pure `eligibility(answers)` has Vitest tests for each program's rules
- [ ] No external API calls — all logic is local

---

## Wave 2

### P5-03 — Document Vault

**Business value:** POA and advance directive in one place the whole team can access. Eliminates "where is the DNR?" crisis at 2am.

#### Schema

```sql
CREATE TABLE documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id),
  recipient_id  uuid NOT NULL REFERENCES care_recipients(id),
  uploaded_by   uuid NOT NULL,
  display_name  text NOT NULL,
  doc_type      text NOT NULL CHECK (doc_type IN (
    'hipaa_authorization', 'power_of_attorney', 'advance_directive',
    'insurance_card', 'medication_list', 'other'
  )),
  storage_path  text NOT NULL,
  file_size     integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

**RLS:** All org members read. Coordinator insert/delete.

**Storage bucket:** `care-documents` — private, no public URLs.

#### API routes

- `POST /api/documents/upload` — coordinator only; multipart upload to `care-documents`; inserts documents row
- `GET /api/documents/[documentId]/download` — all org members; generates **180-second** signed URL via `supabaseAdmin.storage.createSignedUrl()`; redirects to signed URL

#### tRPC router: `apps/web/server/routers/documents.ts`

- `documents.list` — all org members; returns document rows (no storage URLs)
- `documents.delete` — coordinator only; deletes row + removes from storage

#### UI: `apps/web/app/journal/[recipientId]/DocumentVault.tsx`

- Collapsible panel — all roles view/download; coordinator upload/delete
- Document list: type badge, display name, uploader, date, download button
- Upload form: file input, display name, type selector
- Download: opens signed URL in new tab (180-second expiry)

#### Files

- `supabase/migrations/YYYYMMDD_documents.sql`
- `supabase/tests/documents_rls.test.sql`
- `apps/web/app/api/documents/upload/route.ts`
- `apps/web/app/api/documents/upload/route.test.ts`
- `apps/web/app/api/documents/[documentId]/download/route.ts`
- `apps/web/app/api/documents/[documentId]/download/route.test.ts`
- `apps/web/server/routers/documents.ts`
- `apps/web/server/trpc/router.ts` — wire documentsRouter
- `apps/web/app/journal/[recipientId]/DocumentVault.tsx`
- `apps/web/app/journal/[recipientId]/JournalClient.tsx` — render DocumentVault

#### Acceptance criteria

- [ ] Coordinator can upload a document (file + display name + type)
- [ ] All org members can view document list and download via signed URL
- [ ] Signed URL expires after 180 seconds (no persistent public URL)
- [ ] Supporter cannot upload or delete documents (role-enforced)
- [ ] Coordinator can delete a document (removes from storage + table)
- [ ] pgTAP RLS tests pass; API route tests pass

---

### P5-04 — End-of-Life Planner

**Business value:** The conversation families put off. Private, structured, one plan per recipient.

**Prerequisite:** P5-03 must be merged first (EOL planner surfaces advance directive documents from vault).

#### Schema

```sql
CREATE TABLE eol_plans (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations(id),
  recipient_id        uuid NOT NULL REFERENCES care_recipients(id),
  created_by          uuid NOT NULL,
  healthcare_proxy    text,
  resuscitation_pref  text CHECK (resuscitation_pref IN ('full', 'dnr', 'dnr_comfort_only')),
  funeral_pref        text,
  legacy_message      text,
  attorney_name       text,
  attorney_contact    text,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipient_id)
);
```

**RLS:** Coordinator-only read/write. Completely invisible to caregiver, aide, supporter.

#### tRPC router: `apps/web/server/routers/eolPlan.ts`

- `eolPlan.get` — coordinator only; returns plan or null
- `eolPlan.upsert` — coordinator only; UPSERT on `recipient_id`

#### UI: `apps/web/app/journal/[recipientId]/EolPlanner.tsx`

- Coordinator-only — completely hidden from all other roles
- Read-only display until "Edit" clicked
- Fields: healthcare proxy name + contact, resuscitation preference (radio), funeral preferences (textarea), legacy message (textarea), attorney name + contact
- After save: "Saved. The team will never see this until you share it."
- Attached documents: lists documents with `doc_type = 'advance_directive'` from vault (read-only links, no new upload)

#### Files

- `supabase/migrations/YYYYMMDD_eol_plans.sql`
- `supabase/tests/eol_plans_rls.test.sql`
- `packages/schemas/src/eolPlan.ts`
- `packages/schemas/src/index.ts` — re-export
- `packages/schemas/src/__tests__/eolPlan.test.ts`
- `apps/web/server/routers/eolPlan.ts`
- `apps/web/server/trpc/router.ts` — wire eolPlanRouter
- `apps/web/app/journal/[recipientId]/EolPlanner.tsx`
- `apps/web/app/journal/[recipientId]/JournalClient.tsx` — render EolPlanner (coordinator only)

#### Acceptance criteria

- [ ] Coordinator can create/update an end-of-life plan
- [ ] Plan completely hidden from caregiver, supporter, and aide roles
- [ ] Resuscitation preference constrained to valid enum values
- [ ] Advance directive documents from vault surfaced inline (read-only links)
- [ ] One plan per recipient (upsert, not append)
- [ ] pgTAP RLS tests confirm no non-coordinator access
- [ ] Vitest schema tests pass

---

## UI Panel Order in JournalClient

```
[existing panels...]
BurnoutCheckin
ExpensePanel         ← P5-01
BenefitsNavigator    ← P5-02 (coordinator only)
DocumentVault        ← P5-03
EolPlanner           ← P5-04 (coordinator only)
ExportButton
```

## Role Visibility

| Panel | Supporter | Aide | Caregiver | Coordinator |
|---|---|---|---|---|
| ExpensePanel | read | read | read + write | read + write + delete |
| BenefitsNavigator | hidden | hidden | hidden | full access |
| DocumentVault | read + download | read + download | read + download | + upload + delete |
| EolPlanner | hidden | hidden | hidden | full access |

## Deviations from Backlog

| Item | Backlog | This spec |
|---|---|---|
| Expense amount type | `integer` cents | `numeric(10,2)` decimal |
| Document signed URL TTL | 60 seconds | 180 seconds |
