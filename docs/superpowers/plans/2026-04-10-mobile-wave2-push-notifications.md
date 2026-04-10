# Mobile Wave 2 — Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire push notifications end-to-end — Expo token registration on mobile, Expo Push API on the server, and three Inngest triggers (coverage gap, burnout alert, journal flag).

**Architecture:** Mobile requests notification permission in Settings and POSTs the Expo push token to a new `/api/push/register` endpoint. A shared `pushNotification.ts` utility wraps the Expo Push API and fetches coordinator tokens from a new `push_tokens` table. Three Inngest functions call that utility after creating their events: `gapDetector` (cron), `burnoutAlert` (cron), and a new `journalFlagAlert` (event-driven, triggered by the flag API route). Apple Watch mirrors all notifications automatically — no extra code needed.

**Tech Stack:** Expo SDK 55 · expo-notifications · Supabase (new `push_tokens` table) · Inngest (event trigger) · Expo Push API (`https://exp.host/--/api/v2/push/send`)

---

## File Map

```
supabase/migrations/20260415000000_push_tokens.sql          CREATE — push_tokens table + RLS
apps/web/app/api/push/register/route.ts                     CREATE — POST upsert push token
apps/web/app/api/push/register/route.test.ts                CREATE — route tests
apps/web/inngest/pushNotification.ts                        CREATE — Expo Push API helper + coordinator fetch
apps/web/inngest/functions/journalFlagAlert.ts              CREATE — event-driven Inngest function
apps/web/inngest/functions/__tests__/journalFlagAlert.test.ts  CREATE — unit tests
apps/web/app/api/journal/[eventId]/flag/route.ts            MODIFY — send 'journal/flagged' Inngest event on flag=true
apps/web/app/api/inngest/route.ts                           MODIFY — register journalFlagAlert
apps/web/inngest/functions/gapDetector.ts                   MODIFY — send push after gap inserted
apps/web/inngest/functions/burnoutAlert.ts                  MODIFY — send push after burnout alert inserted
apps/mobile/app/(app)/settings/index.tsx                    MODIFY — permission prompt + token registration
```

---

## Task 1: Supabase migration — push_tokens table

**Files:**
- Create: `supabase/migrations/20260415000000_push_tokens.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260415000000_push_tokens.sql`:

```sql
CREATE TABLE push_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token        TEXT NOT NULL UNIQUE,
  platform     TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can read and write their own tokens only
CREATE POLICY "push_tokens_owner_select" ON push_tokens
  FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY "push_tokens_owner_insert" ON push_tokens
  FOR INSERT WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "push_tokens_owner_delete" ON push_tokens
  FOR DELETE USING (auth_user_id = auth.uid());

-- Index for coordinator push queries (auth_user_id looked up in bulk)
CREATE INDEX push_tokens_auth_user_id_idx ON push_tokens (auth_user_id);
```

- [ ] **Step 2: Apply migration**

```bash
supabase db push
```

Expected: migration applied, `push_tokens` table visible in local Studio.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260415000000_push_tokens.sql
git commit -m "feat(db): push_tokens table with RLS"
```

---

## Task 2: POST /api/push/register — upsert push token

**Files:**
- Create: `apps/web/app/api/push/register/route.ts`
- Create: `apps/web/app/api/push/register/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/web/app/api/push/register/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpsert = vi.fn().mockResolvedValue({ error: null })
const mockEq = vi.fn().mockReturnThis()
const mockFrom = vi.fn(() => ({ upsert: mockUpsert, eq: mockEq }))

vi.mock('@/server/supabaseAdmin.server', () => ({
  supabaseAdmin: { from: mockFrom },
}))

vi.mock('@/lib/getRequestUser', () => ({
  getRequestUser: vi.fn().mockResolvedValue({ id: 'user-123' }),
}))

vi.mock('@/lib/rateLimit', () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}))

