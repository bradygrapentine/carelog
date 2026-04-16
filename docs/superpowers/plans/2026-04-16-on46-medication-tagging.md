# ON-46 — Medication Tagging + Tag Filters + Document Links

**Branch:** `feat/on46-medication-tagging`  
**Worktree:** `.worktrees/on46-medication-tagging`  
**Estimated:** ~2.5 days → ~8 hr with parallel subagents  
**Prerequisite:** ON-10 document FTS ✅ (migration `20260419000000_documents_fts.sql` — `extracted_text` column exists)

---

## What we're building

Two junction tables link medications to the rest of the app:
- `care_event_medications` — which events mention a medication
- `document_medications` — which vault documents reference a medication

Auto-tagging fires server-side (never exposes PHI to client) using text-match against `drug_name`/`brand_name`. Users can also tag/untag manually. Chip-filter bars in Journal and Vault let caregivers filter by medication. A medication detail panel gains "Linked documents" and "Recent mentions" sections.

---

## Architecture decisions

- **Text-match approach:** Simple `ILIKE` against `drug_name` and `brand_name` — no NLP, no external service. Run server-side inside the tRPC `insert` mutation after event creation. Precision target ≥80% on a 10-item synthetic sample tested in Vitest.
- **Auto-tag documents:** Hook into `documents.extracted_text` update path (OCR pipeline sets it). Inngest function `autoTagDocumentMedications` fires when OCR job completes (event already exists: `inngest/ocr`).
- **RLS design:** Junction tables are org-scoped via JOIN. Members read; any member can manually tag/untag their own event; coordinators can tag/untag any event or document.
- **No new Postgres types:** confidence uses `text CHECK(IN ('manual','auto'))` per project convention.
- **Chip filter:** Client-side, not server-side — `useMemo` filter on already-loaded data. List of active medications is fetched once per page load.

---

## Tasks

### Task A — Migration + pgTAP (Sonnet)

**Files:**
- Create: `supabase/migrations/20260416000001_medication_tagging.sql`
- Create: `supabase/tests/medication_tagging_rls.test.sql`

**Migration:**

```sql
-- ON-46: Medication tagging — junction tables
CREATE TABLE care_event_medications (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  care_event_id  uuid        NOT NULL REFERENCES care_events(id) ON DELETE CASCADE,
  medication_id  uuid        NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  org_id         uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  confidence     text        NOT NULL DEFAULT 'auto'
                               CHECK (confidence IN ('manual', 'auto')),
  tagged_by      uuid        REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(care_event_id, medication_id)
);

CREATE TABLE document_medications (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    uuid        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  medication_id  uuid        NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  org_id         uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  confidence     text        NOT NULL DEFAULT 'auto'
                               CHECK (confidence IN ('manual', 'auto')),
  tagged_by      uuid        REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, medication_id)
);

-- Indexes
CREATE INDEX idx_care_event_medications_event ON care_event_medications(care_event_id);
CREATE INDEX idx_care_event_medications_med   ON care_event_medications(medication_id);
CREATE INDEX idx_document_medications_doc     ON document_medications(document_id);
CREATE INDEX idx_document_medications_med     ON document_medications(medication_id);

-- RLS
ALTER TABLE care_event_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_medications   ENABLE ROW LEVEL SECURITY;

-- care_event_medications: org members read
CREATE POLICY "org members read care_event_medications"
  ON care_event_medications FOR SELECT
  USING (user_is_org_member(org_id));

-- care_event_medications: any org member can insert (manual tag)
CREATE POLICY "org members insert care_event_medications"
  ON care_event_medications FOR INSERT
  WITH CHECK (user_is_org_member(org_id));

-- care_event_medications: tagger or coordinator can delete
CREATE POLICY "tagger or coordinator can delete care_event_medications"
  ON care_event_medications FOR DELETE
  USING (
    tagged_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = care_event_medications.org_id
        AND m.user_id = auth.uid()
        AND m.role = 'coordinator'
        AND m.accepted_at IS NOT NULL
    )
  );

-- document_medications: org members read
CREATE POLICY "org members read document_medications"
  ON document_medications FOR SELECT
  USING (user_is_org_member(org_id));

-- document_medications: coordinator insert (vault is coordinator-only)
CREATE POLICY "coordinator insert document_medications"
  ON document_medications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = document_medications.org_id
        AND m.user_id = auth.uid()
        AND m.role = 'coordinator'
        AND m.accepted_at IS NOT NULL
    )
  );

-- document_medications: coordinator delete
CREATE POLICY "coordinator delete document_medications"
  ON document_medications FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = document_medications.org_id
        AND m.user_id = auth.uid()
        AND m.role = 'coordinator'
        AND m.accepted_at IS NOT NULL
    )
  );
```

**pgTAP tests** (follow `supabase/tests/` patterns):
- `care_event_medications`: org member SELECT passes; non-member blocked; INSERT passes for member; DELETE by tagger passes; DELETE by coordinator passes; DELETE by non-tagger non-coordinator blocked
- `document_medications`: SELECT passes for member; non-member blocked; INSERT only for coordinator; DELETE only for coordinator

