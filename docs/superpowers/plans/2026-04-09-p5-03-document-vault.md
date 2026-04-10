# P5-03 Document Vault — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let coordinators upload care documents (POA, advance directive, insurance cards, etc.) into a private Supabase Storage bucket. All org members can view the list and download files via 180-second signed URLs. Coordinator can delete.

**Architecture:** New `documents` table + private `care-documents` Storage bucket. Upload/download go through Next.js API routes (not tRPC) because they handle multipart + binary. The tRPC `documentsRouter` handles list and delete. `DocumentVault` component is rendered for all roles but upload/delete are coordinator-only.

**Tech Stack:** Supabase (Postgres + Storage + pgTAP), Next.js API routes, tRPC, React + Tailwind, Vitest

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/20260413000002_documents.sql` | Create | Table + RLS + Storage bucket |
| `supabase/tests/documents_rls.test.sql` | Create | pgTAP RLS tests |
| `apps/web/app/api/documents/upload/route.ts` | Create | Multipart upload handler |
| `apps/web/app/api/documents/upload/route.test.ts` | Create | Upload route tests |
| `apps/web/app/api/documents/[documentId]/download/route.ts` | Create | Signed URL redirect handler |
| `apps/web/app/api/documents/[documentId]/download/route.test.ts` | Create | Download route tests |
| `apps/web/server/routers/documents.ts` | Create | tRPC list + delete |
| `apps/web/server/trpc/router.ts` | Modify | Wire documentsRouter |
| `apps/web/app/journal/[recipientId]/DocumentVault.tsx` | Create | UI component |
| `apps/web/app/journal/[recipientId]/__tests__/DocumentVault.test.tsx` | Create | Component tests |
| `apps/web/app/journal/[recipientId]/JournalClient.tsx` | Modify | Render DocumentVault |

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260413000002_documents.sql`

- [ ] **Step 1: Write the migration**

```sql
-- P5-03: Document vault
-- Private document storage. All org members read; coordinator insert/delete.
-- Downloads use signed URLs generated server-side — no public bucket URLs.

CREATE TABLE documents (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id  uuid        NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  uploaded_by   uuid        NOT NULL,
  display_name  text        NOT NULL,
  doc_type      text        NOT NULL CHECK (doc_type IN (
    'hipaa_authorization', 'power_of_attorney', 'advance_directive',
    'insurance_card', 'medication_list', 'other'
  )),
  storage_path  text        NOT NULL,
  file_size     integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- All active org members can read document metadata
CREATE POLICY "org members can read documents"
  ON documents FOR SELECT
  USING (user_is_org_member(org_id));

-- Coordinator only can insert
CREATE POLICY "coordinator can insert documents"
  ON documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   memberships
      WHERE  org_id       = documents.org_id
      AND    user_id      = auth.uid()
      AND    role         = 'coordinator'
      AND    accepted_at  IS NOT NULL
    )
  );

-- Coordinator only can delete
CREATE POLICY "coordinator can delete documents"
  ON documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM   memberships
      WHERE  org_id       = documents.org_id
      AND    user_id      = auth.uid()
      AND    role         = 'coordinator'
      AND    accepted_at  IS NOT NULL
    )
  );
```

- [ ] **Step 2: Create the Storage bucket via Supabase dashboard or CLI**

