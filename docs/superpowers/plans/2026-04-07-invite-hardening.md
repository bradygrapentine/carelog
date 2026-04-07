# Invite Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three security issues in the invite flow: missing auth header on accept call, non-atomic token consumption, and spoofable rate-limit IP key.

**Architecture:** Task 1 is a one-line client fix. Task 2 replaces the split read-then-write with a single Postgres RPC that atomically claims the token and activates the membership. Task 3 hardens IP extraction to use the rightmost `x-forwarded-for` entry (Vercel appends the real client IP last) instead of the first (attacker-controlled).

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL + supabase-js v2), pgTAP for DB tests, Vitest for unit tests.

---

### Task 1: Fix invite page to send auth token on accept

**Files:**
- Modify: `apps/web/app/invite/[token]/page.tsx:1-4, 55-59`

- [ ] **Step 1: Replace the plain `fetch()` call with `authenticatedFetch()`**

In `apps/web/app/invite/[token]/page.tsx`, make two changes:

Add the import at line 4 (after the existing import):
```tsx
import { authenticatedFetch } from '../../../lib/authenticatedFetch'
```

Replace lines 55–59:
```tsx
// BEFORE
const res = await fetch('/api/invite/' + token + '/accept', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: user.id, userEmail: user.email }),
})
```
```tsx
// AFTER
const res = await authenticatedFetch('/api/invite/' + token + '/accept', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({}),
})
```

Note: `userId` and `userEmail` are removed from the body — the server already derives identity from `getRequestUser()` and must not trust client-supplied identity fields.

- [ ] **Step 2: Verify no other caller passes userId/userEmail in the invite accept body**

```bash
grep -rn "userId.*userEmail\|userEmail.*userId" apps/web/
```

Expected: no matches (or only in the file you just edited, already removed).

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/invite/\[token\]/page.tsx
git commit -m "fix: use authenticatedFetch on invite accept to send bearer token"
```

---

### Task 2: Atomic invite acceptance via Postgres RPC

**Files:**
- Create: `supabase/migrations/20260407000000_atomic_invite_accept.sql`
- Modify: `apps/web/app/api/invite/[token]/accept/route.ts`
- Create: `supabase/tests/invite_accept_atomic.test.sql`

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/invite_accept_atomic.test.sql`:

```sql
BEGIN;
SELECT plan(5);

-- Setup: org, user profile, membership, invite token
INSERT INTO organizations (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Test Org');

INSERT INTO user_profiles (id, display_name) VALUES
  ('00000000-0000-0000-0000-000000000002', 'Alice');

INSERT INTO memberships (id, org_id, user_id, role, recipient_id) VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
   NULL, 'caregiver', NULL);

INSERT INTO invite_tokens (id, token, membership_id, email, expires_at) VALUES
  ('00000000-0000-0000-0000-000000000020', 'test-token-abc',
   '00000000-0000-0000-0000-000000000010',
   'alice@example.com',
   now() + interval '48 hours');

-- Test 1: valid accept returns success
SELECT results_eq(
  $$ SELECT (accept_invite('test-token-abc', '00000000-0000-0000-0000-000000000002'::uuid, 'alice@example.com')).success $$,
  ARRAY[true],
  'valid accept returns success=true'
);

-- Test 2: token is marked consumed
SELECT isnt(
  (SELECT consumed_at FROM invite_tokens WHERE token = 'test-token-abc'),
  NULL,
  'consumed_at is set after accept'
);

-- Test 3: membership is activated with correct user_id
SELECT is(
  (SELECT user_id FROM memberships WHERE id = '00000000-0000-0000-0000-000000000010'),
  '00000000-0000-0000-0000-000000000002'::uuid,
  'membership user_id is set to accepting user'
);

-- Test 4: second call on consumed token returns error
SELECT results_eq(
  $$ SELECT (accept_invite('test-token-abc', '00000000-0000-0000-0000-000000000002'::uuid, 'alice@example.com')).error $$,
  ARRAY['already_used'],
  'second accept returns already_used error'
);

-- Test 5: wrong email returns error
INSERT INTO invite_tokens (id, token, membership_id, email, expires_at) VALUES
  ('00000000-0000-0000-0000-000000000021', 'test-token-xyz',
   '00000000-0000-0000-0000-000000000010',
   'bob@example.com',
   now() + interval '48 hours');

SELECT results_eq(
  $$ SELECT (accept_invite('test-token-xyz', '00000000-0000-0000-0000-000000000002'::uuid, 'alice@example.com')).error $$,
  ARRAY['email_mismatch'],
  'wrong email returns email_mismatch error'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test to verify it fails (function does not exist yet)**

```bash
supabase test db
```

Expected: FAIL — `function accept_invite does not exist`

- [ ] **Step 3: Write the migration with the atomic RPC**

Create `supabase/migrations/20260407000000_atomic_invite_accept.sql`:

```sql
-- Atomically consumes an invite token and activates the pending membership.
-- Returns a composite: (success boolean, error text).
-- error is NULL on success. success is FALSE on error.
--
-- Errors:
--   not_found      — no unconsumed, unexpired token matches p_token
--   email_mismatch — token email does not match p_email (normalized)
--   already_used   — token was already consumed (concurrent accept)

