# Mobile App — Expo SDK 55 (canary)

## Env vars
`apps/mobile/.env.local`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
Use `http://localhost:54321` (not `127.0.0.1`) for cookie name consistency.

## Offline queue
`store/offlineQueue.ts` — SecureStore persistence
`hooks/useOfflineWrite.ts` — offline-first write hook

`flushQueue()` is wired to `trpc.careEvents.insert.useMutation()` with idempotencyKey.
Flush triggers on NetInfo reconnect and immediately after each write when online.

## Auth
Use browser client (`createClient()`) for auth checks — same pattern as web local dev.