**AC:** `supabase test db` green with ≥12 assertions.

---

### Task B — Zod schemas (Haiku)

**Files:**
- Create: `packages/schemas/src/medicationTagging.ts`
- Modify: `packages/schemas/src/index.ts` (add export)

**Schemas:**
```ts
// Tag a care event with a medication (manual)
export const tagCareEventInput = z.object({
  care_event_id: z.string().uuid(),
  medication_id: z.string().uuid(),
  org_id: z.string().uuid(),
});

// Tag a document with a medication (manual)
export const tagDocumentInput = z.object({
  document_id: z.string().uuid(),
  medication_id: z.string().uuid(),
  org_id: z.string().uuid(),
});

// Untag
export const untagCareEventInput = z.object({
  tag_id: z.string().uuid(),
  org_id: z.string().uuid(),
});
export const untagDocumentInput = z.object({
  tag_id: z.string().uuid(),
  org_id: z.string().uuid(),
});

// List tags for an event or document
export const listTagsForEventInput = z.object({
  care_event_id: z.string().uuid(),
});
export const listTagsForDocumentInput = z.object({
  document_id: z.string().uuid(),
});

// Medication with stats
export const medicationGetInput = z.object({
  medication_id: z.string().uuid(),
  org_id: z.string().uuid(),
});
```

Also export output types:
```ts
export type MedicationTag = {
  id: string;
  medication_id: string;
  drug_name: string;
  brand_name: string | null;
  confidence: "manual" | "auto";
  tagged_by: string | null;
  created_at: string;
};
```

**AC:** `pnpm typecheck` clean; schemas importable from `@carelog/schemas`.

---

### Task C — Repository layer (Sonnet)

**Files:**
- Create: `apps/web/server/repositories/medicationTaggingRepository.ts`

**Functions:**
```ts
// Tag a care event — used by both auto-tagger and manual tRPC
export async function tagCareEvent(params: {
  careEventId: string;
  medicationId: string;
  orgId: string;
  confidence: "manual" | "auto";
  taggedBy: string | null;
}): Promise<void>

// Untag
export async function untagCareEvent(tagId: string, orgId: string): Promise<void>

// List tags for a care event (with medication details joined)
export async function listTagsForCareEvent(careEventId: string): Promise<MedicationTag[]>

// Tag a document
export async function tagDocument(params: {...}): Promise<void>
export async function untagDocument(tagId: string, orgId: string): Promise<void>
export async function listTagsForDocument(documentId: string): Promise<MedicationTag[]>

// Auto-tagger: given a care event, find matching medications and create tags
// Returns number of tags created
export async function autoTagCareEvent(
  careEventId: string,
  orgId: string,
  recipientId: string
): Promise<number>

// Auto-tagger for documents (called from Inngest after OCR)
export async function autoTagDocument(
  documentId: string,
  orgId: string,
  recipientId: string
): Promise<number>

// List care events tagged with a medication (for "Recent mentions")
export async function listEventsForMedication(
  medicationId: string,
  limit?: number
): Promise<CareEvent[]>

// List documents tagged with a medication
export async function listDocumentsForMedication(
  medicationId: string
): Promise<Document[]>
```

**Auto-tag matching algorithm:**
```ts
// 1. Fetch org's active medications for this recipient
// 2. Build search terms: [drug_name, brand_name].filter(Boolean).map(s => s.toLowerCase())
// 3. Fetch care event payload text: JSON.stringify(payload).toLowerCase()
// 4. For each medication, check if any term appears in the payload text
// 5. Insert tags for matches with confidence = 'auto', tagged_by = null
// 6. Use ON CONFLICT DO NOTHING to be idempotent
```

**Precision test (in test file):**
```ts
// apps/web/server/repositories/__tests__/medicationTaggingRepository.precision.test.ts
// 10-item synthetic corpus: 8 should match, 2 should not
// Assert autoTagCareEvent returns ≥80% precision
```

Uses `supabaseAdmin` for auto-tagging (runs server-side, needs to bypass RLS). Manual tag/untag uses RLS-scoped client.

**AC:** `pnpm test` passes including precision test (≥80%).

---

### Task D — tRPC router extensions (Sonnet)

**Files:**
- Modify: `apps/web/server/routers/medications.ts` (add new procedures)
- Modify: `apps/web/server/routers/careEvents.ts` (call autoTagCareEvent after insert)

**New procedures on medicationsRouter:**
```ts
medications.tagEvent        // manual tag — calls tagCareEvent
medications.untagEvent      // calls untagCareEvent
medications.tagDocument     // coordinator only — calls tagDocument
medications.untagDocument   // coordinator only — calls untagDocument
medications.getTagsForEvent // returns MedicationTag[]
medications.getTagsForDocument // returns MedicationTag[]
medications.get             // returns single medication + linked docs + recent events
```

**Modify careEvents.insert:**
After successful insert, call `autoTagCareEvent(event.id, orgId, recipientId)` — fire-and-forget (`void`), never throw.

**`medications.get` shape:**
```ts
{
  ...medication,
  recentEvents: CareEvent[],  // last 5 events tagged with this med
  linkedDocuments: Document[], // all documents tagged with this med
}
```