CREATE TYPE invite_accept_result AS (
  success boolean,
  error   text
);

CREATE OR REPLACE FUNCTION accept_invite(
  p_token   text,
  p_user_id uuid,
  p_email   text
) RETURNS invite_accept_result
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
DECLARE
  v_invite        invite_tokens%ROWTYPE;
  v_rows_consumed integer;
  v_result        invite_accept_result;
BEGIN
  -- Fetch the invite. Include consumed tokens so we can distinguish
  -- "not found / expired" from "already used".
  SELECT * INTO v_invite
  FROM   invite_tokens
  WHERE  token = p_token
    AND  expires_at > now()
  LIMIT  1;

  IF NOT FOUND THEN
    v_result.success := false;
    v_result.error   := 'not_found';
    RETURN v_result;
  END IF;

  -- Check email match before touching anything.
  IF lower(trim(v_invite.email)) <> lower(trim(p_email)) THEN
    v_result.success := false;
    v_result.error   := 'email_mismatch';
    RETURN v_result;
  END IF;

  -- Atomically claim the token. If another request already consumed it,
  -- no rows are updated and we return already_used.
  UPDATE invite_tokens
  SET    consumed_at = now()
  WHERE  id          = v_invite.id
    AND  consumed_at IS NULL;

  GET DIAGNOSTICS v_rows_consumed = ROW_COUNT;

  IF v_rows_consumed = 0 THEN
    v_result.success := false;
    v_result.error   := 'already_used';
    RETURN v_result;
  END IF;

  -- Token claimed — activate the membership.
  UPDATE memberships
  SET    user_id     = p_user_id,
         accepted_at = now()
  WHERE  id = v_invite.membership_id;

  v_result.success := true;
  v_result.error   := null;
  RETURN v_result;
END;
$$;

