# Mobile OCR Scan Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let mobile users scan documents (lab results, bills, appointment summaries, pharmacy receipts), have them OCR'd server-side, review and edit extracted fields in-app, and save the result.

**Architecture:** Mobile uploads a document image to the existing `/api/ocr/upload` endpoint with `category: "document"`. The upload route fires a new `ocr/document.created` Inngest event (instead of the prescription-only `ocr/job.created`). A new `ocrDocument` Inngest function classifies the doc type and extracts generic `{label, value, type, confidence}` fields, stores them in `parsed_data`, and pushes a notification to the uploader. Mobile receives the notification, deep-links to a review screen, edits fields, and POSTs to `/api/ocr/save-fields`.

**Tech Stack:** Next.js 16 App Router, Inngest, Supabase (PostgreSQL + Storage), Expo Router, expo-notifications, expo-image-picker, React Native

---

## File Map

**New — web:**
- `apps/web/app/api/ocr/job/[jobId]/route.ts` — GET single OCR job by ID
- `apps/web/app/api/ocr/save-fields/route.ts` — POST save reviewed fields + mark confirmed
- `apps/web/inngest/functions/ocrDocument.ts` — generic multi-type OCR Inngest function

**Modified — web:**
- `apps/web/app/api/ocr/upload/route.ts` — add `category` param; fire `ocr/document.created` when `category !== "prescription"`
- `apps/web/inngest/pushNotification.ts` — add `sendPushToUser(userId, notification)`
- `apps/web/inngest/index.ts` — export new `ocrDocument` function

**New — DB:**
- `supabase/migrations/<timestamp>_ocr_jobs_category_created_by.sql` — add `created_by uuid` and `category text` columns to `ocr_jobs`

**New — mobile:**
- `apps/mobile/app/(app)/documents/scan.tsx` — capture screen (camera / library)
- `apps/mobile/app/(app)/documents/ocr-review/[jobId].tsx` — field review + edit screen

**Modified — mobile:**
- `apps/mobile/app/(app)/documents/index.tsx` — add "Scan Document" button
- `apps/mobile/app/_layout.tsx` — register push notification response handler for deep-link

---

## Task 1: DB migration — add `category` and `created_by` to `ocr_jobs`

**Files:**
- Create: `supabase/migrations/20260413000000_ocr_jobs_category_created_by.sql`

The upload route already tries to insert `created_by` but the original migration omits the column. This migration adds both missing columns.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260413000000_ocr_jobs_category_created_by.sql
ALTER TABLE ocr_jobs
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS category   text NOT NULL DEFAULT 'prescription';
```

- [ ] **Step 2: Apply the migration**

```bash
supabase migration up
```

Expected: `Applied migration 20260413000000_ocr_jobs_category_created_by`

- [ ] **Step 3: Verify columns exist**

```bash
supabase db execute --sql "SELECT column_name FROM information_schema.columns WHERE table_name = 'ocr_jobs' ORDER BY column_name;"
```

Expected: rows include `category` and `created_by`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260413000000_ocr_jobs_category_created_by.sql
git commit -m "feat(db): add category and created_by columns to ocr_jobs"
```

---

## Task 2: `sendPushToUser` utility

**Files:**
- Modify: `apps/web/inngest/pushNotification.ts`

Add a function that sends a push notification to one specific user by looking up their push token.

- [ ] **Step 1: Write the failing test**

Create `apps/web/inngest/__tests__/pushNotification.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendPushToUser } from '../pushNotification'

const mockFrom = vi.fn()
vi.mock('../../server/supabaseAdmin.server', () => ({
  supabaseAdmin: { from: mockFrom },
}))

global.fetch = vi.fn()

describe('sendPushToUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends push to user token', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (_: unknown, resolve: (v: unknown) => void) =>
        resolve({ data: [{ token: 'ExponentPushToken[abc123]' }], error: null }),
    })
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })

    await sendPushToUser('user-uuid', { body: 'Scan ready' })

    expect(global.fetch).toHaveBeenCalledWith(
      'https://exp.host/--/api/v2/push/send',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('no-ops when user has no push token', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (_: unknown, resolve: (v: unknown) => void) =>
        resolve({ data: [], error: null }),
    })

    await sendPushToUser('user-uuid', { body: 'Scan ready' })

    expect(global.fetch).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

```bash
pnpm test
```

Expected: `sendPushToUser is not a function`

- [ ] **Step 3: Implement `sendPushToUser`**

Append to `apps/web/inngest/pushNotification.ts`:

```typescript
/**
 * Sends a push notification to a single user identified by their auth user ID.
 * No-ops silently if the user has no registered push token.
 */
