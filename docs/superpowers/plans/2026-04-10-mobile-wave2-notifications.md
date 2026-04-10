# Mobile Wave 2 — Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Expo push notifications (APNs + FCM) into the mobile app, store push tokens per device, and trigger alert notifications from existing Inngest functions for coverage gaps, burnout alerts, and new journal flag events.

**Architecture:** `expo-notifications` handles cross-platform token registration. Tokens are stored in a new `push_tokens` table (one per device, scoped to `auth_user_id`). A new `POST /api/push/register` route upserts the token on permission grant. Three Inngest functions POST to the Expo Push API when they detect alertable events.

**Tech Stack:** `expo-notifications` · Expo Push API · APNs (.p8 key via EAS) · FCM (`google-services.json` via EAS) · Supabase migration · Next.js API route

**Prerequisites:** Wave 1 complete and passing. Human backlog items complete: APNs .p8 key uploaded to EAS credentials, Firebase project created with `google-services.json`.

---

## File Map

```
supabase/migrations/
  20260410000001_push_tokens.sql           CREATE — push_tokens table + RLS
supabase/tests/
  push_tokens_rls.test.sql                 CREATE — pgTAP: user can only see/write own tokens
apps/web/app/api/push/
  register/
    route.ts                               CREATE — POST: upsert push token, coordinator+caregiver only
    route.test.ts                          CREATE — unit tests for register route
apps/web/server/
  repositories/pushTokensRepository.ts    CREATE — upsertPushToken, getTokensForOrg
apps/web/inngest/functions/
  gapDetector.ts                          MODIFY — add push notification call at end
  burnoutAlert.ts                         MODIFY — add push notification call at end
  journalFlagAlert.ts                     CREATE — new Inngest function: fires when coordinator flags entry
apps/web/inngest/utils/
  pushNotifications.ts                    CREATE — sendPushNotification(tokens, title, body, data)
apps/web/inngest/index.ts                 MODIFY — register journalFlagAlert in functions array
apps/mobile/app/(app)/settings/
  index.tsx                               MODIFY — add notification permission request + token registration
apps/mobile/__tests__/
  pushRegistration.test.tsx               CREATE — jest-expo: permission request + API call
```

---

## Task 1: DB Migration — push_tokens Table

**Files:**
- Create: `supabase/migrations/20260410000001_push_tokens.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260410000001_push_tokens.sql
CREATE TABLE push_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token        TEXT NOT NULL UNIQUE,
  platform     TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own tokens
CREATE POLICY "push_tokens_user_select"
  ON push_tokens FOR SELECT
  USING (auth_user_id = auth.uid());

CREATE POLICY "push_tokens_user_insert"
  ON push_tokens FOR INSERT
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "push_tokens_user_delete"
  ON push_tokens FOR DELETE
  USING (auth_user_id = auth.uid());

-- Service role handles upsert on behalf of users (API route uses supabaseAdmin for upsert)
-- No UPDATE policy needed — upsert deletes old token and inserts new one
```

- [ ] **Step 2: Apply migration**

```bash
cd /path/to/carelog
supabase db push --local
```

Expected: migration applies cleanly, no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260410000001_push_tokens.sql
git commit -m "feat: push_tokens migration with per-user RLS"
```

---

## Task 2: pgTAP RLS Tests for push_tokens

**Files:**
- Create: `supabase/tests/push_tokens_rls.test.sql`

- [ ] **Step 1: Write the pgTAP test**

```sql
BEGIN;
SELECT plan(6);

-- Setup: two users
SELECT supabase_test.create_supabase_user('user-a@test.com', 'user-a-id-0000-0000-0000000000a1');
SELECT supabase_test.create_supabase_user('user-b@test.com', 'user-b-id-0000-0000-0000000000b1');

-- User A inserts their token (service role, as API route does)
INSERT INTO push_tokens (auth_user_id, token, platform)
VALUES ('user-a-id-0000-0000-0000000000a1', 'ExponentPushToken[aaa]', 'ios');