**AC:** Logic tests in `apps/web/server/routers/__tests__/medications.logic.test.ts` covering: tag/untag flow, auto-tag on insert (mocked), get returns linked data.

---

### Task E — Web UI: Journal chip-filter bar (Sonnet)

**Files:**
- Modify: `apps/web/app/(app)/journal/[recipientId]/JournalTimeline.tsx`
- Create: `apps/web/components/medications/MedicationChipBar.tsx`
- Create: `apps/web/components/medications/__tests__/MedicationChipBar.test.tsx`

**MedicationChipBar component:**
```tsx
// Props: medications: Medication[], selected: string | null, onSelect: (id: string | null) => void
// Renders horizontal scrollable chip list
// "All" chip always first, then one chip per active medication
// Selected chip: primary background + white text
// Unselected: primarySubtle bg + primary text
// Accessible: role="radio", aria-pressed per chip
```

**JournalTimeline changes:**
1. Fetch active medications for recipient (`trpc.medications.list`)
2. Fetch tags for visible events (`trpc.medications.getTagsForEvent` — batch by care_event_ids)
3. Add `selectedMedicationId` state
4. Filter `list` by: if `selectedMedicationId`, only show events whose `id` is in tagged events set
5. Mount `<MedicationChipBar>` above the timeline list

**Edge cases:**
- Empty medications list → chip bar not shown
- No events tagged with selected med → show empty state "No journal entries mention this medication."
- Loading state: chip bar skeleton (3 chips)

**AC:** `pnpm test` green; chip bar renders; selecting a chip filters the list; selecting "All" resets; keyboard-navigable; no raw hex.

---

### Task F — Web UI: Vault chip-filter bar (Haiku)

**Files:**
- Modify: `apps/web/app/(app)/documents/` (wherever the document list is rendered)
- Reuse `MedicationChipBar` component from Task E

**Work:** Same pattern as Task E but for the document list. Fetch document medications with `trpc.medications.getTagsForDocument`. Filter by selected medication chip.

**AC:** Chip bar renders above document list; filters correctly; tests green.

---

### Task G — Web UI: Medication detail enhancements (Sonnet)

**Files:**
- Modify: `apps/web/app/(app)/medications/` or `apps/web/components/medications/` (wherever the medication detail/card is)
- Create: `apps/web/components/medications/MedicationLinkedDocs.tsx`
- Create: `apps/web/components/medications/MedicationRecentEvents.tsx`

**MedicationLinkedDocs:** List of documents tagged with this medication, each showing display_name and doc_type badge.

**MedicationRecentEvents:** Last 5 care events tagged with this medication, each showing occurred_at, actor, and payload summary.

Both use `trpc.medications.get` which returns the full shape.

**AC:** New sections render in medication detail; empty states shown when no data; tests green.

---

### Task H — E2E spec (Haiku)

**Files:**
- Create: `e2e/medication-tagging.spec.ts`

**Tests:**
1. Journal loads with medication chip bar visible
2. Selecting a medication chip filters the journal list
3. "All" chip resets the filter
4. Vault page: chip bar visible
5. Medication detail shows "Linked documents" and "Recent mentions" sections

**AC:** All 5 tests pass.

---

## Execution order

Tasks A and B can run in parallel (no shared files). C depends on A (table must exist for precision test). D depends on B+C. E and F can run in parallel after D (share MedicationChipBar but Task E creates it, Task F reuses). G and H run after E+F.

```
T0: Task A (Sonnet) ─────────────────────────────────┐
    Task B (Haiku)  ──────────────────────────────────┤
                                                      ↓
T1: Task C (Sonnet) ──────────────────────────────────┐
                                                      ↓
T2: Task D (Sonnet) ──────────────────────────────────┐
                                                      ↓
T3: Task E (Sonnet) ──────────── ┐
    Task F (Haiku)  ─────────────┤
                                 ↓
T4: Task G (Sonnet) ─────────────┤
    Task H (Haiku)  ─────────────┘
```

---

## Definition of done

- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` green (includes precision test ≥80%)
- [ ] `supabase test db` green (pgTAP RLS coverage)
- [ ] `pnpm lint` clean
- [ ] Chip bars keyboard-navigable; focus rings visible
- [ ] No raw hex in any changed file
- [ ] Auto-tag runs server-side only; no medication names in client responses beyond what's already visible
- [ ] BACKLOG.md updated in same commit as first task commit

---

## Subagent scope contract template

```
FILES ALLOWED: [exact list from task above]
BRANCH: feat/on46-medication-tagging
WORKTREE: /Users/bradygrapentine/projects/carelog/.worktrees/on46-medication-tagging
DO NOT: touch supabase/migrations other than 20260416000001_medication_tagging.sql,
        modify existing RLS policies, pass PHI to PostHog, add new npm packages without asking
PHI RULE: auto-tag logic runs server-side; never expose full payload text to client
VERIFY: git branch --show-current (must be feat/on46-medication-tagging), pnpm typecheck && pnpm test before commit
RETURN: status (DONE/DONE_WITH_CONCERNS/NEEDS_CONTEXT/BLOCKED), diff summary, test count
```