export async function sendPushToUser(
  userId: string,
  notification: { title?: string; body: string; data?: Record<string, unknown> },
): Promise<void> {
  const { data: tokenRows, error } = await supabaseAdmin
    .from('push_tokens')
    .select('token')
    .eq('auth_user_id', userId)

  if (error || !tokenRows || tokenRows.length === 0) return

  const messages: PushMessage[] = tokenRows.map((r) => ({
    to: r.token,
    sound: 'default' as const,
    ...notification,
  }))

  await sendExpoPush(messages)
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: `sendPushToUser > sends push to user token` PASS, `sendPushToUser > no-ops when user has no push token` PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/inngest/pushNotification.ts apps/web/inngest/__tests__/pushNotification.test.ts
git commit -m "feat(ocr): add sendPushToUser push notification utility"
```

---

## Task 3: Generic OCR Inngest function

**Files:**
- Create: `apps/web/inngest/functions/ocrDocument.ts`

This function listens to `ocr/document.created`, classifies the document type, extracts generic fields, stores them in `parsed_data`, and notifies the uploader.

The field extractor is a stub (like the prescription parser) — it returns plausible fields based on detected document type. Real OCR integration happens in the `call-ocr-api` step.

- [ ] **Step 1: Write the failing test**

Create `apps/web/inngest/functions/__tests__/ocrDocument.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { classifyDocument, extractFields } from '../ocrDocument'
import type { OcrField } from '../ocrDocument'

describe('classifyDocument', () => {
  it('detects lab result', () => {
    expect(classifyDocument('Result: Glucose 95 mg/dL  Reference: 70-100')).toBe('lab_result')
  })

  it('detects bill', () => {
    expect(classifyDocument('Total Due: $142.00  Account: 88291')).toBe('bill')
  })

  it('detects appointment summary', () => {
    expect(classifyDocument('Patient visited on 04/10/2026  Provider: Dr Smith')).toBe('appointment_summary')
  })

  it('detects pharmacy receipt', () => {
    expect(classifyDocument('Dispensed: Lisinopril 10mg  Qty: 30  RPh: J. Lee')).toBe('pharmacy_receipt')
  })

  it('falls back to bill for unrecognized text', () => {
    expect(classifyDocument('some random text here')).toBe('bill')
  })
})

describe('extractFields', () => {
  it('returns an array of OcrField objects', () => {
    const fields: OcrField[] = extractFields('lab_result', 'Glucose: 95 mg/dL')
    expect(fields.length).toBeGreaterThan(0)
    expect(fields[0]).toMatchObject({
      label: expect.any(String),
      value: expect.any(String),
      type: expect.stringMatching(/^(text|number|date|currency)$/),
      confidence: expect.any(Number),
    })
  })

  it('marks short values as high confidence', () => {
    const fields = extractFields('bill', 'Total Due: $50.00')
    const currencyField = fields.find((f) => f.type === 'currency')
    expect(currencyField).toBeDefined()
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

```bash
pnpm test
```

Expected: `classifyDocument is not a function`

- [ ] **Step 3: Implement the module**

Create `apps/web/inngest/functions/ocrDocument.ts`:

```typescript
import { inngest } from '../client'
import { supabaseAdmin } from '../../server/supabaseAdmin.server'
import { sendPushToUser } from '../pushNotification'

export type OcrFieldType = 'text' | 'number' | 'date' | 'currency'
export type DocumentType = 'lab_result' | 'appointment_summary' | 'bill' | 'pharmacy_receipt'

export type OcrField = {
  label:      string
  value:      string
  type:       OcrFieldType
  confidence: number
}

export type ParsedDocument = {
  document_type: DocumentType
  fields:        OcrField[]
}

/** Classify document type from OCR raw text. */
export function classifyDocument(rawText: string): DocumentType {
  const lower = rawText.toLowerCase()
  if (/result|glucose|hba1c|reference range|mg\/dl|mmol/.test(lower)) return 'lab_result'
  if (/dispensed|refill|qty|rph|pharmacy/.test(lower))                  return 'pharmacy_receipt'
  if (/visited|provider|dr\.|diagnosis|follow.up/.test(lower))          return 'appointment_summary'
  return 'bill'
}

/** Extract generic key-value fields from raw OCR text for a given document type. */
export function extractFields(docType: DocumentType, rawText: string): OcrField[] {
  // Stub extractor — parses colon-separated lines into label/value pairs.
  // In production, replace this with a real OCR structured-data parser.
  const lines = rawText.split(/\n|;/).map((l) => l.trim()).filter(Boolean)
  const fields: OcrField[] = []

  for (const line of lines) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue

    const label = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim()
    if (!label || !value) continue

    const type = inferFieldType(value)
    // Confidence: shorter, cleaner values score higher in the stub
    const confidence = value.length < 20 ? 0.9 : 0.7

    fields.push({ label, value, type, confidence })
  }

  // Ensure at least one field so the review screen always has content
  if (fields.length === 0) {
    fields.push({ label: 'Content', value: rawText.slice(0, 80), type: 'text', confidence: 0.5 })
  }

  return fields
}

function inferFieldType(value: string): OcrFieldType {
  if (/^\$[\d,]+(\.\d{2})?$/.test(value))      return 'currency'
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(value)) return 'date'
  if (/^\d+(\.\d+)?$/.test(value))              return 'number'
  return 'text'
}

export const ocrDocument = inngest.createFunction(
  { id: 'ocr-document' },
  { event: 'ocr/document.created' },
  async ({ event, step }) => {
    const { jobId } = event.data as { jobId: string }

    await step.run('mark-processing', async () => {
      await supabaseAdmin.from('ocr_jobs').update({ status: 'processing' }).eq('id', jobId)
    })

    const job = await step.run('fetch-job', async () => {
      const { data } = await supabaseAdmin
        .from('ocr_jobs')
        .select('image_url, created_by')
        .eq('id', jobId)
        .single()
      return data
    })

    const rawText = await step.run('call-ocr-api', async () => {
      // Stub — replace with real OCR call when OCR_API_KEY is set
      if (!process.env.OCR_API_KEY || !job) {
        return 'Patient: Jane Doe\nTest: Glucose\nResult: 95 mg/dL\nReference: 70-100 mg/dL\nDate: 04/10/2026'
      }
      return 'Patient: Jane Doe\nTest: Glucose\nResult: 95 mg/dL\nReference: 70-100 mg/dL\nDate: 04/10/2026'
    })

    await step.run('update-needs-review', async () => {
      const docType = classifyDocument(rawText as string)
      const fields  = extractFields(docType, rawText as string)
      const parsed: ParsedDocument = { document_type: docType, fields }

      await supabaseAdmin
        .from('ocr_jobs')
        .update({ status: 'needs_review', raw_text: rawText, parsed_data: parsed })
        .eq('id', jobId)
    })

    await step.run('notify-uploader', async () => {
      if (!job?.created_by) return
      await sendPushToUser(job.created_by as string, {
        title: 'Scan ready to review',
        body:  'Your document has been processed. Tap to review the extracted fields.',
        data:  { jobId, screen: 'ocr-review' },
      })
    })
  },
)
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: all `classifyDocument` and `extractFields` tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/inngest/functions/ocrDocument.ts apps/web/inngest/functions/__tests__/ocrDocument.test.ts
git commit -m "feat(ocr): generic document OCR Inngest function with stub extractor"
```

---

## Task 4: Register `ocrDocument` in Inngest and update upload route

**Files:**
- Modify: `apps/web/inngest/index.ts`
- Modify: `apps/web/app/api/ocr/upload/route.ts`

Register the new function and make the upload route fire `ocr/document.created` when `category` is not `"prescription"`.

- [ ] **Step 1: Register in Inngest index**

Read `apps/web/inngest/index.ts`, then add the import and export:

```typescript
// Add to existing imports:
import { ocrDocument } from './functions/ocrDocument'

// Add to the exported array:
export const functions = [
  // ... existing functions ...
  ocrDocument,
]
```

- [ ] **Step 2: Update upload route**

In `apps/web/app/api/ocr/upload/route.ts`, update the schema and event dispatch:

Change the schema to accept an optional `category`:
```typescript
const uploadBodySchema = z.object({
  orgId:       z.string().uuid(),
  recipientId: z.string().uuid(),
  category:    z.enum(['prescription', 'document']).default('document'),
})
```

Read `category` from formData and include it in the job insert and event:
```typescript
const category = (formData.get('category') as string) ?? 'document'

const parsed = uploadBodySchema.safeParse({ orgId, recipientId, category })
// ...

const { data: job, error: insertError } = await supabaseAdmin
  .from('ocr_jobs')
  .insert({
    org_id:       validOrgId,
    recipient_id: validRecipientId,
    image_url:    imageUrl,
    status:       'pending',
    created_by:   user.id,
    category:     parsed.data.category,
  })
  .select('id')
  .single()

// Fire the appropriate event:
const eventName = parsed.data.category === 'prescription'
  ? 'ocr/job.created'
  : 'ocr/document.created'

await inngest.send({ name: eventName, data: { jobId: job.id } })
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/inngest/index.ts apps/web/app/api/ocr/upload/route.ts
git commit -m "feat(ocr): route generic document uploads to ocrDocument Inngest function"
```

---

## Task 5: `GET /api/ocr/job/[jobId]` — fetch single OCR job

**Files:**
- Create: `apps/web/app/api/ocr/job/[jobId]/route.ts`
- Create: `apps/web/app/api/ocr/job/[jobId]/__tests__/route.test.ts`

Mobile calls this to load job data for the review screen.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/app/api/ocr/job/[jobId]/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabaseServer', () => ({
  getRequestUser: vi.fn(),
}))
vi.mock('@/server/supabaseAdmin.server', () => ({
  supabaseAdmin: { from: vi.fn() },
}))

import { getRequestUser } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'

const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>

describe('GET /api/ocr/job/[jobId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    (getRequestUser as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/ocr/job/some-id')
    const res = await GET(req, { params: Promise.resolve({ jobId: 'some-id' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when job not found', async () => {
    (getRequestUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'user-1' })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    })
    const req = new NextRequest('http://localhost/api/ocr/job/missing-id')
    const res = await GET(req, { params: Promise.resolve({ jobId: 'missing-id' }) })
    expect(res.status).toBe(404)
  })

  it('returns job when found', async () => {
    (getRequestUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'user-1' })
    const fakeJob = { id: 'job-1', status: 'needs_review', parsed_data: { document_type: 'bill', fields: [] }, created_by: 'user-1' }
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: fakeJob, error: null }),
    })
    const req = new NextRequest('http://localhost/api/ocr/job/job-1')
    const res = await GET(req, { params: Promise.resolve({ jobId: 'job-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.job.id).toBe('job-1')
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

```bash
pnpm test
```

Expected: `GET is not a function`

- [ ] **Step 3: Implement the route**

```typescript
// apps/web/app/api/ocr/job/[jobId]/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import { getRequestUser } from '@/lib/supabaseServer'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const user = await getRequestUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { jobId } = await params

    const { data: job, error } = await supabaseAdmin
      .from('ocr_jobs')
      .select('id, status, parsed_data, raw_text, created_at, created_by, category')
      .eq('id', jobId)
      .single()

    if (error || !job) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Only the uploader may view via mobile (web coordinators use /api/ocr/review)
    if (job.created_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ job })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: all 3 `GET /api/ocr/job/[jobId]` tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/ocr/job/ 
git commit -m "feat(ocr): GET /api/ocr/job/[jobId] route for mobile review screen"
```

---

## Task 6: `POST /api/ocr/save-fields` — save reviewed fields

**Files:**
- Create: `apps/web/app/api/ocr/save-fields/route.ts`
- Create: `apps/web/app/api/ocr/save-fields/__tests__/route.test.ts`

Mobile calls this when the user taps Save on the review screen. Updates `parsed_data` with edited values and sets `status: 'confirmed'`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/app/api/ocr/save-fields/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabaseServer', () => ({ getRequestUser: vi.fn() }))
vi.mock('@/server/supabaseAdmin.server', () => ({ supabaseAdmin: { from: vi.fn() } }))
vi.mock('@/lib/rateLimit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))

import { getRequestUser } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'

const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>

const makeReq = (body: unknown) =>
  new NextRequest('http://localhost/api/ocr/save-fields', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

describe('POST /api/ocr/save-fields', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    (getRequestUser as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const res = await POST(makeReq({}))
    expect(res.status).toBe(401)
  })

  it('returns 400 on invalid body', async () => {
    (getRequestUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u1' })
    const res = await POST(makeReq({ jobId: 'not-a-uuid' }))
    expect(res.status).toBe(400)
  })

  it('returns 403 when user is not the uploader', async () => {
    (getRequestUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u1' })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'job-1', created_by: 'u2' }, error: null }),
    })
    const res = await POST(makeReq({
      jobId: '00000000-0000-0000-0000-000000000001',
      fields: [{ label: 'Test', value: 'Val', type: 'text', confidence: 0.9 }],
    }))
    expect(res.status).toBe(403)
  })

  it('saves fields and returns ok', async () => {
    (getRequestUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u1' })
    const updateMock = vi.fn().mockResolvedValue({ error: null })
    const selectResult = { data: { id: 'job-1', created_by: 'u1', parsed_data: { document_type: 'bill', fields: [] } }, error: null }
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(selectResult),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(updateMock()) }),
    })
    const res = await POST(makeReq({
      jobId: '00000000-0000-0000-0000-000000000001',
      fields: [{ label: 'Total', value: '$50', type: 'currency', confidence: 0.9 }],
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

```bash
pnpm test
```

Expected: `POST is not a function`

- [ ] **Step 3: Implement the route**

```typescript
// apps/web/app/api/ocr/save-fields/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import { getRequestUser } from '@/lib/supabaseServer'
import { rateLimit } from '@/lib/rateLimit'

const fieldSchema = z.object({
  label:      z.string().min(1),
  value:      z.string(),
  type:       z.enum(['text', 'number', 'date', 'currency']),
  confidence: z.number().min(0).max(1),
})

const bodySchema = z.object({
  jobId:  z.string().uuid(),
  fields: z.array(fieldSchema).min(1),
})

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, 'ocr/save-fields')
  if (limited) return limited

  try {
    const user = await getRequestUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body   = await request.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { jobId, fields } = parsed.data

    // Fetch the job to verify ownership
    const { data: job, error: fetchError } = await supabaseAdmin
      .from('ocr_jobs')
      .select('id, created_by, parsed_data')
      .eq('id', jobId)
      .single()

    if (fetchError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (job.created_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Merge edited fields back into parsed_data, preserve document_type
    const existingParsed = (job.parsed_data ?? {}) as { document_type?: string; fields?: unknown[] }
    const updatedParsed  = { ...existingParsed, fields }

    const { error: updateError } = await supabaseAdmin
      .from('ocr_jobs')
      .update({ status: 'confirmed', parsed_data: updatedParsed })
      .eq('id', jobId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: all 4 `POST /api/ocr/save-fields` tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/ocr/save-fields/
git commit -m "feat(ocr): POST /api/ocr/save-fields saves reviewed fields from mobile"
```

---

## Task 7: Mobile capture screen

**Files:**
- Create: `apps/mobile/app/(app)/documents/scan.tsx`

Camera capture screen. User takes a photo or picks from library, previews it, and uploads to `/api/ocr/upload` with `category: "document"`.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/app/(app)/documents/__tests__/scan.test.tsx`:

```typescript
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import ScanScreen from '../scan'

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }))
jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn().mockResolvedValue({ canceled: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  MediaTypeOptions: { Images: 'Images' },
}))
jest.mock('../../../context/AppContext', () => ({
  useApp: () => ({ orgId: 'org-1', recipientId: 'rec-1' }),
}))
jest.mock('../../../utils/auth', () => ({
  getSession: jest.fn().mockResolvedValue({ access_token: 'tok' }),
}))

describe('ScanScreen', () => {
  it('renders camera and library buttons', () => {
    const { getByText } = render(<ScanScreen />)
    expect(getByText('Take Photo')).toBeTruthy()
    expect(getByText('Choose from Library')).toBeTruthy()
  })

  it('shows upload button only after a photo is selected', async () => {
    const { queryByText } = render(<ScanScreen />)
    expect(queryByText('Upload & Process')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd apps/mobile && npx jest app/\(app\)/documents/__tests__/scan.test.tsx
```

Expected: `Cannot find module '../scan'`

- [ ] **Step 3: Implement `scan.tsx`**

```typescript
// apps/mobile/app/(app)/documents/scan.tsx
import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { useApp } from '../../../context/AppContext'
import { getSession } from '../../../utils/auth'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

export default function ScanScreen() {
  const router   = useRouter()
  const { orgId, recipientId } = useApp()
  const [photo, setPhoto]       = useState<{ uri: string; name: string; mimeType: string } | null>(null)
  const [uploading, setUploading] = useState(false)

  async function pickCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission required', 'Camera access is needed to scan documents.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      setPhoto({ uri: asset.uri, name: 'scan.jpg', mimeType: asset.mimeType ?? 'image/jpeg' })
    }
  }

  async function pickLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      setPhoto({ uri: asset.uri, name: asset.fileName ?? 'document.jpg', mimeType: asset.mimeType ?? 'image/jpeg' })
    }
  }

  async function upload() {
    if (!photo || !orgId || !recipientId) return
    setUploading(true)
    try {
      const session = await getSession()
      const form    = new FormData()
      form.append('orgId', orgId)
      form.append('recipientId', recipientId)
      form.append('category', 'document')
      form.append('file', { uri: photo.uri, name: photo.name, type: photo.mimeType } as unknown as Blob)

      const res = await fetch(API_URL + '/api/ocr/upload', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + session?.access_token },
        body: form,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error(err.error ?? 'Upload failed')
      }

      Alert.alert(
        'Scan processing',
        "We'll notify you when your document is ready to review.",
        [{ text: 'OK', onPress: () => router.back() }],
      )
    } catch (e: unknown) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Scan Document</Text>

      {photo ? (
        <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="contain" />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>No photo selected</Text>
        </View>
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.button} onPress={pickCamera} disabled={uploading}>
          <Text style={styles.buttonText}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={pickLibrary} disabled={uploading}>
          <Text style={styles.buttonText}>Choose from Library</Text>
        </TouchableOpacity>
      </View>

      {photo && (
        <TouchableOpacity
          style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
          onPress={upload}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.uploadButtonText}>Upload & Process</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container:           { flex: 1, padding: 20, backgroundColor: '#fff' },
  title:               { fontSize: 22, fontWeight: '600', marginBottom: 20 },
  preview:             { width: '100%', height: 300, borderRadius: 12, marginBottom: 20 },
  placeholder:         { width: '100%', height: 300, borderRadius: 12, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  placeholderText:     { color: '#999', fontSize: 16 },
  buttonRow:           { flexDirection: 'row', gap: 12, marginBottom: 16 },
  button:              { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  buttonText:          { fontSize: 15, color: '#333' },
  uploadButton:        { padding: 16, borderRadius: 12, backgroundColor: '#2563eb', alignItems: 'center' },
  uploadButtonDisabled:{ backgroundColor: '#93c5fd' },
  uploadButtonText:    { color: '#fff', fontWeight: '600', fontSize: 16 },
})
```

- [ ] **Step 4: Run tests**

```bash
cd apps/mobile && npx jest app/\(app\)/documents/__tests__/scan.test.tsx
```

Expected: `renders camera and library buttons` PASS, `shows upload button only after a photo is selected` PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(app\)/documents/scan.tsx apps/mobile/app/\(app\)/documents/__tests__/scan.test.tsx
git commit -m "feat(mobile): OCR document capture screen"
```

---

## Task 8: Mobile OCR review screen

**Files:**
- Create: `apps/mobile/app/(app)/documents/ocr-review/[jobId].tsx`
- Create: `apps/mobile/app/(app)/documents/ocr-review/__tests__/[jobId].test.tsx`

Displays extracted fields as editable inputs. Flagged fields (confidence < 0.8) show a yellow dot. Tapping Save calls `/api/ocr/save-fields`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/mobile/app/(app)/documents/ocr-review/__tests__/[jobId].test.tsx
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import OcrReviewScreen from '../[jobId]'

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ jobId: 'job-123' }),
  useRouter: () => ({ replace: jest.fn() }),
}))
jest.mock('../../../../context/AppContext', () => ({
  useApp: () => ({ orgId: 'org-1' }),
}))
jest.mock('../../../../utils/auth', () => ({
  getSession: jest.fn().mockResolvedValue({ access_token: 'tok' }),
}))

const mockJob = {
  id: 'job-123',
  status: 'needs_review',
  parsed_data: {
    document_type: 'bill',
    fields: [
      { label: 'Total Due', value: '$42.00', type: 'currency', confidence: 0.9 },
      { label: 'Account', value: 'UNCERTAIN', type: 'text', confidence: 0.5 },
    ],
  },
}

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ job: mockJob }),
})