import { POST } from './route'
import { NextRequest } from 'next/server'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/push/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/push/register', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 400 for invalid platform', async () => {
    const { getRequestUser } = await import('@/lib/getRequestUser')
    vi.mocked(getRequestUser).mockResolvedValue({ id: 'user-123' } as any)

    const res = await POST(makeRequest({ token: 'ExpoToken[xxx]', platform: 'windows' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing token', async () => {
    const { getRequestUser } = await import('@/lib/getRequestUser')
    vi.mocked(getRequestUser).mockResolvedValue({ id: 'user-123' } as any)

    const res = await POST(makeRequest({ platform: 'ios' }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const { getRequestUser } = await import('@/lib/getRequestUser')
    vi.mocked(getRequestUser).mockResolvedValue(null)

    const res = await POST(makeRequest({ token: 'ExpoToken[xxx]', platform: 'ios' }))
    expect(res.status).toBe(401)
  })

  it('upserts token and returns 200', async () => {
    const { getRequestUser } = await import('@/lib/getRequestUser')
    vi.mocked(getRequestUser).mockResolvedValue({ id: 'user-123' } as any)

    const res = await POST(makeRequest({ token: 'ExpoToken[abc]', platform: 'ios' }))
    expect(res.status).toBe(200)
    expect(mockFrom).toHaveBeenCalledWith('push_tokens')
    expect(mockUpsert).toHaveBeenCalledWith(
      { auth_user_id: 'user-123', token: 'ExpoToken[abc]', platform: 'ios' },
      { onConflict: 'token' },
    )
  })
})
```

- [ ] **Step 2: Run to confirm FAIL**

```bash
pnpm test apps/web/app/api/push/register/route.test.ts
```

Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Write route**

Create `apps/web/app/api/push/register/route.ts`:

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import { getRequestUser } from '@/lib/getRequestUser'
import { rateLimit } from '@/lib/rateLimit'

const bodySchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android']),
})

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, 'push/register')
  if (limited) return limited

  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { token, platform } = parsed.data

  const { error } = await supabaseAdmin
    .from('push_tokens')
    .upsert({ auth_user_id: user.id, token, platform }, { onConflict: 'token' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Check what getRequestUser import path is**

```bash
grep -rn "getRequestUser" apps/web/lib/ apps/web/app/ --include="*.ts" | head -5
```

Note the actual import path (it may be `@/lib/supabaseServer` not `@/lib/getRequestUser`) and fix route.ts import to match.

- [ ] **Step 5: Run tests to confirm PASS**

```bash
pnpm test apps/web/app/api/push/register/route.test.ts
```

Expected: 4 passing.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/api/push/register/
git commit -m "feat(api): POST /api/push/register — upsert Expo push token"
```

---

## Task 3: pushNotification.ts — Expo Push API helper

**Files:**
- Create: `apps/web/inngest/pushNotification.ts`

- [ ] **Step 1: Write the module**

Create `apps/web/inngest/pushNotification.ts`:

```typescript
import { supabaseAdmin } from '../server/supabaseAdmin.server'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

type PushMessage = {
  to: string
  title?: string
  body: string
  sound?: 'default'
  data?: Record<string, unknown>
}

/**
 * Sends one or more push messages to the Expo Push API.
 * Throws if the API returns a non-2xx status.
 */
export async function sendExpoPush(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(messages),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Expo Push API ${res.status}: ${text}`)
  }
}

/**
 * Fetches push tokens for all accepted coordinators in the org,
 * then sends them the given notification.
 */
