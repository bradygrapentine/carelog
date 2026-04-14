# Mobile App — Expo SDK 55 (canary)

## Overview
Expo managed workflow. Plans: `docs/superpowers/plans/2026-04-10-mobile-wave*.md`

## Screenshot Workflow
- Install Puppeteer and Chrome Cache

## Env vars
`apps/mobile/.env.local`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`
Use `localhost:54321` for Supabase — see `docs/project-info/technology/CODE_STANDARDS.md` for rationale.

## Design system
Colors, typography, spacing → `apps/mobile/constants/tokens.ts` (mirrors web CSS vars in `apps/web/app/globals.css`).
Never use raw hex in screen files — always import from tokens.
Styling via React Native `StyleSheet` (not NativeWind/Tailwind — that reference is stale).
Font: Inter (loaded via @expo-google-fonts/inter + expo-font at root layout).

### Design tokens
- Import from `constants/tokens.ts`: `colors`, `spacing`, `radii`, `typography`, `shadows`
- Never paste raw hex values into screen or component files
- Never hardcode spacing or border-radius values that map cleanly to the scale
  - `padding: 16` → `spacing.lg`, `borderRadius: 12` → `radii.lg`, etc.
- Token file is the single source of truth — if a color is missing, add it there first

## Navigation
Expo Router (file-based). Mirrors Next.js App Router mental model.
- `app/(auth)/` — sign-in, verify
- `app/(app)/` — bottom tabs: Journal · Medications · Schedule
- `app/(app)/invite/[token].tsx` — deep-link invite acceptance

## Offline queue
`store/offlineQueue.ts` — SecureStore persistence
`hooks/useOfflineWrite.ts` — offline-first write hook
Flush implementation: maps snake_case QueuedWrite → camelCase tRPC careEvents.insert with idempotency_key.
See Wave 1 plan Task 12 for full implementation.

## tRPC client
`utils/trpc.ts` — createTRPCReact<AppRouter>() with httpBatchLink + Bearer token header
Points at EXPO_PUBLIC_API_URL (localhost:3000 dev, Vercel prod).

## Watch bridge
`utils/watchBridge.ts` — no-op stub in Wave 1; replaced by real Expo Module in Wave 3.
DO NOT implement native logic here — see Wave 3 plan.

`flushQueue()` is wired to `trpc.careEvents.insert.useMutation()` with idempotencyKey.
Flush triggers on NetInfo reconnect and immediately after each write when online.

## iOS native files
Never edit `apps/mobile/ios/` directly — use `expo prebuild --clean` to regenerate.
Exception: `CarelogWatch/` Xcode target files (hand-maintained, outside prebuild scope).

## Dark mode
Screens consume theme via `useAppTheme()` from `hooks/useAppTheme.ts`
rather than importing `colors` directly. The hook returns the active
palette based on system color scheme. Screen migration is tracked in
ON-16 (follow-up to ON-13 — file it in OVERNIGHT_BACKLOG.md if it
doesn't exist yet).

## Auth
Use browser client (`createClient()`) — same pattern as web local dev.
Session persisted in SecureStore via ExpoSecureStoreAdapter.