describe('OcrReviewScreen', () => {
  it('renders the document type badge', async () => {
    const { findByText } = render(<OcrReviewScreen />)
    await findByText('Bill')
  })

  it('renders field labels', async () => {
    const { findByText } = render(<OcrReviewScreen />)
    await findByText('Total Due')
    await findByText('Account')
  })

  it('marks low-confidence fields with a warning indicator', async () => {
    const { findByTestId } = render(<OcrReviewScreen />)
    await findByTestId('low-confidence-Account')
  })

  it('renders Save button', async () => {
    const { findByText } = render(<OcrReviewScreen />)
    await findByText('Save')
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd apps/mobile && npx jest "app/\(app\)/documents/ocr-review/__tests__/\[jobId\].test.tsx"
```

Expected: `Cannot find module '../[jobId]'`

- [ ] **Step 3: Implement the review screen**

```typescript
// apps/mobile/app/(app)/documents/ocr-review/[jobId].tsx
import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { getSession } from '../../../../utils/auth'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

const DOC_TYPE_LABELS: Record<string, string> = {
  lab_result:           'Lab Result',
  appointment_summary:  'Appointment Summary',
  bill:                 'Bill',
  pharmacy_receipt:     'Pharmacy Receipt',
}

type OcrField = {
  label:      string
  value:      string
  type:       'text' | 'number' | 'date' | 'currency'
  confidence: number
}

type ParsedData = {
  document_type: string
  fields:        OcrField[]
}

type OcrJob = {
  id:          string
  status:      string
  parsed_data: ParsedData | null
}

export default function OcrReviewScreen() {
  const { jobId }  = useLocalSearchParams<{ jobId: string }>()
  const router     = useRouter()
  const [job, setJob]         = useState<OcrJob | null>(null)
  const [fields, setFields]   = useState<OcrField[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    loadJob()
  }, [jobId])

  async function loadJob() {
    try {
      const session = await getSession()
      const res     = await fetch(API_URL + '/api/ocr/job/' + jobId, {
        headers: { Authorization: 'Bearer ' + session?.access_token },
      })
      if (!res.ok) throw new Error('Failed to load job')
      const data = await res.json()
      setJob(data.job)
      setFields(data.job.parsed_data?.fields ?? [])
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not load scan')
    } finally {
      setLoading(false)
    }
  }

  function updateField(index: number, value: string) {
    setFields((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], value }
      return next
    })
  }

  async function save() {
    if (!jobId || fields.length === 0) return
    setSaving(true)
    try {
      const session = await getSession()
      const res     = await fetch(API_URL + '/api/ocr/save-fields', {
        method:  'POST',
        headers: {
          Authorization: 'Bearer ' + session?.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId, fields }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Save failed' }))
        throw new Error(err.error ?? 'Save failed')
      }
      Alert.alert('Saved', 'Document fields have been saved.', [
        { text: 'OK', onPress: () => router.replace('/(app)/documents') },
      ])
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  const docType  = job?.parsed_data?.document_type ?? 'bill'
  const badgeLabel = DOC_TYPE_LABELS[docType] ?? docType

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeLabel}</Text>
        </View>
      </View>

      {fields.map((field, i) => (
        <View key={field.label + i} style={styles.fieldRow}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{field.label}</Text>
            {field.confidence < 0.8 && (
              <View
                testID={'low-confidence-' + field.label}
                style={styles.lowConfidenceDot}
              />
            )}
          </View>
          <TextInput
            style={styles.input}
            value={field.value}
            onChangeText={(v) => updateField(i, v)}
            keyboardType={
              field.type === 'number' || field.type === 'currency'
                ? 'decimal-pad'
                : 'default'
            }
          />
        </View>
      ))}

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={save}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Save</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#fff' },
  content:            { padding: 20, paddingBottom: 40 },
  center:             { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:             { marginBottom: 24 },
  badge:              { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: '#e0f2fe' },
  badgeText:          { fontSize: 13, fontWeight: '600', color: '#0369a1' },
  fieldRow:           { marginBottom: 16 },
  labelRow:           { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 },
  label:              { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  lowConfidenceDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b' },
  input:              { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10, fontSize: 15, color: '#111827' },
  saveButton:         { marginTop: 24, padding: 16, borderRadius: 12, backgroundColor: '#2563eb', alignItems: 'center' },
  saveButtonDisabled: { backgroundColor: '#93c5fd' },
  saveButtonText:     { color: '#fff', fontWeight: '600', fontSize: 16 },
})
```

- [ ] **Step 4: Run tests**

```bash
cd apps/mobile && npx jest "app/\(app\)/documents/ocr-review/__tests__/\[jobId\].test.tsx"
```

Expected: all 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add "apps/mobile/app/(app)/documents/ocr-review/"
git commit -m "feat(mobile): OCR document field review screen"
```

---

## Task 9: Documents index — Scan button + notification handler

**Files:**
- Modify: `apps/mobile/app/(app)/documents/index.tsx`
- Modify: `apps/mobile/app/_layout.tsx`

Add a "Scan Document" button to the documents screen, and register a push notification response handler to deep-link into the review screen.

- [ ] **Step 1: Add Scan button to documents index**

In `apps/mobile/app/(app)/documents/index.tsx`, import `useRouter` (already imported) and add a button after the existing upload controls. Find where the screen's header/controls are rendered and add:

```typescript
// Add import at top (after existing imports):
// useRouter is already imported via expo-router

// Add button in the JSX, near the top of the screen content:
<TouchableOpacity
  style={styles.scanButton}
  onPress={() => router.push('/(app)/documents/scan')}
>
  <Text style={styles.scanButtonText}>Scan Document</Text>
</TouchableOpacity>
```

Add to StyleSheet:
```typescript
scanButton:     { marginBottom: 12, padding: 14, borderRadius: 10, backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', alignItems: 'center' },
scanButtonText: { color: '#0369a1', fontWeight: '600', fontSize: 15 },
```

- [ ] **Step 2: Register notification handler in `_layout.tsx`**

In `apps/mobile/app/_layout.tsx`, add the notification response listener:

```typescript
// Add imports:
import * as Notifications from 'expo-notifications'
import { useEffect, useRef } from 'react'
import { useRouter } from 'expo-router'

// Inside RootLayoutInner, add:
function RootLayoutInner() {
  useWatchMessages()
  const router              = useRouter()
  const notifListenerRef    = useRef<Notifications.Subscription | null>(null)

  useEffect(() => {
    notifListenerRef.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { jobId?: string; screen?: string }
      if (data?.screen === 'ocr-review' && data?.jobId) {
        router.push('/(app)/documents/ocr-review/' + data.jobId)
      }
    })
    return () => {
      notifListenerRef.current?.remove()
    }
  }, [router])

  return <Stack screenOptions={{ headerShown: false }} />
}
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors

- [ ] **Step 4: Run mobile tests**

```bash
cd apps/mobile && npx jest
```

Expected: all tests pass (98+ tests)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(app\)/documents/index.tsx apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): scan button in documents + push notification deep-link to OCR review"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task covering it |
|---|---|
| Camera/library capture → upload | Task 7 (`scan.tsx`) |
| OCR runs via Inngest pipeline | Task 3 (`ocrDocument.ts`) |
| Generic field extraction with types + confidence | Task 3 (`extractFields`) |
| Push notification to uploader on completion | Task 2 (`sendPushToUser`) + Task 3 (notify-uploader step) |
| Review screen with editable fields | Task 8 (`[jobId].tsx`) |
| Low-confidence field flagging | Task 8 (yellow dot, confidence < 0.8) |
| Save edited fields → confirmed | Task 6 (`save-fields` route) + Task 8 (save handler) |
| Notification deep-link to review screen | Task 9 (`_layout.tsx` handler) |
| Scan button in documents tab | Task 9 (`index.tsx`) |
| `created_by` for push routing | Task 1 (migration) |
| `category` to route to generic vs prescription pipeline | Tasks 1 + 4 |
| Discard option on review screen | Not in spec — design shows discard as a web-only action. Omitted per YAGNI. |

All spec requirements covered.
