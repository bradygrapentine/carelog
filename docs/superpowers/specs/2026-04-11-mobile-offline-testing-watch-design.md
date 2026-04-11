# Mobile: Offline-First, Testing Harness, Apple Watch Companion

**Date:** 2026-04-11
**Status:** Approved
**Branch:** `feature/ui-redesign`

## Context

The Carelog mobile app (Expo SDK 55, React Native 0.83) has 13 functional screens, Supabase OTP auth, tRPC client, and an offline queue — but the queue only covers care events (journal writes). Testing is minimal (3 files). The Apple Watch config plugin and native module stub exist but have no UI or data sync.

This spec covers three sub-projects in priority order:
1. **Offline-first** — generalize the queue to cover time-sensitive care data
2. **Testing harness** — unit + integration tests for hooks and screens
3. **Apple Watch companion** — quick-log (meds + mood), complications, alert escalation

Foundation polish (design tokens, error boundaries, org selection) is explicitly out of scope.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Offline scope | Time-sensitive care data only (meds, symptoms, journal) | Expenses and documents can wait for signal |
| Conflict resolution | Server-side idempotent dedup (30-min time window) | Existing idempotency key infra; no user-facing merge UI |
| Watch v1 quick-log | Medications + mood pulse (not full event picker) | Form factor constraint — keep wrist interactions <5 sec |
| Watch complications | Next med (primary) + shift status (secondary) | Data already flows through writeWatchData |
| Alert escalation | APNs mirroring (no custom watch UI) | Expo Notifications already installed; system mirroring is sufficient |
| Testing approach | Jest + RTL, no Detox | E2E too heavy for this stage; mock at tRPC/NetInfo/SecureStore boundary |
| Architecture approach | Shared queue layer (generalize existing offlineQueue) | 80% of infra exists; no over-engineering with sync engines or per-screen queues |

---

## Sub-Project 1: Offline-First — Shared Queue Layer

### Queue Schema

Generalize `QueuedWrite` in `store/offlineQueue.ts`:

```typescript
type OfflineEntryKind = 'journal_entry' | 'medication_log' | 'symptom_reading'

type QueuedWrite = {
  id: string                        // idempotency key (uuid)
  entry_kind: OfflineEntryKind
  payload: Record<string, unknown>  // screen-specific data
  recipient_id: string
  occurred_at: string               // captured at write time, not flush time
  attempts: number
}
```

### Hook: useOfflineWrite

Same API surface — screens call `write(entryKind, payload)`. Internal behavior:

1. Generate UUID idempotency key
2. Enqueue to SecureStore immediately (with `occurred_at` = now)
3. If online (NetInfo), flush immediately
4. If offline, NetInfo listener flushes on reconnect
5. Flush routes each `entry_kind` to its tRPC mutation

### Mutation Routing

| entry_kind | tRPC mutation | dedup key |
|---|---|---|
| `journal_entry` | `careEvents.insert` | `recipient_id + occurred_at` (existing) |
| `medication_log` | `medications.logAdministration` | `medication_schedule_id + time_window(30min)` |
| `symptom_reading` | `symptoms.log` | `recipient_id + type + time_window(30min)` |

### Server-Side Dedup

Each mutation handler checks before inserting: "Does a record exist with the same dedup key within the 30-minute window?" If yes, return the existing record's ID (200 OK, not error). Client dequeues on success either way.

### Optimistic UI

- Queued writes appear immediately in screen lists with a subtle sync indicator (small dot or icon)
- `useSyncStatus` hook already returns `'synced' | 'pending' | 'offline'` — extend to per-entry status
- On flush success: optimistic entry replaced by server response
- On permanent failure (5 attempts): entry shows error badge with retry option

### Files Changed

| File | Change |
|---|---|
| `store/offlineQueue.ts` | Generalize `QueuedWrite` type, add `entry_kind` field |
| `hooks/useOfflineWrite.ts` | Accept `entryKind` param, add mutation routing map, keep existing flush/retry logic |
| `hooks/useSyncStatus.ts` | Add per-entry sync status (not just global) |
| `app/(app)/medications/index.tsx` | Wire medication log through `useOfflineWrite` instead of direct mutation |
| `app/(app)/symptoms/index.tsx` → `symptoms/log.tsx` | Wire symptom creation through `useOfflineWrite` |
| Server: `medications.logAdministration` | Add dedup check (same schedule_id + 30-min window) |
| Server: `symptoms.create` | Add dedup check (same recipient + type + 30-min window) |

---

## Sub-Project 2: Testing Harness

### Infrastructure

- **Runner:** Jest + `jest-expo` (already configured)
- **Component testing:** `@testing-library/react-native` (already installed)
- **Mock boundary:** tRPC client, NetInfo, SecureStore — all mocked; no native code under test
- **Test utilities:** `__tests__/helpers/renderWithProviders.tsx` — wraps component in tRPC + QueryClient + AppContext providers

### Coverage Plan