In the Supabase local dashboard (http://localhost:54323), go to Storage and create:
- Bucket name: `care-documents`
- Public: **No** (private)

Or via SQL in the migration (add after the table DDL):
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('care-documents', 'care-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: only authenticated users who are org members can access objects
-- (Access is enforced at the API route layer with signed URLs — no direct public access)
CREATE POLICY "service role can manage care-documents"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'care-documents');
```

- [ ] **Step 3: Apply the migration**

```bash
supabase db reset
```

Expected: migrations apply cleanly.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260413000002_documents.sql
git commit -m "feat: documents table + RLS + storage bucket (P5-03)"
```

---

## Task 2: pgTAP RLS tests

**Files:**
- Create: `supabase/tests/documents_rls.test.sql`

- [ ] **Step 1: Write the test file**

```sql
BEGIN;
SELECT plan(6);

-- ─── fixtures ────────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('aa110001-2000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'coord@doc-rls.com', now(), now(), now(), '{}', '{}', false),
  ('bb220002-2000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'caregiver@doc-rls.com', now(), now(), now(), '{}', '{}', false),
  ('cc330003-2000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'supporter@doc-rls.com', now(), now(), now(), '{}', '{}', false),
  ('dd440004-2000-0000-0000-000000000004', 'authenticated', 'authenticated',
   'outsider@doc-rls.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, org_type)
VALUES ('11200000-2000-0000-0000-000000000001', 'Doc RLS Org', 'family')
ON CONFLICT DO NOTHING;

INSERT INTO identity_vault (org_id, full_name)
VALUES ('11200000-2000-0000-0000-000000000001', 'Doc Test Recipient')
ON CONFLICT DO NOTHING;

INSERT INTO care_recipients (id, org_id, identity_token)
SELECT '21200000-2000-0000-0000-000000000001', '11200000-2000-0000-0000-000000000001', token
FROM identity_vault WHERE org_id = '11200000-2000-0000-0000-000000000001' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at, recipient_id)
VALUES
  ('11200000-2000-0000-0000-000000000001', 'aa110001-2000-0000-0000-000000000001', 'coordinator', now(), null),
  ('11200000-2000-0000-0000-000000000001', 'bb220002-2000-0000-0000-000000000002', 'caregiver',   now(), '21200000-2000-0000-0000-000000000001'),
  ('11200000-2000-0000-0000-000000000001', 'cc330003-2000-0000-0000-000000000003', 'supporter',   now(), null)
ON CONFLICT DO NOTHING;

-- Fixture document — inserted as postgres to bypass RLS
INSERT INTO documents (id, org_id, recipient_id, uploaded_by, display_name, doc_type, storage_path)
VALUES (
  '31200000-2000-0000-0000-000000000001',
  '11200000-2000-0000-0000-000000000001',
  '21200000-2000-0000-0000-000000000001',
  'aa110001-2000-0000-0000-000000000001',
  'Power of Attorney', 'power_of_attorney', 'test/poa.pdf'
) ON CONFLICT DO NOTHING;

-- ─── tests ───────────────────────────────────────────────────────────────────

-- 1. Coordinator can INSERT
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"aa110001-2000-0000-0000-000000000001","role":"authenticated"}';

SELECT lives_ok(
  $$INSERT INTO documents (org_id, recipient_id, uploaded_by, display_name, doc_type, storage_path)
    VALUES ('11200000-2000-0000-0000-000000000001','21200000-2000-0000-0000-000000000001',
            'aa110001-2000-0000-0000-000000000001','HIPAA Auth','hipaa_authorization','test/hipaa.pdf')$$,
  'coordinator can insert a document'
);

-- 2. Caregiver CANNOT INSERT
SET LOCAL "request.jwt.claims" TO '{"sub":"bb220002-2000-0000-0000-000000000002","role":"authenticated"}';

SELECT throws_ok(
  $$INSERT INTO documents (org_id, recipient_id, uploaded_by, display_name, doc_type, storage_path)
    VALUES ('11200000-2000-0000-0000-000000000001','21200000-2000-0000-0000-000000000001',
            'bb220002-2000-0000-0000-000000000002','Meds List','medication_list','test/meds.pdf')$$,
  '42501', NULL,
  'caregiver cannot insert a document'
);

-- 3. Coordinator can SELECT
SET LOCAL "request.jwt.claims" TO '{"sub":"aa110001-2000-0000-0000-000000000001","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM documents WHERE org_id = '11200000-2000-0000-0000-000000000001'$$,
  ARRAY[2]::int[],
  'coordinator can read documents for their org'
);

-- 4. Supporter can SELECT (read-only)
SET LOCAL "request.jwt.claims" TO '{"sub":"cc330003-2000-0000-0000-000000000003","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM documents WHERE org_id = '11200000-2000-0000-0000-000000000001'$$,
  ARRAY[2]::int[],
  'supporter can read documents for their org'
);

-- 5. Outsider sees 0 rows
SET LOCAL "request.jwt.claims" TO '{"sub":"dd440004-2000-0000-0000-000000000004","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM documents WHERE org_id = '11200000-2000-0000-0000-000000000001'$$,
  ARRAY[0]::int[],
  'non-member cannot read documents'
);

-- 6. Coordinator can DELETE
SET LOCAL "request.jwt.claims" TO '{"sub":"aa110001-2000-0000-0000-000000000001","role":"authenticated"}';

SELECT lives_ok(
  $$DELETE FROM documents WHERE id = '31200000-2000-0000-0000-000000000001'$$,
  'coordinator can delete a document'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run pgTAP tests**

```bash
supabase test db
```

Expected: all 6 tests pass.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/documents_rls.test.sql
git commit -m "test: pgTAP RLS tests for documents (P5-03)"
```

---

## Task 3: Upload API route + tests

**Files:**
- Create: `apps/web/app/api/documents/upload/route.ts`
- Create: `apps/web/app/api/documents/upload/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/app/api/documents/upload/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabaseServer', () => ({
  getRequestUser: vi.fn(),
}))
vi.mock('@/server/supabaseAdmin.server', () => ({
  supabaseAdmin: {
    from:    vi.fn(),
    storage: { from: vi.fn() },
  },
}))

import { getRequestUser } from '@/lib/supabaseServer'
import { supabaseAdmin }  from '@/server/supabaseAdmin.server'
import { POST }           from './route'

const ORG_ID  = '10000000-0000-0000-0000-000000000001'
const REC_ID  = '20000000-0000-0000-0000-000000000002'
const USER_ID = '30000000-0000-0000-0000-000000000003'
const DOC_ID  = '40000000-0000-0000-0000-000000000004'

function makeMultipartReq(fields: Record<string, string>) {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) {
    form.append(k, v)
  }
  // Attach a fake file
  form.append('file', new Blob(['pdf-content'], { type: 'application/pdf' }), 'test.pdf')
  return new NextRequest('http://localhost/api/documents/upload', {
    method: 'POST',
    body:   form,
  })
}

function makeFromChain(result: object) {
  const chain: Record<string, unknown> = {
    select:  () => chain,
    eq:      () => chain,
    not:     () => chain,
    insert:  () => chain,
    select:  () => ({ single: vi.fn().mockResolvedValue(result) }),
    single:  vi.fn().mockResolvedValue(result),
  }
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any)
})

describe('POST /api/documents/upload — auth', () => {
  it('returns 401 when no user', async () => {
    vi.mocked(getRequestUser).mockResolvedValue(null)
    const res = await POST(makeMultipartReq({ orgId: ORG_ID, recipientId: REC_ID, displayName: 'Test', docType: 'other' }))
    expect(res.status).toBe(401)
  })
})

describe('POST /api/documents/upload — role check', () => {
  it('returns 403 when user is not coordinator', async () => {
    const memberChain = {
      select: () => memberChain,
      eq:     () => memberChain,
      not:    () => memberChain,
      single: vi.fn().mockResolvedValue({ data: { role: 'caregiver', accepted_at: new Date().toISOString() }, error: null }),
    }
    vi.mocked(supabaseAdmin.from).mockReturnValue(memberChain as any)
    const res = await POST(makeMultipartReq({ orgId: ORG_ID, recipientId: REC_ID, displayName: 'Test', docType: 'other' }))
    expect(res.status).toBe(403)
  })
})

describe('POST /api/documents/upload — validation', () => {
  it('returns 400 when displayName is missing', async () => {
    const memberChain = {
      select: () => memberChain,
      eq:     () => memberChain,
      not:    () => memberChain,
      single: vi.fn().mockResolvedValue({ data: { role: 'coordinator', accepted_at: new Date().toISOString() }, error: null }),
    }
    vi.mocked(supabaseAdmin.from).mockReturnValue(memberChain as any)
    const form = new FormData()
    form.append('orgId', ORG_ID)
    form.append('recipientId', REC_ID)
    form.append('docType', 'other')
    form.append('file', new Blob(['data'], { type: 'application/pdf' }), 'test.pdf')
    const req = new NextRequest('http://localhost/api/documents/upload', { method: 'POST', body: form })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test documents/upload/route.test
```

Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Write the upload route**

```ts
// apps/web/app/api/documents/upload/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin }  from '@/server/supabaseAdmin.server'
import { getRequestUser } from '@/lib/supabaseServer'

const ALLOWED_DOC_TYPES = [
  'hipaa_authorization', 'power_of_attorney', 'advance_directive',
  'insurance_card', 'medication_list', 'other',
] as const

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const orgId       = formData.get('orgId')?.toString()
  const recipientId = formData.get('recipientId')?.toString()
  const displayName = formData.get('displayName')?.toString()
  const docType     = formData.get('docType')?.toString()
  const file        = formData.get('file')

  if (!orgId || !recipientId || !displayName || !docType) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!ALLOWED_DOC_TYPES.includes(docType as typeof ALLOWED_DOC_TYPES[number])) {
    return NextResponse.json({ error: 'Invalid doc_type' }, { status: 400 })
  }

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }

  // Role check
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('memberships')
    .select('role, accepted_at')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .single()

  if (membershipError || !membership || membership.role !== 'coordinator') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Upload to storage
  const ext       = (file instanceof File ? file.name : 'file').split('.').pop() ?? 'bin'
  const path      = orgId + '/' + recipientId + '/' + crypto.randomUUID() + '.' + ext
  const arrayBuf  = await file.arrayBuffer()

  const { error: storageError } = await supabaseAdmin.storage
    .from('care-documents')
    .upload(path, arrayBuf, { contentType: file.type || 'application/octet-stream' })

  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 })
  }

  // Insert metadata row
  const fileSize = file.size
  const { data: doc, error: insertError } = await supabaseAdmin
    .from('documents')
    .insert({
      org_id:       orgId,
      recipient_id: recipientId,
      uploaded_by:  user.id,
      display_name: displayName,
      doc_type:     docType,
      storage_path: path,
      file_size:    fileSize,
    })
    .select('id')
    .single()

  if (insertError || !doc) {
    // Best-effort cleanup on insert failure
    await supabaseAdmin.storage.from('care-documents').remove([path])
    return NextResponse.json({ error: 'Failed to save document metadata' }, { status: 500 })
  }

  return NextResponse.json({ documentId: doc.id })
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
pnpm test documents/upload/route.test
```

Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/documents/upload/route.ts apps/web/app/api/documents/upload/route.test.ts
git commit -m "feat: document upload API route + tests (P5-03)"
```

---

## Task 4: Download API route + tests

**Files:**
- Create: `apps/web/app/api/documents/[documentId]/download/route.ts`
- Create: `apps/web/app/api/documents/[documentId]/download/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/app/api/documents/[documentId]/download/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabaseServer', () => ({
  getRequestUser: vi.fn(),
}))
vi.mock('@/server/supabaseAdmin.server', () => ({
  supabaseAdmin: {
    from:    vi.fn(),
    storage: { from: vi.fn() },
  },
}))