INSERT INTO push_tokens (auth_user_id, token, platform)
VALUES ('user-b-id-0000-0000-0000000000b1', 'ExponentPushToken[bbb]', 'android');

-- As user A: can see own token
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "user-a-id-0000-0000-0000000000a1"}';
SELECT is(
  (SELECT count(*)::int FROM push_tokens WHERE auth_user_id = 'user-a-id-0000-0000-0000000000a1'),
  1,
  'user A sees own token'
);

-- As user A: cannot see user B's token
SELECT is(
  (SELECT count(*)::int FROM push_tokens WHERE auth_user_id = 'user-b-id-0000-0000-0000000000b1'),
  0,
  'user A cannot see user B token'
);

-- As user A: cannot insert token for user B
SET LOCAL "request.jwt.claims" TO '{"sub": "user-a-id-0000-0000-0000000000a1"}';
SELECT throws_ok(
  $$INSERT INTO push_tokens (auth_user_id, token, platform) VALUES ('user-b-id-0000-0000-0000000000b1', 'ExponentPushToken[steal]', 'ios')$$,
  'new row violates row-level security policy for table "push_tokens"'
);

-- As user B: sees own token only
SET LOCAL "request.jwt.claims" TO '{"sub": "user-b-id-0000-0000-0000000000b1"}';
SELECT is(
  (SELECT count(*)::int FROM push_tokens),
  1,
  'user B sees exactly one token (own)'
);

-- Anon: sees nothing
SET LOCAL ROLE anon;
SELECT is(
  (SELECT count(*)::int FROM push_tokens),
  0,
  'anon sees no tokens'
);

