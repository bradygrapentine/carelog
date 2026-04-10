# Carelog Mobile — Design Spec

**Date:** 2026-04-10
**Scope:** Expo mobile app (foundation + offline-first), Apple Watch complications (B), push notification alert escalation (D), and mobile harness.

---

## 1. Architecture Overview

### Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Expo SDK 52 (managed workflow) | Already in monorepo; `expo prebuild` generates native projects when needed |
| Navigation | Expo Router (file-based) | Mirrors Next.js App Router mental model; auth layout gates trivially |
| API client | `@trpc/client` + TanStack Query | Same procedures and types as web; no separate API layer |
| Session storage | `expo-secure-store` | Encrypted, survives app restarts |
| Offline writes | `apps/mobile/store/offlineQueue.ts` (existing) + tRPC flush | SecureStore-backed queue already built; flush call is the missing piece |
| Shared packages | `@carelog/schemas`, `@carelog/types` | Already wired in `apps/mobile/` |
| TypeScript | Strict mode enabled | Matches web standards |

### tRPC Client

`apps/mobile/utils/trpc.ts` creates a client pointing at `EXPO_PUBLIC_API_URL`. In development this is `http://localhost:3000`; in production the deployed Vercel URL. All existing web procedures are available with full type safety.

```typescript
// apps/mobile/utils/trpc.ts
import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '@carelog/web/server/trpc/router'

export const trpc = createTRPCReact<AppRouter>()
```

### App Entry Point

`App.tsx` wraps the Expo Router with a `TrpcProvider` (same pattern as web). Session is hydrated from SecureStore before the first render; Expo Router's root layout redirects unauthenticated users to `(auth)/sign-in`.

---

## 2. Screen Inventory

### File structure

```
apps/mobile/app/
  _layout.tsx                  # Root layout — TrpcProvider + session hydration
  (auth)/
    _layout.tsx                # Redirects to (app) if already authed
    sign-in.tsx                # OTP email input
    verify.tsx                 # 6-digit code entry
  (app)/
    _layout.tsx                # Bottom tab bar; redirects to (auth) if not authed
    index.tsx                  # Org + recipient selector
    journal/
      index.tsx                # Timeline + inline entry form
    medications/
      index.tsx                # Today's checklist — log administration
    schedule/
      index.tsx                # Upcoming shifts, next 7 days
    invite/
      [token].tsx              # Invite acceptance (deep link target)
    settings/
      index.tsx                # Sign out, notification opt-in
```

### Bottom tab bar

**Journal · Medications · Schedule** — Settings accessible via gear icon in tab bar header. Invite is a modal/deep-link destination, not a tab.

### Screen summaries

**`(auth)/sign-in.tsx`**
Email input → calls `supabase.auth.signInWithOtp()`. No tRPC involved. Reads any pending invite token from SecureStore and passes it through the OTP flow.

**`(auth)/verify.tsx`**
6-digit OTP input → `supabase.auth.verifyOtp()`. On success: persist session to SecureStore, check for pending invite token → navigate to invite screen or index.

**`(app)/index.tsx`**
Calls `trpc.organizations.list` to get the user's care teams. If exactly one org + one recipient, auto-navigates to journal. Otherwise shows a picker. Stores `orgId` + `recipientId` in React context for all child screens.

**`(app)/journal/index.tsx`**
- Calls `trpc.careEvents.getTimeline` with React Query
- Renders timeline (human entries + system events, same data shape as web)
- Inline "Add entry" form at bottom: text + mood tag selector → `useOfflineWrite`
- Sync banner: "X entries pending sync" when queue is non-empty + offline
- `staleTime: 5 * 60 * 1000`

**`(app)/medications/index.tsx`**
- Calls `trpc.medications.listScheduled` + `trpc.medications.todayLog`
- Checklist of today's medications with time windows
- One-tap "Given" / "Skipped" → `trpc.medications.logAdministration`
- **Writes shift + medication data to App Group** via `watchBridge.writeWatchData()` after successful fetch (feeds watch complications)

**`(app)/schedule/index.tsx`**
- Calls `trpc.shifts.list` filtered to next 7 days
- Shows all shifts; caller's own shifts highlighted
- **Writes next shift data to App Group** via `watchBridge.writeWatchData()` after fetch

**`(app)/invite/[token].tsx`**
- Reads token from route params (deep link: `yourcarelog://invite/[token]`)
- Calls `GET /api/invite/[token]` via plain `fetch` (REST route, not tRPC) to fetch invite details (org name, role, inviter)
- If not authed: saves token to SecureStore → redirects to sign-in → returns here after OTP
- Accept button: `POST /api/invite/[token]/accept` via plain `fetch` → navigates to journal on success
- Falls back to web (`yourcarelog.com/invite/[token]`) if app not installed

