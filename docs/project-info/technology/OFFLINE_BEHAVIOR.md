# Offline Behavior — Carelog Web

## What is queued

**Journal entries only.** When the user submits a journal entry while offline, the entry is written to an IndexedDB store (`carelog-offline` / `journal-queue`) and a toast confirms the save. On reconnect the queue flushes automatically.

## What is NOT queued

All other write operations show an inline error UI when the request fails:

- Medications (add / check off)
- Shifts (create / close)
- Expenses
- Invites / team changes
- OCR uploads
- AI assistant queries

These operations involve server-side state machines or file storage that are not safe to defer.

## Queue storage

| Property | Value |
|---|---|
| Storage | IndexedDB (`carelog-offline` DB, `journal-queue` store) |
| Scope | Same-origin, per-user device |
| Max depth | 100 entries |
| Cleared on | Logout (`clearAll()` called before `supabase.auth.signOut()`) |
| Key | `client_id` UUID generated at queue time |

## Idempotency / conflict policy

Each queued entry carries a `client_id` (UUID). The `care_events` table has a partial unique index on `client_id WHERE client_id IS NOT NULL`. If the same entry is submitted twice (e.g., double-flush after a retry), the second insert returns Postgres error `23505`; the API responds with the existing row instead of an error. **Last-writer-wins on the payload is not a concern** — duplicate flushes of the same `client_id` are no-ops.

## Retry policy

- Each entry tracks `attempts`.
- Flush retries up to **3 attempts** total.
- After 3 failures the entry moves to "dead-letter" status (still in IDB) and the user sees a toast error.
- Dead-letter entries are not retried automatically; manual "Sync now" will skip them.

## Safari storage eviction

Safari may evict IndexedDB data for origins idle for **7 days** under storage pressure. Users who are offline for more than 7 days on Safari may lose queued entries silently. This is a known limitation documented here; no mitigation is planned for v1.

## Sync banner

When the user is online and `queueDepth > 0`, a banner appears above the journal entry form with a "Sync now" button. The banner is hidden when offline or when the queue is empty.

## Scope expansion path (v2+)

- Service worker shell to cache the app shell and queue mutations from any tab/page
- Background sync via `SyncManager` API (Chromium only)
- These are out of scope for v1; the current implementation covers the primary caregiver workflow (journal page open, network drops and returns)