-- Service role: sees all (for Inngest lookup)
SET LOCAL ROLE service_role;
SELECT is(
  (SELECT count(*)::int FROM push_tokens),
  2,
  'service role sees all tokens'
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
git add supabase/tests/push_tokens_rls.test.sql
git commit -m "test: pgTAP RLS tests for push_tokens"
```

---

## Task 3: pushTokensRepository + sendPushNotification Utility

**Files:**
- Create: `apps/web/server/repositories/pushTokensRepository.ts`
- Create: `apps/web/inngest/utils/pushNotifications.ts`

- [ ] **Step 1: Write pushTokensRepository**

```typescript
// apps/web/server/repositories/pushTokensRepository.ts
import { supabaseAdmin } from '@/server/supabaseAdmin.server'

export async function upsertPushToken(
  authUserId: string,
  token: string,
  platform: 'ios' | 'android',
): Promise<void> {
  // Delete old token for this user (token may have rotated)
  await supabaseAdmin
    .from('push_tokens')
    .delete()
    .eq('auth_user_id', authUserId)

  const { error } = await supabaseAdmin
    .from('push_tokens')
    .insert({ auth_user_id: authUserId, token, platform })

  if (error) throw new Error(`upsertPushToken: ${error.message}`)
}

export async function getTokensForUsers(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return []

  const { data, error } = await supabaseAdmin
    .from('push_tokens')
    .select('token')
    .in('auth_user_id', userIds)

  if (error) throw new Error(`getTokensForUsers: ${error.message}`)
  return (data ?? []).map((row) => row.token)
}
```

- [ ] **Step 2: Write sendPushNotification utility**

```typescript
// apps/web/inngest/utils/pushNotifications.ts

type PushMessage = {
  to: string
  title: string
  body: string
  data?: Record<string, string>
  categoryId?: string
}

type ExpoTicket = { status: 'ok'; id: string } | { status: 'error'; message: string; details?: object }

export async function sendPushNotifications(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
  categoryId?: string,
): Promise<void> {
  if (tokens.length === 0) return

  const messages: PushMessage[] = tokens.map((token) => ({
    to: token,
    title,
    body,
    ...(data ? { data } : {}),
    ...(categoryId ? { categoryId } : {}),
  }))

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Expo Push API error ${response.status}: ${text}`)
  }

  const result = (await response.json()) as { data: ExpoTicket[] }
  const errors = result.data.filter((t) => t.status === 'error')
  if (errors.length > 0) {
    console.error('[push] Expo delivery errors:', JSON.stringify(errors))
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/server/repositories/pushTokensRepository.ts apps/web/inngest/utils/pushNotifications.ts
git commit -m "feat: pushTokensRepository + sendPushNotifications utility"
```

---

## Task 4: POST /api/push/register Route

**Files:**
- Create: `apps/web/app/api/push/register/route.ts`
- Create: `apps/web/app/api/push/register/route.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/app/api/push/register/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/server/auth', () => ({
  getRequestUser: vi.fn(),
}))
vi.mock('@/server/repositories/membershipsRepository', () => ({
  getMemberships: vi.fn(),
}))
vi.mock('@/server/repositories/pushTokensRepository', () => ({
  upsertPushToken: vi.fn(),
}))
vi.mock('@/lib/rateLimit', () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}))

import { getRequestUser } from '@/server/auth'
import { getMemberships } from '@/server/repositories/membershipsRepository'
import { upsertPushToken } from '@/server/repositories/pushTokensRepository'
import { POST } from './route'

const mockUser = { id: 'user-123', email: 'user@example.com' }
const validBody = { token: 'ExponentPushToken[abc]', platform: 'ios', org_id: 'org-123' }

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/push/register', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(rateLimit).mockResolvedValue(null)
})

describe('POST /api/push/register', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getRequestUser).mockResolvedValue(null)
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 when role is supporter', async () => {
    vi.mocked(getRequestUser).mockResolvedValue(mockUser)
    vi.mocked(getMemberships).mockResolvedValue([
      { org_id: 'org-123', role: 'supporter', status: 'active' } as any,
    ])
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(403)
  })

  it('returns 200 and calls upsertPushToken for coordinator', async () => {
    vi.mocked(getRequestUser).mockResolvedValue(mockUser)
    vi.mocked(getMemberships).mockResolvedValue([
      { org_id: 'org-123', role: 'coordinator', status: 'active' } as any,
    ])
    vi.mocked(upsertPushToken).mockResolvedValue(undefined)
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(200)
    expect(upsertPushToken).toHaveBeenCalledWith('user-123', 'ExponentPushToken[abc]', 'ios')
  })

  it('returns 400 for invalid body', async () => {
    vi.mocked(getRequestUser).mockResolvedValue(mockUser)
    const res = await POST(makeReq({ token: '', platform: 'fax' }))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run failing test**

```bash
cd apps/web && npx vitest run api/push/register --reporter=verbose 2>&1 | tail -5
```

Expected: `Cannot find module './route'`

- [ ] **Step 3: Write the route**

```typescript
// apps/web/app/api/push/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getRequestUser } from '@/server/auth'
import { getMemberships } from '@/server/repositories/membershipsRepository'
import { upsertPushToken } from '@/server/repositories/pushTokensRepository'
import { rateLimit } from '@/lib/rateLimit'

const bodySchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android']),
  org_id: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, 'push-register')
  if (limited) return limited

  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  const { token, platform, org_id } = parsed.data

  const memberships = await getMemberships(user.id)
  const membership = memberships.find((m) => m.org_id === org_id && m.status === 'active')
  if (!membership || membership.role === 'supporter') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await upsertPushToken(user.id, token, platform)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run passing test**

```bash
cd apps/web && npx vitest run api/push/register --reporter=verbose 2>&1 | tail -10
```

Expected: 4/4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/push/register/ apps/web/server/repositories/pushTokensRepository.ts
git commit -m "feat: POST /api/push/register — upsert device push token"
```

---

## Task 5: Wire Push into gapDetector + burnoutAlert

**Files:**
- Modify: `apps/web/inngest/functions/gapDetector.ts`
- Modify: `apps/web/inngest/functions/burnoutAlert.ts`

- [ ] **Step 1: Read gapDetector to find the right insertion point**

Read `apps/web/inngest/functions/gapDetector.ts` — find the final `step.run` or return block where a gap is confirmed. That's where push goes.

- [ ] **Step 2: Add push call to gapDetector**

At the end of the gap-detected path, after any existing notification logic, add:

```typescript
import { sendPushNotifications } from '@/inngest/utils/pushNotifications'
import { getTokensForUsers } from '@/server/repositories/pushTokensRepository'

// Inside the step that fires when a gap is found:
await step.run('send-gap-push', async () => {
  // Get coordinator + caregiver user IDs for this org
  const memberUserIds = orgMembers
    .filter((m) => m.role === 'coordinator' || m.role === 'caregiver')
    .map((m) => m.user_id)
    .filter(Boolean) as string[]

  const tokens = await getTokensForUsers(memberUserIds)
  await sendPushNotifications(
    tokens,
    'Coverage gap detected',
    `Coverage gap on ${gapDate} — ${gapWindow} needs a caregiver`,
    { category: 'coverage_gap', org_id: orgId },
    'coverage_gap',
  )
})
```

- [ ] **Step 3: Add push call to burnoutAlert**

Similarly in `burnoutAlert.ts`, at the end of the alert-fired path:

```typescript
await step.run('send-burnout-push', async () => {
  const coordinatorIds = orgMembers
    .filter((m) => m.role === 'coordinator')
    .map((m) => m.user_id)
    .filter(Boolean) as string[]

  const tokens = await getTokensForUsers(coordinatorIds)
  await sendPushNotifications(
    tokens,
    'Burnout risk detected',
    `${memberName}'s burnout score is high — check in today`,
    { category: 'burnout_alert', org_id: orgId },
    'burnout_alert',
  )
})
```

- [ ] **Step 4: Run typecheck**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/inngest/functions/gapDetector.ts apps/web/inngest/functions/burnoutAlert.ts
git commit -m "feat: push notifications wired into gapDetector and burnoutAlert"
```

---

## Task 6: New journalFlagAlert Inngest Function

**Files:**
- Create: `apps/web/inngest/functions/journalFlagAlert.ts`
- Modify: `apps/web/inngest/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/inngest/functions/__tests__/journalFlagAlert.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/repositories/membershipsRepository', () => ({
  getMemberships: vi.fn(),
}))
vi.mock('@/server/repositories/pushTokensRepository', () => ({
  getTokensForUsers: vi.fn(),
}))
vi.mock('@/inngest/utils/pushNotifications', () => ({
  sendPushNotifications: vi.fn(),
}))

import { getMemberships } from '@/server/repositories/membershipsRepository'
import { getTokensForUsers } from '@/server/repositories/pushTokensRepository'
import { sendPushNotifications } from '@/inngest/utils/pushNotifications'
import { journalFlagAlertHandler } from '../journalFlagAlert'

describe('journalFlagAlert handler', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('sends push to coordinators when entry is flagged', async () => {
    vi.mocked(getMemberships).mockResolvedValue([
      { org_id: 'org-1', user_id: 'coord-1', role: 'coordinator', status: 'active' } as any,
      { org_id: 'org-1', user_id: 'care-1', role: 'caregiver', status: 'active' } as any,
    ])
    vi.mocked(getTokensForUsers).mockResolvedValue(['ExponentPushToken[coord]'])
    vi.mocked(sendPushNotifications).mockResolvedValue(undefined)

    await journalFlagAlertHandler({ org_id: 'org-1', event_id: 'evt-1', flagged_by: 'coord-1' })

    expect(getTokensForUsers).toHaveBeenCalledWith(['coord-1'])
    expect(sendPushNotifications).toHaveBeenCalledWith(
      ['ExponentPushToken[coord]'],
      'Entry flagged for doctor',
      'Entry flagged for doctor — tap to view',
      expect.objectContaining({ category: 'journal_flag' }),
      'journal_flag',
    )
  })

  it('does nothing when no tokens registered', async () => {
    vi.mocked(getMemberships).mockResolvedValue([
      { org_id: 'org-1', user_id: 'coord-1', role: 'coordinator', status: 'active' } as any,
    ])
    vi.mocked(getTokensForUsers).mockResolvedValue([])
    vi.mocked(sendPushNotifications).mockResolvedValue(undefined)

    await journalFlagAlertHandler({ org_id: 'org-1', event_id: 'evt-1', flagged_by: 'coord-1' })

    expect(sendPushNotifications).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run failing test**

```bash
cd apps/web && npx vitest run journalFlagAlert --reporter=verbose 2>&1 | tail -5
```

Expected: `Cannot find module '../journalFlagAlert'`

- [ ] **Step 3: Write journalFlagAlert function**

```typescript
// apps/web/inngest/functions/journalFlagAlert.ts
import { inngest } from '@/inngest/client'
import { getMemberships } from '@/server/repositories/membershipsRepository'
import { getTokensForUsers } from '@/server/repositories/pushTokensRepository'
import { sendPushNotifications } from '@/inngest/utils/pushNotifications'

type JournalFlagPayload = {
  org_id: string
  event_id: string
  flagged_by: string
}

// Exported for unit testing
export async function journalFlagAlertHandler(payload: JournalFlagPayload) {
  const { org_id } = payload

  const memberships = await getMemberships(undefined, org_id)
  const coordinatorIds = memberships
    .filter((m) => m.role === 'coordinator' && m.status === 'active')
    .map((m) => m.user_id)
    .filter(Boolean) as string[]

  const tokens = await getTokensForUsers(coordinatorIds)
  if (tokens.length === 0) return

  await sendPushNotifications(
    tokens,
    'Entry flagged for doctor',
    'Entry flagged for doctor — tap to view',
    { category: 'journal_flag', org_id, event_id: payload.event_id },
    'journal_flag',
  )
}

export const journalFlagAlert = inngest.createFunction(
  { id: 'journal-flag-alert', name: 'Journal Flag Alert' },
  { event: 'carelog/journal.flagged' },
  async ({ event, step }) => {
    await step.run('send-flag-push', () =>
      journalFlagAlertHandler({
        org_id: event.data.org_id,
        event_id: event.data.event_id,
        flagged_by: event.data.flagged_by,
      }),
    )
  },
)
```

- [ ] **Step 4: Register in inngest/index.ts**

Open `apps/web/inngest/index.ts` (or wherever functions are exported) and add:

```typescript
import { journalFlagAlert } from './functions/journalFlagAlert'
// Add to the serve() functions array:
// journalFlagAlert,
```

Also add the event type. If there is a `apps/web/inngest/events.ts` or similar, add:

```typescript
'carelog/journal.flagged': {
  data: { org_id: string; event_id: string; flagged_by: string }
}
```

- [ ] **Step 5: Run tests**

```bash
cd apps/web && npx vitest run journalFlagAlert --reporter=verbose 2>&1 | tail -10
```

Expected: 2/2 pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/inngest/functions/journalFlagAlert.ts apps/web/inngest/
git commit -m "feat: journalFlagAlert Inngest function + event type"
```

---

## Task 7: Mobile — Settings Screen Notification Permission

**Files:**
- Modify: `apps/mobile/app/(app)/settings/index.tsx`
- Create: `apps/mobile/__tests__/pushRegistration.test.tsx`

- [ ] **Step 1: Install expo-notifications (if not already)**

```bash
cd apps/mobile && npx expo install expo-notifications
```

Check `package.json` first — if already present, skip.

- [ ] **Step 2: Write the failing test**

```typescript
// apps/mobile/__tests__/pushRegistration.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import * as ExpoNotifications from 'expo-notifications'
import { registerPushToken } from '../utils/pushRegistration'

vi.mock('expo-notifications', () => ({
  requestPermissionsAsync: vi.fn(),
  getExpoPushTokenAsync: vi.fn(),
}))
vi.mock('../utils/pushRegistration', () => ({
  registerPushToken: vi.fn(),
}))

describe('push registration', () => {
  it('requests permission and registers token on success', async () => {
    vi.mocked(ExpoNotifications.requestPermissionsAsync).mockResolvedValue({
      status: 'granted',
    } as any)
    vi.mocked(ExpoNotifications.getExpoPushTokenAsync).mockResolvedValue({
      data: 'ExponentPushToken[test]',
    } as any)
    vi.mocked(registerPushToken).mockResolvedValue(undefined)

    // Call the registration flow directly
    const { requestAndRegisterPushToken } = await import('../utils/pushRegistration')
    await requestAndRegisterPushToken('org-123')

    expect(registerPushToken).toHaveBeenCalledWith('ExponentPushToken[test]', 'org-123')
  })

  it('does nothing when permission denied', async () => {
    vi.mocked(ExpoNotifications.requestPermissionsAsync).mockResolvedValue({
      status: 'denied',
    } as any)
    const { requestAndRegisterPushToken } = await import('../utils/pushRegistration')
    await requestAndRegisterPushToken('org-123')

    expect(registerPushToken).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Write pushRegistration utility**

```typescript
// apps/mobile/utils/pushRegistration.ts
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { Platform } from 'react-native'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

export async function registerPushToken(token: string, orgId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/push/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      org_id: orgId,
    }),
  })
  if (!res.ok) {
    console.warn('[push] Failed to register token:', res.status)
  }
}