**`(app)/settings/index.tsx`**
- Sign out: `supabase.auth.signOut()` + clear SecureStore + navigate to sign-in
- Notification permissions: `requestPermissionsAsync()` from `expo-notifications`
- Push token registration (see Section 4)

---

## 3. Offline-First Strategy

### Write path

`useOfflineWrite` (already built in `apps/mobile/hooks/useOfflineWrite.ts`) is wired to `trpc.careEvents.insert` with the queued entry's `id` as the idempotency key:

```typescript
// The missing flush implementation
await trpc.careEvents.insert.mutate({
  event_type: write.event_type,
  entry_kind: write.entry_kind,
  payload: write.payload,
  recipient_id: write.recipient_id,
  occurred_at: write.occurred_at,
  idempotency_key: write.id,
})
```

The `idempotency_key` field already exists on `careEvents.insert` — the server uses it for `insertEventIdempotent` to prevent duplicate submissions on retry.

Max attempts: 5 (already enforced). After 5 failures: dequeue + push a local notification ("Entry could not be synced — please check your connection").

### Read path

React Query cache only. `staleTime: 5 * 60 * 1000` — stale reads while offline are acceptable for caregiving. No SQLite in v1.

### Sync indicator

`useSyncStatus` hook: combines `NetInfo.useNetInfo()` + `getQueue()` length. Returns `'synced' | 'pending' | 'offline'`. Journal header renders a small banner for `pending` and `offline` states.

### Conflict resolution

Last-write-wins via `occurred_at`. The `offlineQueue.ts` already captures `occurred_at: new Date().toISOString()` at enqueue time (not flush time) — this is correct. Server stores it as-is; no server-side timestamp overwrite.

---

## 4. Watch Extension + Push Notifications

### 4A. Push Notifications — Alert Escalation (D)

**Setup:**
- `expo-notifications` package
- APNs credentials via EAS (`.p8` key in EAS project settings)
- Push token registered in `settings/index.tsx` on permission grant → stored in `identity_vault` or a new `push_tokens` table (one token per device, associated with `auth_user_id`)

**Notification pipeline:**

```
Inngest function detects event
        ↓
POST to Expo Push API  (https://exp.host/--/api/v2/push/send)
        ↓
APNs delivery to iPhone
        ↓
Apple Watch auto-mirrors notification (zero extra code)
```

Inngest functions that trigger push notifications:

| Function | Trigger | Category | Message |
|---|---|---|---|
| `gapDetector.ts` | Coverage gap found | `coverage_gap` | "Coverage gap on [date] — [time window] needs a caregiver" |
| `burnoutAlert.ts` | Burnout threshold | `burnout_alert` | "[Name]'s burnout score is high — check in today" |
| New: `journalFlagAlert` | Coordinator flags entry for doctor | `journal_flag` | "Entry flagged for doctor — tap to view" |

**Push token storage:**

New table `push_tokens`:
```sql
CREATE TABLE push_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  platform   TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

New API route `POST /api/push/register` (coordinator and caregiver roles only — supporters and aides don't need alerts): upserts the push token for the current user.

### 4B. Watch Complications (B)

**Architecture:**

A native Swift Xcode target (`CarelogWatch`) added to the Expo managed project via `expo prebuild`. The watch extension is a WidgetKit bundle — SwiftUI, ~150 lines of Swift total.

**App Group:** `group.com.carelog` — shared `UserDefaults` suite between phone app (`apps/mobile`) and watch extension (`CarelogWatch`).

**Data contract** (JSON stored under key `"watchData"` in the App Group):

```typescript
// Written by apps/mobile/utils/watchBridge.ts
type WatchData = {
  nextShift: { assigneeName: string; startsAt: string } | null
  nextMedication: { name: string; dueAt: string } | null
  updatedAt: string
}
```

**`apps/mobile/utils/watchBridge.ts`** — custom Expo Module (~50 lines Swift, ~20 lines TS):
- `writeWatchData(data: WatchData): void` — writes to App Group UserDefaults
- Called by medications and schedule screens after successful data fetch
- No-ops gracefully on Android and when watch is not paired

**Watch complications — two families:**

| Widget | WidgetKit family | Displays |
|---|---|---|
| `ShiftComplication` | `.accessoryRectangular` | "Brady · 2:00 PM" (next shift assignee + start time) |
| `MedComplication` | `.accessoryCircular` | "Lisinopril\n8:00 PM" (next med name + due time) |

Both use `AppIntentTimelineProvider` — timeline refreshes when the phone writes new data to the App Group (watch extension observes `UserDefaults` changes via `NotificationCenter`).

**Fallback states:**
- No upcoming shift: "No shifts today"
- No medication due: "All meds given" or "No meds"
- App Group not populated yet (first launch): "Open Carelog"

---

## 5. Mobile Harness

### Testing

| Layer | Tool | Location |
|---|---|---|
| Unit / integration | jest-expo + React Native Testing Library | `apps/mobile/__tests__/` |
| E2E | Maestro | `apps/mobile/.maestro/` |
| Swift watch extension | XCTest | `apps/mobile/ios/CarelogWatchTests/` |

**jest-expo coverage targets:**
- `useOfflineWrite` (flush implementation) — tested with mocked `NetInfo` and mocked tRPC
- `watchBridge.ts` — mock the native module, assert correct data shape written
- `useSyncStatus` — unit test all three states
- Screen tests: journal entry submission, medication log, invite acceptance

**Maestro flows:**
- `sign-in.yaml` — OTP sign-in (Mailpit integration)
- `journal-entry.yaml` — submit a journal entry, verify it appears in timeline
- `offline-sync.yaml` — toggle airplane mode, submit entry, reconnect, verify sync
- `invite-accept.yaml` — open deep link, accept invite, verify redirect to journal

### CI Pipeline (GitHub Actions + EAS)

```yaml
# On PR:
- pnpm typecheck (mobile tsconfig)
- jest-expo (unit tests)