-- Only service role can call this function directly.
REVOKE EXECUTE ON FUNCTION accept_invite(text, uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION accept_invite(text, uuid, text) TO service_role;
```

- [ ] **Step 4: Apply the migration**

```bash
supabase db reset
```

Expected: migration applied without errors.

- [ ] **Step 5: Run the pgTAP test to verify it passes**

```bash
supabase test db
```

Expected: 5/5 tests pass.

- [ ] **Step 6: Update the accept route to call the RPC**

Replace the entire body of `apps/web/app/api/invite/[token]/accept/route.ts` with:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import { getRequestUser } from '@/lib/supabaseServer'
import { rateLimit } from '@/lib/rateLimit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const limited = await rateLimit(request, 'invite/accept')
  if (limited) return limited

  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { token } = await params

    const { data, error } = await supabaseAdmin.rpc('accept_invite', {
      p_token:   token,
      p_user_id: user.id,
      p_email:   user.email?.toLowerCase().trim() ?? '',
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data.success) {
      const statusMap: Record<string, number> = {
        not_found:      404,
        email_mismatch: 403,
        already_used:   410,
      }
      const status = statusMap[data.error] ?? 400
      const messageMap: Record<string, string> = {
        not_found:      'Invite not found or has expired',
        email_mismatch: 'This invite was sent to a different email address',
        already_used:   'This invite has already been used. Ask the coordinator to send a new one.',
      }
      return NextResponse.json(
        { error: messageMap[data.error] ?? data.error },
        { status }
      )
    }

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260407000000_atomic_invite_accept.sql \
        supabase/tests/invite_accept_atomic.test.sql \
        apps/web/app/api/invite/\[token\]/accept/route.ts
git commit -m "fix: replace split invite-accept writes with atomic Postgres RPC"
```

---

### Task 3: Harden rate-limit IP extraction

**Files:**
- Modify: `apps/web/lib/rateLimit.ts:24-25`

- [ ] **Step 1: Write a failing Vitest test for `getClientIp`**

Since `getClientIp` is currently unexported, you will need to export it to test it directly. Add `export` to the function signature as part of this task.

Create `apps/web/lib/__tests__/rateLimit.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getClientIp } from '../rateLimit'
import { NextRequest } from 'next/server'

function makeRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost/api/test', { headers })
}

describe('getClientIp', () => {
  it('returns the last IP in x-forwarded-for (Vercel appends real client IP last)', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1, 203.0.113.5' })
    expect(getClientIp(req)).toBe('203.0.113.5')
  })

  it('returns the single IP when x-forwarded-for has one entry', () => {
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.5' })
    expect(getClientIp(req)).toBe('203.0.113.5')
  })

  it('prefers x-real-ip over x-forwarded-for when present', () => {
    const req = makeRequest({
      'x-real-ip': '203.0.113.99',
      'x-forwarded-for': '1.2.3.4, 5.6.7.8',
    })
    expect(getClientIp(req)).toBe('203.0.113.99')
  })

  it('returns unknown when no IP headers are present', () => {
    const req = makeRequest({})
    expect(getClientIp(req)).toBe('unknown')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web && pnpm exec vitest run lib/__tests__/rateLimit.test.ts
```

Expected: FAIL — `getClientIp is not exported` or similar.

- [ ] **Step 3: Update `getClientIp` in `apps/web/lib/rateLimit.ts`**

Replace lines 24–26:
```ts
// BEFORE
function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
}
```
```ts
// AFTER
// Prefer x-real-ip (set by Vercel edge, cannot be spoofed by clients).
// Fall back to the LAST entry in x-forwarded-for: trusted reverse proxies
// append the real client IP to the end of this header, so the last entry
// is the one added by the platform rather than one supplied by the client.
// The first entry in x-forwarded-for is attacker-controlled and must not be used.
export function getClientIp(request: NextRequest): string {
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const ips = forwarded.split(',')
    return ips[ips.length - 1].trim()
  }

  return 'unknown'
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web && pnpm exec vitest run lib/__tests__/rateLimit.test.ts
```

Expected: 4/4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/rateLimit.ts apps/web/lib/__tests__/rateLimit.test.ts
git commit -m "fix: harden rate-limit IP extraction — use rightmost x-forwarded-for entry"
```

---

## Self-Review

**Spec coverage:**
- [HIGH] Invite accept uses plain fetch → Task 1 ✓
- [HIGH] Non-atomic invite accept writes → Task 2 ✓
- [MEDIUM] Spoofable rate-limit IP → Task 3 ✓

**Placeholder scan:** No TBD or vague steps — all code is complete.

**Type consistency:**
- `accept_invite` RPC uses `p_token`, `p_user_id`, `p_email` in both migration and route call ✓
- `invite_accept_result` composite type used in pgTAP test matches migration definition ✓
- `getClientIp` exported in rateLimit.ts, imported in test ✓