export async function requestAndRegisterPushToken(orgId: string): Promise<void> {
  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return

  const projectId = Constants.expoConfig?.extra?.eas?.projectId
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
  await registerPushToken(token, orgId)
}
```

- [ ] **Step 4: Update settings screen**

In `apps/mobile/app/(app)/settings/index.tsx`, add a "Enable notifications" button that calls `requestAndRegisterPushToken` with the current `orgId` from `AppContext`:

```typescript
import { requestAndRegisterPushToken } from '@/utils/pushRegistration'
import { useAppContext } from '@/utils/AppContext'

// Inside component:
const { orgId } = useAppContext()

const handleNotificationPermission = async () => {
  if (!orgId) return
  await requestAndRegisterPushToken(orgId)
}

// In JSX:
<TouchableOpacity onPress={handleNotificationPermission}>
  <Text>Enable notifications</Text>
</TouchableOpacity>
```

- [ ] **Step 5: Run tests**

```bash
cd apps/mobile && npx jest --testPathPattern pushRegistration --verbose 2>&1 | tail -10
```

Expected: 2/2 pass.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/utils/pushRegistration.ts apps/mobile/__tests__/pushRegistration.test.tsx apps/mobile/app/\(app\)/settings/index.tsx
git commit -m "feat: push notification permission + token registration in settings"
```

---

## Task 8: EAS Credentials + app.json Notifications Config

**Files:**
- Modify: `apps/mobile/app.json`

- [ ] **Step 1: Add expo-notifications plugin to app.json**

In `apps/mobile/app.json`, add to the `plugins` array:

```json
{
  "expo": {
    "plugins": [
      "expo-router",
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#2D6A4F",
          "sounds": []
        }
      ]
    ],
    "android": {
      "googleServicesFile": "./google-services.json"
    }
  }
}
```

Note: `notification-icon.png` should be a 96×96px white-on-transparent PNG. Create a placeholder or use the app icon.

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app.json
git commit -m "feat: configure expo-notifications plugin in app.json"
```

---

## Verification

```bash
# Unit tests
cd apps/web && npx vitest run --reporter=verbose 2>&1 | tail -15

# RLS tests
supabase test db

# Typecheck
cd apps/web && npx tsc --noEmit
cd apps/mobile && npx tsc --noEmit
```

All must pass before executing Wave 3.
