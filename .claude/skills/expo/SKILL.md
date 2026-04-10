# Expo / React Native — Carelog Mobile

Reference skill for working in `apps/mobile/`. Invoke when editing Expo/React Native code.

**READ this before touching `apps/mobile/`.** Patterns here differ significantly from `apps/web/`.

---

## Navigation (Expo Router)

- File-based routing — `app/` directory maps to routes, same as Next.js App Router but for native screens
- Typed routes via `href` — use `router.push('/journal')` not bare strings where possible
- Stack navigator is the default; tabs live in `app/(tabs)/`
- Deep link pattern for OTP callback: `carelog://auth/callback?token=...`
  - Registered in `app.json` under `scheme: "carelog"`
  - Handle in the auth screen with `expo-linking` `useURL()` hook

```ts
import * as Linking from 'expo-linking'
const url = Linking.useURL()
// parse token from url on mount
```

---

## Styling

- **NativeWind** for utility classes — same class names as Tailwind web, different runtime
  - Use `className` prop on `View`, `Text`, `Pressable` etc.
  - No CSS-in-JS, no `style={{ }}` for static styles
- **`StyleSheet.create`** only for dynamic styles that depend on runtime values (e.g. animated values, layout measurements)
- No Turbopack restrictions here — template literals are fine in React Native props
- No `px`/`rem`/`vh` — dimensions are logical pixels; use `Dimensions` API for screen-relative sizing

---

## Auth

- **No cookies** — React Native has no cookie jar
- Token persistence: `expo-secure-store`

```ts
import * as SecureStore from 'expo-secure-store'
await SecureStore.setItemAsync('session', JSON.stringify(session))
const raw = await SecureStore.getItemAsync('session')
```

- OTP flow: send OTP → user taps link → app opens via deep link → exchange token
- Supabase client: `createClient()` (browser client) — same as web `useEffect` pattern
  - Do NOT use `createServerSupabase()` — no server context in React Native
- Protected screens: redirect in `useEffect` if no session, same pattern as web but no middleware

---

## tRPC

- Shared router lives in `packages/` — do not duplicate types or procedures
- Mobile client uses `httpBatchLink`, not server component transport:

```ts
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from '@carelog/api'

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_URL}/api/trpc`,
      headers: async () => ({
        authorization: `Bearer ${await getToken()}`,
      }),
    }),
  ],
})
```

- Auth header injection: read session token from SecureStore and attach as `Authorization: Bearer`

---

## Testing

- **No Vitest/jsdom** for React Native components — the DOM environment doesn't exist
- Use `jest-expo` for component tests if needed (currently skipped — Expo SDK instability)
- **What to test now:**
  - tRPC input/output shapes (pure logic, no component rendering)
  - Auth state transitions (token store read/write)
  - Navigation guard logic (extracted to pure functions)
- Run tests: `cd apps/mobile && pnpm test` (jest-expo)

---

## Rules — break things if ignored

1. **No `window` or `document`** — these don't exist in React Native; any web utility that uses them will crash
2. **Expo SDK 52** — don't upgrade packages that pin to it without checking compatibility matrix first
3. **Env vars:** use `expo-constants` (`Constants.expoConfig.extra`), not `process.env` (except in `metro.config.js`)
4. **EAS build:** always bump `version` in `app.json` before submitting to stores; EAS rejects duplicate versions
5. **Metro bundler** — not Turbopack; different caching behavior; run `expo start --clear` to bust cache after config changes
6. **Icons:** use `@expo/vector-icons`, not `lucide-react` (web) or `lucide-react-native` without verifying Expo SDK compatibility

---

## Quick Reference

| Web pattern | Mobile equivalent |
|-------------|------------------|
| `next/navigation` useRouter | `expo-router` useRouter |
| `document.cookie` / Supabase SSR | `expo-secure-store` |
| `middleware.ts` auth guard | `useEffect` redirect in screen |
| Tailwind `className` | NativeWind `className` |
| `process.env.NEXT_PUBLIC_*` | `Constants.expoConfig.extra.*` |
| Playwright e2e | Detox (not yet configured) |