| Layer | What to test | Test file |
|---|---|---|
| Offline queue | enqueue, dequeue, flush, retry, max attempts, entry_kind routing | `store/__tests__/offlineQueue.test.ts` |
| useOfflineWrite | online write path, offline enqueue, reconnect flush, error after 5 attempts | `hooks/__tests__/useOfflineWrite.test.ts` |
| useSyncStatus | state transitions: synced → pending → offline → synced | `hooks/__tests__/useSyncStatus.test.ts` (exists, extend) |
| Journal screen | renders timeline, handles empty state, submits entry via offline write | `app/(app)/journal/__tests__/index.test.tsx` |
| Medications screen | renders med list, logs administration, shows sync indicator | `app/(app)/medications/__tests__/index.test.tsx` |
| Schedule screen | renders 7-day shifts, handles empty shifts | `app/(app)/schedule/__tests__/index.test.tsx` |
| Team screen | renders members, invite flow, role badges | `app/(app)/team/__tests__/index.test.tsx` |
| Symptoms screen | renders history, logs new reading | `app/(app)/symptoms/__tests__/index.test.tsx` |
| Burnout screen | renders history, weekly check-in, coordinator view | `app/(app)/burnout/__tests__/index.test.tsx` |
| Auth flow | sign-in OTP, verify code, expired OTP, pending invite redirect | `app/(auth)/__tests__/sign-in.test.tsx`, `verify.test.tsx` |

### What We Don't Test

- Native modules (SecureStore, NetInfo, Camera) — mocked at boundary
- Navigation transitions — Expo Router internals
- Visual regression — no Storybook or screenshot tests in v1
- E2E — no Detox; all tests are unit/integration via Jest

### CI

GitHub Actions workflow: `pnpm --filter mobile test` on push to `feature/ui-redesign` and PRs to `main`. No simulator required.

---

## Sub-Project 3: Apple Watch Companion

### Architecture

Standalone SwiftUI target communicating with iOS app via WCSession. No direct network calls from the watch — all data flows through the phone.

```
Phone (Expo)                              Watch (SwiftUI)
─────────────                             ────────────────
writeWatchData()                          
  → Native Module                         
    → WCSession.transferUserInfo() ──────→ SessionDelegate receives userInfo
                                            → update local state
                                            → refresh complications

                                          User taps "Log Med" or "Mood"
WCSessionDelegate receives message ←───── WCSession.sendMessage()
  → enqueue to offlineQueue                 
  → flush via useOfflineWrite              
```

### Quick-Log: Medications

- Watch displays list of upcoming/due medications from last `writeWatchData` transfer
- Each row: medication name + dosage + time due
- Tap → confirmation screen ("Log Metformin 500mg?") → confirm button
- Confirmation sends `WCSession.sendMessage({ type: 'medication_log', payload })` to phone
- Phone enqueues as `medication_log` entry_kind in the shared offline queue
- Watch shows checkmark animation, returns to list

### Quick-Log: Mood Pulse

- Single screen accessible from main nav
- 5 emoji buttons: great / good / okay / rough / bad
- Tap → immediate send via `WCSession.sendMessage({ type: 'journal_entry', payload: { mood } })`
- Phone enqueues as `journal_entry` with mood payload
- Watch shows brief confirmation, returns to main view

### Complications

| Complication | Family | Content | Data Source |
|---|---|---|---|
| Primary | `graphicRectangular` | Next medication: name, dosage, countdown | `writeWatchData` → `nextMedication` |
| Secondary | `graphicCircular` | Shift status: caregiver initial + time remaining | `writeWatchData` → `nextShift` |

Timeline entries refreshed when phone pushes new data via `transferUserInfo`. Complication updates via `CLKComplicationServer.sharedInstance().reloadTimeline(for:)`.

### Alert Escalation

No custom watch implementation. Expo Notifications push via APNs automatically mirrors to paired Apple Watch. System default notification UI. Already functional once push tokens are registered (settings screen handles this).

### Swift Files

All hand-maintained in `watchos/CarelogWatch/`:

| File | Purpose |
|---|---|
| `CarelogWatchApp.swift` | App entry point, WCSession activation |
| `ContentView.swift` | Main navigation: medication list + mood pulse button |
| `MedConfirmView.swift` | Single medication confirmation ("Log X?") |
| `MoodPulseView.swift` | 5-option mood selector with emoji buttons |
| `ComplicationProvider.swift` | CLKComplicationDataSource: timeline entries for both complications |
| `SessionDelegate.swift` | WCSessionDelegate: receive userInfo, send messages to phone |

### What We Don't Build in v1

- No direct API calls from watch (no auth/token management on watch)
- No offline queue on the watch itself (phone handles all persistence)
- No custom notification UI (system mirroring is sufficient)
- No watchOS settings or configuration screen

---

## Sequencing

1. **Offline-first** — generalize queue + server dedup + optimistic UI
2. **Testing** — test utilities + hook tests + screen tests + CI (tests cover the new offline layer)
3. **Apple Watch** — Swift UI + WCSession + complications (tested manually on simulator; no automated watch tests in v1)

Each sub-project is a separate implementation plan and can be committed independently.