# On main merge:
- EAS Build --profile development
- Maestro smoke test (journal-entry flow)

# On release tag:
- EAS Build --profile production
- EAS Submit → App Store Connect
```

### `.claude/settings.json` hook additions

```json
{
  "PostToolUse": [
    {
      "matcher": "Edit|Write",
      "hooks": [{
        "type": "command",
        "command": "python3 -c \"import sys,json; d=json.load(sys.stdin); fp=d.get('tool_input',{}).get('file_path',''); exit(0 if 'apps/mobile' in fp and fp.endswith(('.ts','.tsx')) else 1)\" 2>/dev/null && cd apps/mobile && npx tsc --noEmit 2>&1 | head -10 || true"
      }]
    },
    {
      "matcher": "Edit|Write",
      "hooks": [{
        "type": "command",
        "command": "python3 -c \"import sys,json; d=json.load(sys.stdin); fp=d.get('tool_input',{}).get('file_path',''); exit(0 if 'apps/mobile' in fp and fp.endswith('.swift') else 1)\" 2>/dev/null && echo '[swift] Swift file changed — run: xcodebuild test -scheme CarelogWatch' || true"
      }]
    }
  ],
  "PreToolUse": [
    {
      "matcher": "Edit|Write",
      "hooks": [{
        "type": "command",
        "command": "python3 -c \"import sys,json; d=json.load(sys.stdin); fp=d.get('tool_input',{}).get('file_path',''); exit(1 if 'apps/mobile/ios/' in fp and not fp.endswith(('Info.plist','entitlements')) else 0)\" || (echo '[blocked] ios/ edit rejected — use expo prebuild to regenerate native projects' && exit 2)"
      }]
    }
  ]
}
```

### TypeScript strict mode

`apps/mobile/tsconfig.json` — add `"strict": true`. Fix any resulting errors as part of the foundation task (likely a handful of implicit `any` in the existing hook files).

---

## 6. Decomposition into Implementation Waves

This design decomposes into three sequential waves:

**Wave 1 — Mobile Foundation** (prerequisite for everything else)
- Expo Router setup, auth flow, tRPC client
- Core screens: journal, medications, schedule, settings, invite
- Offline flush implementation (`useOfflineWrite` → `trpc.careEvents.insert` with `idempotency_key`)
- `watchBridge.ts` no-op stub (so screens can call it safely; replaced by real native module in Wave 3)
- jest-expo harness + Maestro flows
- CI pipeline

**Wave 2 — Push Notifications (D)**
- `push_tokens` table + `POST /api/push/register`
- `expo-notifications` setup + APNs via EAS
- Wire Inngest functions to Expo Push API
- New `journalFlagAlert` Inngest function

**Wave 3 — Watch Complications (B)**
- `watchBridge` custom Expo Module
- `CarelogWatch` Xcode target + WidgetKit complications
- `ShiftComplication` + `MedComplication` SwiftUI widgets
- App Group data contract wiring
- XCTest for watch data contract

---

## Non-Goals (v1)

- Benefits navigator, document vault, EOL planner, outer circle on mobile
- Coordinator invite-sending from mobile (invites received only)
- Android watch (Wear OS) support
- Background fetch / periodic silent push sync (v2)
- Siri shortcuts / App Intents (v2)