export async function sendPushToOrgCoordinators(
  orgId: string,
  notification: { title?: string; body: string; data?: Record<string, unknown> },
): Promise<void> {
  // Step 1: resolve coordinator user IDs for this org
  const { data: members, error: memberError } = await supabaseAdmin
    .from('memberships')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('role', 'coordinator')
    .not('accepted_at', 'is', null)

  if (memberError || !members || members.length === 0) return

  const userIds = members.map((m) => m.user_id)

  // Step 2: fetch push tokens for those users
  const { data: tokenRows, error: tokenError } = await supabaseAdmin
    .from('push_tokens')
    .select('token')
    .in('auth_user_id', userIds)

  if (tokenError || !tokenRows || tokenRows.length === 0) return

  const messages: PushMessage[] = tokenRows.map((r) => ({
    to: r.token,
    sound: 'default',
    ...notification,
  }))

  await sendExpoPush(messages)
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep pushNotification
```

Expected: no errors for pushNotification.ts.

- [ ] **Step 3: Commit**

```bash
git add apps/web/inngest/pushNotification.ts
git commit -m "feat(inngest): Expo Push API helper + sendPushToOrgCoordinators"
```

---

## Task 4: journalFlagAlert — event-driven Inngest function

**Files:**
- Create: `apps/web/inngest/functions/journalFlagAlert.ts`
- Create: `apps/web/inngest/functions/__tests__/journalFlagAlert.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/web/inngest/functions/__tests__/journalFlagAlert.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSendPush = vi.fn().mockResolvedValue(undefined)
vi.mock('../../pushNotification', () => ({
  sendPushToOrgCoordinators: mockSendPush,
}))

// Re-export detectFlagAlert for unit testing the pure logic
import { handleFlagAlert } from '../journalFlagAlert'

describe('handleFlagAlert', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('calls sendPushToOrgCoordinators with correct args', async () => {
    await handleFlagAlert({ orgId: 'org-1', eventId: 'evt-1', recipientId: 'rec-1' })
    expect(mockSendPush).toHaveBeenCalledWith('org-1', {
      title: 'Entry flagged for doctor',
      body: 'A journal entry has been flagged — tap to review.',
      data: { eventId: 'evt-1', screen: 'journal' },
    })
  })

  it('does not throw when orgId is missing', async () => {
    await expect(handleFlagAlert({ orgId: '', eventId: 'evt-1', recipientId: 'rec-1' })).resolves.not.toThrow()
    expect(mockSendPush).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to confirm FAIL**

```bash
pnpm test apps/web/inngest/functions/__tests__/journalFlagAlert.test.ts
```

Expected: FAIL — `Cannot find module '../journalFlagAlert'`

- [ ] **Step 3: Write the function**

Create `apps/web/inngest/functions/journalFlagAlert.ts`:

```typescript
import { inngest } from '../client'
import { sendPushToOrgCoordinators } from '../pushNotification'

// Pure handler — exported for unit tests
export async function handleFlagAlert(data: {
  orgId: string
  eventId: string
  recipientId: string
}): Promise<void> {
  if (!data.orgId) return

  await sendPushToOrgCoordinators(data.orgId, {
    title: 'Entry flagged for doctor',
    body: 'A journal entry has been flagged — tap to review.',
    data: { eventId: data.eventId, screen: 'journal' },
  })
}

export const journalFlagAlert = inngest.createFunction(
  { id: 'journal-flag-alert' },
  { event: 'journal/flagged' },
  async ({ event }) => {
    await handleFlagAlert(event.data as { orgId: string; eventId: string; recipientId: string })
    return { sent: true }
  },
)
```

- [ ] **Step 4: Run tests to confirm PASS**

```bash
pnpm test apps/web/inngest/functions/__tests__/journalFlagAlert.test.ts
```

Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/inngest/functions/journalFlagAlert.ts apps/web/inngest/functions/__tests__/journalFlagAlert.test.ts
git commit -m "feat(inngest): journalFlagAlert — push notification on journal flag"
```

---

## Task 5: Wire flag route to send journal/flagged Inngest event

**Files:**
- Modify: `apps/web/app/api/journal/[eventId]/flag/route.ts`

The existing flag route does a DB update and returns. After this task, when `flagged: true`, it also calls `inngest.send('journal/flagged', { eventId, orgId })`.

- [ ] **Step 1: Read the existing test to understand what to keep**

```bash
cat apps/web/app/api/journal/[eventId]/flag/route.test.ts
```

Note what's already tested so you don't break it.

- [ ] **Step 2: Modify the route**

In `apps/web/app/api/journal/[eventId]/flag/route.ts`, add the Inngest send after the successful DB update:

Add import at top:
```typescript
import { inngest } from '@/inngest/client'
```

Replace the success return block (after `const { error } = await supabaseAdmin.from('care_events').update...`) with:

```typescript
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Send push notification to coordinators when an entry is flagged for the doctor
    if (body.flagged) {
      await inngest.send({
        name: 'journal/flagged',
        data: { eventId: idParsed.data, orgId, recipientId: event.recipient_id },
      })
    }

    return NextResponse.json({ success: true, flagged: body.flagged })
```

- [ ] **Step 3: Run existing flag route tests**

```bash
pnpm test apps/web/app/api/journal/[eventId]/flag/route.test.ts
```

Expected: all existing tests pass (mock inngest.send if needed).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/journal/[eventId]/flag/route.ts
git commit -m "feat(api): flag route sends journal/flagged Inngest event on flag=true"
```

---

## Task 6: Register journalFlagAlert in Inngest serve route

**Files:**
- Modify: `apps/web/app/api/inngest/route.ts`

- [ ] **Step 1: Add import and register**

In `apps/web/app/api/inngest/route.ts`:

Add import:
```typescript
import { journalFlagAlert } from '../../../inngest/functions/journalFlagAlert'
```

Update the `functions` array:
```typescript
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [weeklyDigest, gapDetector, refillAlert, ocrPrescription, burnoutAlert, journalFlagAlert],
})
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep -E "route|inngest" | head -10
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/inngest/route.ts
git commit -m "feat(inngest): register journalFlagAlert function"
```

---

## Task 7: Wire gapDetector to send push notifications

**Files:**
- Modify: `apps/web/inngest/functions/gapDetector.ts`

- [ ] **Step 1: Add import**

In `apps/web/inngest/functions/gapDetector.ts`, add at top:

```typescript
import { sendPushToOrgCoordinators } from '../pushNotification'
```

- [ ] **Step 2: Add push call after gap event insert**

Inside the `for (const gap of gaps)` loop, after the `await supabaseAdmin.from('care_events').insert(...)` call and `totalGaps++`, add:

```typescript
              // Notify coordinators via push
              try {
                const label = gap.label ?? 'a care window'
                await sendPushToOrgCoordinators(orgId, {
                  title: 'Coverage gap detected',
                  body: `Coverage gap: ${label} needs a caregiver today.`,
                  data: { orgId, windowId: gap.id, screen: 'schedule' },
                })
              } catch (pushErr) {
                logger.warn('Push notification failed (non-fatal): ' + String(pushErr))
              }
```

Push errors are non-fatal — always catch so a push failure doesn't prevent the Inngest step from completing.

- [ ] **Step 3: Run existing gapDetector tests**

```bash
pnpm test apps/web/inngest/functions/__tests__/gapDetector.test.ts
```

Expected: all existing tests pass (push helper is not imported in tests — mock it if needed).

- [ ] **Step 4: Commit**

```bash
git add apps/web/inngest/functions/gapDetector.ts
git commit -m "feat(inngest): gapDetector sends push notification to coordinators"
```

---

## Task 8: Wire burnoutAlert to send push notifications

**Files:**
- Modify: `apps/web/inngest/functions/burnoutAlert.ts`

- [ ] **Step 1: Add import**

In `apps/web/inngest/functions/burnoutAlert.ts`, add at top:

```typescript
import { sendPushToOrgCoordinators } from '../pushNotification'
```

- [ ] **Step 2: Add push call after alert insert**

Inside the `atRiskUserIds.map(userId => step.run(...))` callback, after `totalAlerts++` and before the closing brace of `step.run`, add:

```typescript
          // Notify coordinators via push (non-fatal)
          try {
            await sendPushToOrgCoordinators(orgId, {
              title: 'Caregiver burnout risk',
              body: "A caregiver's stress score has been high for 2+ weeks — check in today.",
              data: { orgId, screen: 'journal' },
            })
          } catch (pushErr) {
            logger.warn('Push notification failed (non-fatal): ' + String(pushErr))
          }
```

- [ ] **Step 3: Run existing burnoutAlert tests**

```bash
pnpm test apps/web/inngest/functions/__tests__/burnoutAlert.test.ts
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/inngest/functions/burnoutAlert.ts
git commit -m "feat(inngest): burnoutAlert sends push notification to coordinators"
```

---

## Task 9: Mobile settings — notification permission + push token registration

**Files:**
- Modify: `apps/mobile/app/(app)/settings/index.tsx`

expo-notifications is already a standard Expo SDK module. Install it:

- [ ] **Step 1: Install expo-notifications**

```bash
cd apps/mobile && npx expo install expo-notifications
```

- [ ] **Step 2: Rewrite settings screen**

Replace `apps/mobile/app/(app)/settings/index.tsx` with:

```typescript
import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { signOut, getSession } from '../../../utils/auth'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

async function registerForPushNotifications(): Promise<void> {
  // Only physical devices support push notifications
  if (!Constants.isDevice) {
    Alert.alert('Push notifications only work on a physical device.')
    return
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    Alert.alert('Notifications blocked', 'Enable notifications in Settings to receive care alerts.')
    return
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined
  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId })
  const token = tokenData.data

  const session = await getSession()
  if (!session) return

  await fetch(`${API_URL}/api/push/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ token, platform: Platform.OS === 'ios' ? 'ios' : 'android' }),
  })
}