import { getRequestUser } from '@/lib/supabaseServer'
import { supabaseAdmin }  from '@/server/supabaseAdmin.server'
import { GET }            from './route'

const USER_ID = '30000000-0000-0000-0000-000000000003'
const DOC_ID  = '40000000-0000-0000-0000-000000000004'
const ORG_ID  = '10000000-0000-0000-0000-000000000001'

function makeReq() {
  return new NextRequest('http://localhost/api/documents/' + DOC_ID + '/download', { method: 'GET' })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any)
})

describe('GET /api/documents/[documentId]/download — auth', () => {
  it('returns 401 when no user', async () => {
    vi.mocked(getRequestUser).mockResolvedValue(null)
    const res = await GET(makeReq(), { params: Promise.resolve({ documentId: DOC_ID }) })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/documents/[documentId]/download — not found', () => {
  it('returns 404 when document does not exist', async () => {
    const docChain = {
      select: () => docChain,
      eq:     () => docChain,
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    }
    vi.mocked(supabaseAdmin.from).mockReturnValue(docChain as any)
    const res = await GET(makeReq(), { params: Promise.resolve({ documentId: DOC_ID }) })
    expect(res.status).toBe(404)
  })
})

describe('GET /api/documents/[documentId]/download — role check', () => {
  it('returns 403 when user is not an org member', async () => {
    const docChain = {
      select: () => docChain,
      eq:     () => docChain,
      single: vi.fn().mockResolvedValue({
        data: { id: DOC_ID, org_id: ORG_ID, storage_path: 'test/file.pdf' },
        error: null,
      }),
    }
    const memberChain = {
      select: () => memberChain,
      eq:     () => memberChain,
      not:    () => memberChain,
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    }
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(docChain as any)
      .mockReturnValueOnce(memberChain as any)
    const res = await GET(makeReq(), { params: Promise.resolve({ documentId: DOC_ID }) })
    expect(res.status).toBe(403)
  })
})

describe('GET /api/documents/[documentId]/download — signed URL', () => {
  it('redirects to signed URL when everything is valid', async () => {
    const docChain = {
      select: () => docChain,
      eq:     () => docChain,
      single: vi.fn().mockResolvedValue({
        data: { id: DOC_ID, org_id: ORG_ID, storage_path: 'test/file.pdf' },
        error: null,
      }),
    }
    const memberChain = {
      select: () => memberChain,
      eq:     () => memberChain,
      not:    () => memberChain,
      single: vi.fn().mockResolvedValue({ data: { role: 'supporter' }, error: null }),
    }
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(docChain as any)
      .mockReturnValueOnce(memberChain as any)

    const storageChain = {
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://storage.example.com/signed-url' },
        error: null,
      }),
    }
    vi.mocked(supabaseAdmin.storage.from).mockReturnValue(storageChain as any)

    const res = await GET(makeReq(), { params: Promise.resolve({ documentId: DOC_ID }) })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://storage.example.com/signed-url')
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test documents/download/route.test
```

Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Write the download route**

```ts
// apps/web/app/api/documents/[documentId]/download/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin }  from '@/server/supabaseAdmin.server'
import { getRequestUser } from '@/lib/supabaseServer'

const SIGNED_URL_EXPIRY_SECONDS = 180

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { documentId } = await params

  // Fetch document metadata
  const { data: doc, error: docError } = await supabaseAdmin
    .from('documents')
    .select('id, org_id, storage_path')
    .eq('id', documentId)
    .single()

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  // Verify user is an active org member (any role)
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('memberships')
    .select('role')
    .eq('org_id', doc.org_id)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .single()

  if (membershipError || !membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Generate 180-second signed URL
  const { data: signedData, error: signedError } = await supabaseAdmin.storage
    .from('care-documents')
    .createSignedUrl(doc.storage_path, SIGNED_URL_EXPIRY_SECONDS)

  if (signedError || !signedData?.signedUrl) {
    return NextResponse.json({ error: 'Could not generate download link' }, { status: 500 })
  }

  return NextResponse.redirect(signedData.signedUrl)
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
pnpm test documents/download/route.test
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/api/documents/[documentId]/download/route.ts" "apps/web/app/api/documents/[documentId]/download/route.test.ts"
git commit -m "feat: document download API route + tests (P5-03)"
```

---

## Task 5: tRPC router

**Files:**
- Create: `apps/web/server/routers/documents.ts`

- [ ] **Step 1: Write the router**

```ts
// apps/web/server/routers/documents.ts
import { z } from 'zod'
import { router, protectedProcedure } from '../trpc/index'
import { TRPCError } from '@trpc/server'
import { supabaseAdmin } from '../supabaseAdmin.server'

const listInput = z.object({
  org_id:       z.string().uuid(),
  recipient_id: z.string().uuid(),
})

const deleteInput = z.object({
  id:     z.string().uuid(),
  org_id: z.string().uuid(),
})

export const documentsRouter = router({
  list: protectedProcedure
    .input(listInput)
    .query(async ({ ctx, input }) => {
      const { data: membership } = await supabaseAdmin
        .from('memberships')
        .select('role')
        .eq('org_id', input.org_id)
        .eq('user_id', ctx.user.id)
        .not('accepted_at', 'is', null)
        .single()
      if (!membership) throw new TRPCError({ code: 'FORBIDDEN' })

      const { data, error } = await supabaseAdmin
        .from('documents')
        .select('id, display_name, doc_type, file_size, uploaded_by, created_at')
        .eq('org_id', input.org_id)
        .eq('recipient_id', input.recipient_id)
        .order('created_at', { ascending: false })
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return data ?? []
    }),

  delete: protectedProcedure
    .input(deleteInput)
    .mutation(async ({ ctx, input }) => {
      const { data: membership } = await supabaseAdmin
        .from('memberships')
        .select('role')
        .eq('org_id', input.org_id)
        .eq('user_id', ctx.user.id)
        .not('accepted_at', 'is', null)
        .single()
      if (!membership || membership.role !== 'coordinator') {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }

      // Fetch storage path before deletion
      const { data: doc, error: fetchError } = await supabaseAdmin
        .from('documents')
        .select('storage_path')
        .eq('id', input.id)
        .eq('org_id', input.org_id)
        .single()
      if (fetchError || !doc) throw new TRPCError({ code: 'NOT_FOUND' })

      // Delete from storage first
      await supabaseAdmin.storage.from('care-documents').remove([doc.storage_path])

      // Delete metadata row
      const { error } = await supabaseAdmin
        .from('documents')
        .delete()
        .eq('id', input.id)
        .eq('org_id', input.org_id)
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { ok: true }
    }),
})
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/server/routers/documents.ts
git commit -m "feat: documentsRouter (P5-03)"
```

---

## Task 6: Wire router

**Files:**
- Modify: `apps/web/server/trpc/router.ts`

- [ ] **Step 1: Add import and register**

Add after the last import line:
```ts
import { documentsRouter } from '../routers/documents'
```

Add to the `appRouter` object:
```ts
documents: documentsRouter,
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/server/trpc/router.ts
git commit -m "feat: wire documentsRouter into appRouter (P5-03)"
```

---

## Task 7: DocumentVault component

**Files:**
- Create: `apps/web/app/journal/[recipientId]/DocumentVault.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/web/app/journal/[recipientId]/DocumentVault.tsx
'use client'

import { useRef, useState } from 'react'
import { trpc } from '../../../lib/trpc'
import { authenticatedFetch } from '../../../lib/authenticatedFetch'

type Props = {
  orgId:           string
  recipientId:     string
  currentUserRole: string
}

type DocRow = {
  id:           string
  display_name: string
  doc_type:     string
  file_size:    number | null
  uploaded_by:  string
  created_at:   string
}

const DOC_TYPE_OPTS = [
  { value: 'hipaa_authorization', label: 'HIPAA Authorization' },
  { value: 'power_of_attorney',   label: 'Power of Attorney'   },
  { value: 'advance_directive',   label: 'Advance Directive'   },
  { value: 'insurance_card',      label: 'Insurance Card'      },
  { value: 'medication_list',     label: 'Medication List'     },
  { value: 'other',               label: 'Other'               },
] as const

const DOC_TYPE_COLORS: Record<string, string> = {
  hipaa_authorization: 'bg-purple-100 text-purple-700',
  power_of_attorney:   'bg-amber-100 text-amber-700',
  advance_directive:   'bg-red-100 text-red-700',
  insurance_card:      'bg-blue-100 text-blue-700',
  medication_list:     'bg-green-100 text-green-700',
  other:               'bg-gray-100 text-gray-700',
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export function DocumentVault({ orgId, recipientId, currentUserRole }: Props) {
  const [open,        setOpen]        = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [docType,     setDocType]     = useState('other')
  const fileRef = useRef<HTMLInputElement>(null)

  const canUpload = currentUserRole === 'coordinator'
  const canDelete = currentUserRole === 'coordinator'

  const utils = trpc.useUtils()

  const { data: docs = [], isLoading } = trpc.documents.list.useQuery(
    { org_id: orgId, recipient_id: recipientId },
    { enabled: open }
  )

  const deleteMutation = trpc.documents.delete.useMutation({
    onSuccess: () => utils.documents.list.invalidate(),
  })

  async function handleUpload(e: React.FormEvent) {
    const form = e.currentTarget as HTMLFormElement
    e.preventDefault()
    const displayNameEl = form.elements.namedItem('displayName') as HTMLInputElement
    const docTypeEl     = form.elements.namedItem('docType') as HTMLSelectElement
    const fileEl        = form.elements.namedItem('file') as HTMLInputElement
    const displayName = displayNameEl.value
    const docTypeVal  = docTypeEl.value
    const file        = fileEl.files?.[0]

    if (!file || !displayName) {
      setUploadError('Please provide a file and a display name.')
      return
    }

    setUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('orgId', orgId)
      formData.append('recipientId', recipientId)
      formData.append('displayName', displayName)
      formData.append('docType', docTypeVal)
      formData.append('file', file)

      const res = await authenticatedFetch('/api/documents/upload', {
        method: 'POST',
        body:   formData,
      })

      if (!res.ok) {
        const data = await res.json()
        setUploadError(data.error ?? 'Upload failed.')
        return
      }

      utils.documents.list.invalidate()
      form.reset()
      setDocType('other')
    } finally {
      setUploading(false)
    }
  }

  function handleDownload(docId: string) {
    const url = '/api/documents/' + docId + '/download'
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-gray-700">Document vault</span>
        <svg
          className={'w-4 h-4 text-gray-400 transition-transform ' + (open ? 'rotate-180' : '')}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-50 space-y-4">
          {isLoading && (
            <p className="text-sm text-gray-400 pt-3">Loading...</p>
          )}

          {!isLoading && docs.length === 0 && (
            <p className="text-sm text-gray-400 pt-3">No documents uploaded yet.</p>
          )}

          {!isLoading && docs.length > 0 && (
            <ul className="divide-y divide-gray-50 pt-2">
              {docs.map((doc: DocRow) => (
                <li key={doc.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + (DOC_TYPE_COLORS[doc.doc_type] ?? 'bg-gray-100 text-gray-700')}>
                        {doc.doc_type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm font-medium text-gray-900 truncate">{doc.display_name}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(doc.created_at).toLocaleDateString()}
                      {doc.file_size ? ' · ' + formatBytes(doc.file_size) : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDownload(doc.id)}
                      className="text-xs text-blue-600 hover:underline"
                      aria-label={'Download ' + doc.display_name}
                    >
                      Download
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate({ id: doc.id, org_id: orgId })}
                        className="text-gray-300 hover:text-red-400 transition-colors"
                        aria-label={'Delete ' + doc.display_name}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {canUpload && (
            <form onSubmit={handleUpload} className="space-y-2 pt-2 border-t border-gray-50">
              <p className="text-xs font-medium text-gray-500">Upload document</p>
              {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
              <input
                name="displayName"
                type="text"
                placeholder="Display name (e.g. Mom's POA)"
                required
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <select
                name="docType"
                value={docType}
                onChange={e => setDocType(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                {DOC_TYPE_OPTS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <input
                ref={fileRef}
                name="file"
                type="file"
                required
                className="w-full text-sm text-gray-600"
              />
              <button
                type="submit"
                disabled={uploading}
                className="w-full text-sm bg-gray-900 text-white rounded-lg py-1.5 hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/journal/[recipientId]/DocumentVault.tsx
git commit -m "feat: DocumentVault component (P5-03)"
```

---

## Task 8: Component tests

**Files:**
- Create: `apps/web/app/journal/[recipientId]/__tests__/DocumentVault.test.tsx`

- [ ] **Step 1: Write tests**

```tsx
// apps/web/app/journal/[recipientId]/__tests__/DocumentVault.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DocumentVault } from '../DocumentVault'

const {
  mockListUseQuery,
  mockDeleteMutation,
  mockDeleteMutate,
  mockInvalidate,
  mockAuthenticatedFetch,
} = vi.hoisted(() => ({
  mockListUseQuery:   vi.fn(),
  mockDeleteMutation: vi.fn(),
  mockDeleteMutate:   vi.fn(),
  mockInvalidate:     vi.fn(),
  mockAuthenticatedFetch: vi.fn(),
}))

vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ documents: { list: { invalidate: mockInvalidate } } }),
    documents: {
      list:   { useQuery:    mockListUseQuery   },
      delete: { useMutation: mockDeleteMutation },
    },
  },
}))

vi.mock('@/lib/authenticatedFetch', () => ({
  authenticatedFetch: mockAuthenticatedFetch,
}))

const ORG_ID = '10000000-0000-0000-0000-000000000001'
const REC_ID = '20000000-0000-0000-0000-000000000001'

const sampleDocs = [
  {
    id:           'doc-1',
    display_name: 'Power of Attorney',
    doc_type:     'power_of_attorney',
    file_size:    102400,
    uploaded_by:  'user-1',
    created_at:   '2026-04-09T00:00:00Z',
  },
]

const defaultProps = {
  orgId:           ORG_ID,
  recipientId:     REC_ID,
  currentUserRole: 'coordinator',
}

function renderVault(overrides: Partial<typeof defaultProps> = {}) {
  return render(<DocumentVault {...defaultProps} {...overrides} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockListUseQuery.mockReturnValue({ data: [], isLoading: false })
  mockDeleteMutation.mockReturnValue({ mutate: mockDeleteMutate, isPending: false })
})

describe('DocumentVault — collapsed state', () => {
  it('shows "Document vault" button', () => {
    renderVault()
    expect(screen.getByRole('button', { name: /document vault/i })).toBeInTheDocument()
  })
})

describe('DocumentVault — expanded empty state', () => {
  it('shows "No documents uploaded yet" when empty', () => {
    renderVault()
    fireEvent.click(screen.getByRole('button', { name: /document vault/i }))
    expect(screen.getByText(/no documents uploaded yet/i)).toBeInTheDocument()
  })
})

describe('DocumentVault — expanded with documents', () => {
  beforeEach(() => {
    mockListUseQuery.mockReturnValue({ data: sampleDocs, isLoading: false })
  })

  it('shows document display name', () => {
    renderVault()
    fireEvent.click(screen.getByRole('button', { name: /document vault/i }))
    expect(screen.getByText('Power of Attorney')).toBeInTheDocument()
  })

  it('shows download button for all roles', () => {
    renderVault({ currentUserRole: 'supporter' })
    fireEvent.click(screen.getByRole('button', { name: /document vault/i }))
    expect(screen.getByRole('button', { name: /download power of attorney/i })).toBeInTheDocument()
  })

  it('shows delete button for coordinator', () => {
    renderVault()
    fireEvent.click(screen.getByRole('button', { name: /document vault/i }))
    expect(screen.getByRole('button', { name: /delete power of attorney/i })).toBeInTheDocument()
  })

  it('hides delete button for supporter', () => {
    renderVault({ currentUserRole: 'supporter' })
    fireEvent.click(screen.getByRole('button', { name: /document vault/i }))
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull()
  })
})

describe('DocumentVault — upload form', () => {
  it('shows upload form for coordinator', () => {
    renderVault()
    fireEvent.click(screen.getByRole('button', { name: /document vault/i }))
    expect(screen.getByRole('button', { name: /^upload$/i })).toBeInTheDocument()
  })

  it('hides upload form for supporter', () => {
    renderVault({ currentUserRole: 'supporter' })
    fireEvent.click(screen.getByRole('button', { name: /document vault/i }))
    expect(screen.queryByRole('button', { name: /^upload$/i })).toBeNull()
  })
})
```

- [ ] **Step 2: Run and confirm pass**

```bash
pnpm test DocumentVault.test
```

Expected: all 7 tests pass.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/journal/[recipientId]/__tests__/DocumentVault.test.tsx"
git commit -m "test: DocumentVault component tests (P5-03)"
```

---

## Task 9: Wire into JournalClient

**Files:**
- Modify: `apps/web/app/journal/[recipientId]/JournalClient.tsx`

- [ ] **Step 1: Add import**

After the `import { BenefitsNavigator }` line, add:
```ts
import { DocumentVault } from './DocumentVault'
```

- [ ] **Step 2: Render the panel**

After the `BenefitsNavigator` block, add:
```tsx
<div className="mt-6">
  <DocumentVault orgId={org?.id ?? ''} recipientId={recipientId} currentUserRole={currentUserRole} />
</div>
```

- [ ] **Step 3: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/journal/[recipientId]/JournalClient.tsx
git commit -m "feat: render DocumentVault in JournalClient (P5-03)"
```
