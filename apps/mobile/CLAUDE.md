# Mobile App — Expo SDK 52

## Env vars
`apps/mobile/.env.local`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
Use `http://localhost:54321` (not `127.0.0.1`) for cookie name consistency.

## Offline queue
`store/offlineQueue.ts` — SecureStore persistence
`hooks/useOfflineWrite.ts` — offline-first write hook

The `flushQueue()` function has a TODO stub — tRPC call not yet wired.
When implementing: wire in tRPC client, test with airplane mode on a real device.

## Auth
Use browser client (`createClient()`) for auth checks — same pattern as web local dev.