export default function SettingsScreen() {
  const router = useRouter()
  const [notifStatus, setNotifStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown')

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      setNotifStatus(status === 'granted' ? 'granted' : 'denied')
    })
  }, [])

  async function handleEnableNotifications() {
    await registerForPushNotifications()
    const { status } = await Notifications.getPermissionsAsync()
    setNotifStatus(status === 'granted' ? 'granted' : 'denied')
  }

  async function handleSignOut() {
    await signOut()
    router.replace('/(auth)/sign-in')
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        {notifStatus === 'granted' ? (
          <Text style={styles.grantedText}>✓ Push notifications enabled</Text>
        ) : (
          <TouchableOpacity style={styles.notifBtn} onPress={handleEnableNotifications}>
            <Text style={styles.notifBtnText}>Enable care alerts</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 24, marginTop: 8 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  grantedText: { fontSize: 15, color: '#16a34a' },
  notifBtn: { backgroundColor: '#0369a1', borderRadius: 8, padding: 14, alignItems: 'center' },
  notifBtnText: { color: '#fff', fontWeight: '600' },
  signOutBtn: { borderWidth: 1, borderColor: '#ef4444', borderRadius: 8, padding: 14, alignItems: 'center' },
  signOutText: { color: '#ef4444', fontWeight: '600' },
})
```

- [ ] **Step 3: Typecheck mobile**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(app)/settings/index.tsx apps/mobile/package.json
git commit -m "feat(mobile): settings — notification permission + Expo push token registration"
```

---

## Task 10: Full test suite + typecheck

- [ ] **Step 1: Run all web unit tests**

```bash
pnpm test
```

Expected: all existing tests pass; journalFlagAlert tests (2) pass.

- [ ] **Step 2: Typecheck web**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Typecheck mobile**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Run RLS tests**

```bash
supabase test db
```

Expected: all tests pass (push_tokens table has no pgTAP tests — RLS is simple owner-only policy, covered structurally by the migration).

---

## Self-Review

**Spec coverage check (design spec Section 4A):**
- ✅ `push_tokens` table — Task 1
- ✅ `POST /api/push/register` — Task 2
- ✅ `expo-notifications` setup + permission prompt — Task 9
- ✅ Push token registration in settings — Task 9
- ✅ `gapDetector` sends push — Task 7
- ✅ `burnoutAlert` sends push — Task 8
- ✅ New `journalFlagAlert` Inngest function — Task 4
- ✅ Flag route triggers `journalFlagAlert` — Task 5
- ✅ journalFlagAlert registered — Task 6
- ✅ APNs credentials via EAS — **not in plan** — this is infrastructure (done in EAS dashboard, not in code). Operator note: upload `.p8` APNs key in EAS project settings before production build.

**Placeholder scan:** None found.

**Type consistency:** `handleFlagAlert` exported from `journalFlagAlert.ts` and imported in test. `sendPushToOrgCoordinators` exported from `pushNotification.ts` and imported by `gapDetector`, `burnoutAlert`, `journalFlagAlert`. `PushMessage` type is internal to `pushNotification.ts` — not leaked.
