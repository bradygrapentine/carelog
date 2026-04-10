# Mobile Wave 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Expo mobile app — navigation, auth, tRPC client, five core screens, offline write flush, and jest-expo test harness.

**Architecture:** Expo Router (file-based navigation, mirrors Next.js App Router) over the existing monorepo foundation. The tRPC client reuses the web app's `AppRouter` type for full type safety with zero duplication. Offline writes flush to `careEvents.insert` with idempotency on reconnect.

**Tech Stack:** Expo SDK 55 · Expo Router · `@trpc/react-query` · `@tanstack/react-query` · `expo-secure-store` · `@supabase/supabase-js` · `@react-native-community/netinfo` · jest-expo · Maestro

**Already installed (no install needed):** `@trpc/client`, `@trpc/react-query`, `@tanstack/react-query`, `expo-secure-store`, `@supabase/supabase-js`, `@react-native-community/netinfo`, `@carelog/schemas`, `@carelog/types`

---

## File Map

```
apps/mobile/
  app.json                              MODIFY — add scheme + Expo Router plugin + deep link domains
  package.json                          MODIFY — add expo-router, expo-linking
  app/
    _layout.tsx                         CREATE — root layout: TrpcProvider + QueryClient
    (auth)/
      _layout.tsx                       CREATE — redirect to (app) if session exists
      sign-in.tsx                       CREATE — OTP email input
      verify.tsx                        CREATE — 6-digit code + session hydration
    (app)/
      _layout.tsx                       CREATE — bottom tabs; redirect to (auth) if no session
      index.tsx                         CREATE — org + recipient selector
      journal/
        index.tsx                       CREATE — timeline + inline entry form + sync banner
      medications/
        index.tsx                       CREATE — today's checklist
      schedule/
        index.tsx                       CREATE — next 7 days shifts
      invite/
        [token].tsx                     CREATE — deep-link invite acceptance
      settings/
        index.tsx                       CREATE — sign out + notification prompt placeholder
  utils/
    trpc.ts                             CREATE — tRPC React client
    supabase.ts                         CREATE — Supabase browser client (mobile)
    auth.ts                             CREATE — SecureStore session helpers
    watchBridge.ts                      CREATE — no-op stub (replaced in Wave 3)
  context/
    AppContext.tsx                      CREATE — orgId + recipientId + currentRole
  hooks/
    useSyncStatus.ts                    CREATE — 'synced' | 'pending' | 'offline'
    useOfflineWrite.ts                  MODIFY — implement flush call (replace TODO)
  __tests__/
    useOfflineWrite.test.ts             CREATE
    useSyncStatus.test.ts               CREATE
    watchBridge.test.ts                 CREATE
  .maestro/
    sign-in.yaml                        CREATE
    journal-entry.yaml                  CREATE
```

---

## Task 1: Install Expo Router + update app.json

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/app.json`

- [ ] **Step 1: Install expo-router and expo-linking**

```bash
cd apps/mobile
npx expo install expo-router expo-linking
```

Expected: packages added to `package.json` dependencies.

- [ ] **Step 2: Update app.json**

Replace `apps/mobile/app.json` with:

```json
{
  "expo": {
    "name": "Carelog",
    "slug": "carelog",
    "version": "1.0.0",
    "scheme": "yourcarelog",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "plugins": [
      "expo-router",
      "expo-secure-store"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.carelog.app",
      "associatedDomains": ["applinks:yourcarelog.com"]
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/android-icon-foreground.png",
        "backgroundColor": "#E6F4FE"
      },
      "package": "com.carelog.app",
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            { "scheme": "https", "host": "yourcarelog.com", "pathPrefix": "/invite" }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    },
    "web": { "favicon": "./assets/favicon.png" }
  }
}
```

- [ ] **Step 3: Update package.json main entry**

In `apps/mobile/package.json`, change `"main": "index.ts"` to `"main": "expo-router/entry"`.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: 0 errors (strict mode already enabled).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app.json apps/mobile/package.json
git commit -m "feat(mobile): install expo-router, configure scheme + deep links"
```

---

## Task 2: Core utilities — tRPC client, Supabase client, auth helpers

**Files:**
- Create: `apps/mobile/utils/trpc.ts`
- Create: `apps/mobile/utils/supabase.ts`
- Create: `apps/mobile/utils/auth.ts`

- [ ] **Step 1: Create tRPC client**

Create `apps/mobile/utils/trpc.ts`:

```typescript
import { createTRPCReact } from '@trpc/react-query'
import { httpBatchLink } from '@trpc/client'
import type { AppRouter } from '../../web/server/trpc/router'

export const trpc = createTRPCReact<AppRouter>()

export function createTrpcClient(getToken: () => Promise<string | null>) {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'}/api/trpc`,
        async headers() {
          const token = await getToken()
          return token ? { authorization: `Bearer ${token}` } : {}
        },
      }),
    ],
  })
}
```

Note: The type import `from '../../web/server/trpc/router'` is a relative path from within `apps/mobile/`. Add to `apps/mobile/tsconfig.json` compilerOptions:
```json
"paths": {
  "../../web/*": ["../web/*"]
}
```

- [ ] **Step 2: Create Supabase mobile client**

Create `apps/mobile/utils/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
)
```

- [ ] **Step 3: Create auth helpers**

Create `apps/mobile/utils/auth.ts`:

```typescript
import { supabase } from './supabase'
import type { Session } from '@supabase/supabase-js'

export async function getSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getAccessToken(): Promise<string | null> {
  const session = await getSession()
  return session?.access_token ?? null
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}
```

- [ ] **Step 4: Add .env.local for mobile**

Create `apps/mobile/.env.local`:
```
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRFA0NiK7kyqHnTdDqBK0hxr2e4EeBmEhIaOJCv1_6M
EXPO_PUBLIC_API_URL=http://localhost:3000
```

(These are the local Supabase dev credentials — safe to commit `.env.local` for mobile since these are public anon keys for local dev only. Production values go in EAS Secrets.)

- [ ] **Step 5: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/utils/ apps/mobile/.env.local apps/mobile/tsconfig.json
git commit -m "feat(mobile): tRPC client, Supabase mobile client, auth helpers"
```

---

## Task 3: AppContext — org + recipient state

**Files:**
- Create: `apps/mobile/context/AppContext.tsx`

- [ ] **Step 1: Create context**

Create `apps/mobile/context/AppContext.tsx`:

```typescript
import { createContext, useContext, useState } from 'react'

type AppContextValue = {
  orgId: string | null
  recipientId: string | null
  currentRole: string | null
  setOrg: (orgId: string, recipientId: string, role: string) => void
}

const AppContext = createContext<AppContextValue>({
  orgId: null,
  recipientId: null,
  currentRole: null,
  setOrg: () => {},
})

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [recipientId, setRecipientId] = useState<string | null>(null)
  const [currentRole, setCurrentRole] = useState<string | null>(null)

  function setOrg(o: string, r: string, role: string) {
    setOrgId(o)
    setRecipientId(r)
    setCurrentRole(role)
  }

  return (
    <AppContext.Provider value={{ orgId, recipientId, currentRole, setOrg }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/context/
git commit -m "feat(mobile): AppContext — orgId, recipientId, currentRole"
```

---

## Task 4: Root layout + auth/app layout guards

**Files:**
- Create: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/(auth)/_layout.tsx`
- Create: `apps/mobile/app/(app)/_layout.tsx`

- [ ] **Step 1: Create root layout**

Create `apps/mobile/app/_layout.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { trpc, createTrpcClient } from '../utils/trpc'
import { getAccessToken } from '../utils/auth'
import { AppProvider } from '../context/AppContext'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } },
})

export default function RootLayout() {
  const [trpcClient] = useState(() => createTrpcClient(getAccessToken))

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </AppProvider>
      </QueryClientProvider>
    </trpc.Provider>
  )
}
```

- [ ] **Step 2: Create auth layout guard**

Create `apps/mobile/app/(auth)/_layout.tsx`:

```typescript
import { useEffect } from 'react'
import { Stack, useRouter } from 'expo-router'
import { getSession } from '../../utils/auth'

export default function AuthLayout() {
  const router = useRouter()

  useEffect(() => {
    getSession().then((session) => {
      if (session) router.replace('/(app)')
    })
  }, [])

  return <Stack screenOptions={{ headerShown: false }} />
}
```

- [ ] **Step 3: Create app layout with bottom tabs**

Create `apps/mobile/app/(app)/_layout.tsx`:

```typescript
import { useEffect } from 'react'
import { Tabs, useRouter } from 'expo-router'
import { getSession } from '../../utils/auth'

export default function AppLayout() {
  const router = useRouter()

  useEffect(() => {
    getSession().then((session) => {
      if (!session) router.replace('/(auth)/sign-in')
    })
  }, [])

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#0369a1' }}>
      <Tabs.Screen name="index" options={{ title: 'Home', href: null }} />
      <Tabs.Screen name="journal/index" options={{ title: 'Journal' }} />
      <Tabs.Screen name="medications/index" options={{ title: 'Medications' }} />
      <Tabs.Screen name="schedule/index" options={{ title: 'Schedule' }} />
      <Tabs.Screen name="invite/[token]" options={{ href: null }} />
      <Tabs.Screen name="settings/index" options={{ title: 'Settings' }} />
    </Tabs>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/
git commit -m "feat(mobile): root layout, auth guard, app bottom tabs"
```

---

## Task 5: Auth screens — sign-in + verify

**Files:**
- Create: `apps/mobile/app/(auth)/sign-in.tsx`
- Create: `apps/mobile/app/(auth)/verify.tsx`

- [ ] **Step 1: Create sign-in screen**

Create `apps/mobile/app/(auth)/sign-in.tsx`:

```typescript
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { supabase } from '../../utils/supabase'

export default function SignInScreen() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit() {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return

    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ email: trimmed })
    setLoading(false)

    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    await SecureStore.setItemAsync('pending_email', trimmed)
    router.push('/(auth)/verify')
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in to Carelog</Text>
      <Text style={styles.subtitle}>We'll send a 6-digit code to your email.</Text>
      <TextInput
        style={styles.input}
        placeholder="your@email.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoFocus
      />
      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Sending…' : 'Send code'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6b7280', marginBottom: 32 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 14, fontSize: 16, marginBottom: 16 },
  button: { backgroundColor: '#0369a1', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
```

- [ ] **Step 2: Create verify screen**

Create `apps/mobile/app/(auth)/verify.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { supabase } from '../../utils/supabase'

export default function VerifyScreen() {
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    SecureStore.getItemAsync('pending_email').then((e) => { if (e) setEmail(e) })
  }, [])

  async function handleVerify() {
    if (code.length !== 6) return

    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
    setLoading(false)

    if (error) {
      Alert.alert('Invalid code', 'Please check the code and try again.')
      return
    }

    await SecureStore.deleteItemAsync('pending_email')

    // Check for pending invite token
    const pendingInvite = await SecureStore.getItemAsync('pending_invite_token')
    if (pendingInvite) {
      router.replace({ pathname: '/(app)/invite/[token]', params: { token: pendingInvite } })
    } else {
      router.replace('/(app)')
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Check your email</Text>
      <Text style={styles.subtitle}>Enter the 6-digit code sent to {email}</Text>
      <TextInput
        style={styles.input}
        placeholder="123456"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
      />
      <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={loading || code.length !== 6}>
        <Text style={styles.buttonText}>{loading ? 'Verifying…' : 'Verify'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Use a different email</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6b7280', marginBottom: 32 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 14, fontSize: 24, letterSpacing: 8, textAlign: 'center', marginBottom: 16 },
  button: { backgroundColor: '#0369a1', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  back: { marginTop: 16, alignItems: 'center' },
  backText: { color: '#6b7280', fontSize: 14 },
})
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(auth)/
git commit -m "feat(mobile): sign-in + verify OTP screens with invite token bridge"
```

---

## Task 6: Org/recipient selector (app index)

**Files:**
- Create: `apps/mobile/app/(app)/index.tsx`

- [ ] **Step 1: Create org selector**

Create `apps/mobile/app/(app)/index.tsx`:

```typescript
import { useEffect } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { trpc } from '../../utils/trpc'
import { useApp } from '../../context/AppContext'

export default function OrgSelectorScreen() {
  const router = useRouter()
  const { setOrg } = useApp()
  const { data: orgs, isLoading } = trpc.organizations.list.useQuery()

  useEffect(() => {
    // Auto-select if only one org with one recipient
    if (orgs?.length === 1) {
      const org = orgs[0]
      // Navigate to journal directly — recipient resolved inside journal screen
      setOrg(org.id, '', 'coordinator') // role resolved from memberships
      router.replace('/(app)/journal')
    }
  }, [orgs])

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0369a1" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your care teams</Text>
      <FlatList
        data={orgs ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => {
              setOrg(item.id, '', 'coordinator')
              router.replace('/(app)/journal')
            }}
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No care teams yet.</Text>}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16, marginTop: 48 },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 16, marginBottom: 10 },
  cardTitle: { fontSize: 17, fontWeight: '600' },
  empty: { color: '#9ca3af', textAlign: 'center', marginTop: 48 },
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/index.tsx
git commit -m "feat(mobile): org selector — auto-advances when single org"
```

---

## Task 7: Journal screen — timeline + offline entry form

**Files:**
- Create: `apps/mobile/app/(app)/journal/index.tsx`

- [ ] **Step 1: Create journal screen**

Create `apps/mobile/app/(app)/journal/index.tsx`:

```typescript
import { useState } from 'react'
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { trpc } from '../../../utils/trpc'
import { useOfflineWrite } from '../../../hooks/useOfflineWrite'
import { useSyncStatus } from '../../../hooks/useSyncStatus'
import { useApp } from '../../../context/AppContext'

const MOOD_TAGS = ['good', 'okay', 'difficult', 'crisis'] as const
type Mood = typeof MOOD_TAGS[number]

const MOOD_COLORS: Record<Mood, string> = {
  good: '#22c55e', okay: '#f59e0b', difficult: '#ef4444', crisis: '#7f1d1d',
}

export default function JournalScreen() {
  const { orgId, recipientId } = useApp()
  const [text, setText] = useState('')
  const [mood, setMood] = useState<Mood>('okay')
  const [submitting, setSubmitting] = useState(false)
  const syncStatus = useSyncStatus()
  const { write } = useOfflineWrite()

  const { data: timeline, isLoading, refetch } = trpc.careEvents.timeline.useQuery(
    { recipientId: recipientId ?? '' },
    { enabled: !!recipientId, staleTime: 5 * 60 * 1000 },
  )

  async function handleSubmit() {
    if (!text.trim() || !recipientId) return
    const entry = text.trim()
    setText('')
    setSubmitting(true)
    await write({
      event_type: 'journal',
      entry_kind: 'human',
      payload: { text: entry, mood },
      recipient_id: recipientId,
    })
    setSubmitting(false)
    refetch()
  }

  return (
    <View style={styles.container}>
      {syncStatus !== 'synced' && (
        <View style={[styles.syncBanner, syncStatus === 'offline' ? styles.offlineBanner : styles.pendingBanner]}>
          <Text style={styles.syncText}>
            {syncStatus === 'offline' ? '● Offline — entries will sync when connected' : '↑ Syncing entries…'}
          </Text>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#0369a1" />
      ) : (
        <FlatList
          data={timeline ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.entry}>
              <Text style={styles.entryTime}>
                {new Date(item.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Text style={styles.entryText}>{(item.payload as any)?.text ?? item.event_type}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No entries yet. Add the first one below.</Text>}
        />
      )}

      <View style={styles.form}>
        <View style={styles.moodRow}>
          {MOOD_TAGS.map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.moodTag, mood === m && { backgroundColor: MOOD_COLORS[m] }]}
              onPress={() => setMood(m)}
            >
              <Text style={[styles.moodTagText, mood === m && { color: '#fff' }]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder="What's happening with care today?"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[styles.submitBtn, (!text.trim() || submitting) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!text.trim() || submitting}
        >
          <Text style={styles.submitText}>{submitting ? 'Saving…' : 'Add entry'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  syncBanner: { paddingVertical: 6, paddingHorizontal: 12 },
  offlineBanner: { backgroundColor: '#fef3c7' },
  pendingBanner: { backgroundColor: '#eff6ff' },
  syncText: { fontSize: 12, color: '#374151' },
  loader: { marginTop: 48 },
  list: { padding: 16, paddingBottom: 8 },
  entry: { borderLeftWidth: 2, borderLeftColor: '#e5e7eb', paddingLeft: 12, marginBottom: 16 },
  entryTime: { fontSize: 12, color: '#9ca3af', marginBottom: 2 },
  entryText: { fontSize: 15, color: '#111827' },
  empty: { color: '#9ca3af', textAlign: 'center', marginTop: 48 },
  form: { borderTopWidth: 1, borderTopColor: '#f3f4f6', padding: 12 },
  moodRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  moodTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb' },
  moodTagText: { fontSize: 13, color: '#374151' },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10, fontSize: 15, minHeight: 72, textAlignVertical: 'top', marginBottom: 10 },
  submitBtn: { backgroundColor: '#0369a1', borderRadius: 8, padding: 12, alignItems: 'center' },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: '#fff', fontWeight: '600' },
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/journal/
git commit -m "feat(mobile): journal screen — timeline, mood entry, sync banner"
```

---

## Task 8: Medications screen

**Files:**
- Create: `apps/mobile/app/(app)/medications/index.tsx`

- [ ] **Step 1: Create medications screen**

Create `apps/mobile/app/(app)/medications/index.tsx`:

```typescript
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { trpc } from '../../../utils/trpc'
import { writeWatchData } from '../../../utils/watchBridge'
import { useApp } from '../../../context/AppContext'

export default function MedicationsScreen() {
  const { orgId, recipientId } = useApp()

  const { data: scheduled, isLoading, refetch } = trpc.medications.listScheduled.useQuery(
    { org_id: orgId ?? '', recipient_id: recipientId ?? '' },
    {
      enabled: !!orgId && !!recipientId,
      staleTime: 5 * 60 * 1000,
      onSuccess: (data) => {
        // Feed next medication to watch complications
        const next = data?.find((m) => !m.administered_today)
        if (next) {
          writeWatchData({ nextMedication: { name: next.medication_name, dueAt: next.next_due_at ?? '' } })
        }
      },
    },
  )

  const { data: todayLog } = trpc.medications.todayLog.useQuery(
    { org_id: orgId ?? '', recipient_id: recipientId ?? '' },
    { enabled: !!orgId && !!recipientId },
  )

  const logMutation = trpc.medications.logAdministration.useMutation({
    onSuccess: () => refetch(),
  })

  const administeredIds = new Set((todayLog ?? []).map((l: any) => l.medication_schedule_id))

  if (isLoading) {
    return <ActivityIndicator style={{ marginTop: 48 }} size="large" color="#0369a1" />
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Today's medications</Text>
      <FlatList
        data={scheduled ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const given = administeredIds.has(item.id)
          return (
            <View style={styles.row}>
              <View style={styles.info}>
                <Text style={styles.medName}>{item.medication_name}</Text>
                <Text style={styles.medDose}>{item.dose} · {item.scheduled_time}</Text>
              </View>
              <TouchableOpacity
                style={[styles.btn, given && styles.givenBtn]}
                disabled={given}
                onPress={() => logMutation.mutate({
                  org_id: orgId!,
                  recipient_id: recipientId!,
                  medication_schedule_id: item.id,
                  administered_at: new Date().toISOString(),
                  status: 'given',
                })}
              >
                <Text style={[styles.btnText, given && styles.givenText]}>
                  {given ? '✓ Given' : 'Mark given'}
                </Text>
              </TouchableOpacity>
            </View>
          )
        }}
        ListEmptyComponent={<Text style={styles.empty}>No medications scheduled for today.</Text>}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  info: { flex: 1 },
  medName: { fontSize: 16, fontWeight: '600' },
  medDose: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  btn: { backgroundColor: '#0369a1', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  givenBtn: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#86efac' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  givenText: { color: '#16a34a' },
  empty: { color: '#9ca3af', textAlign: 'center', marginTop: 48 },
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/medications/
git commit -m "feat(mobile): medications screen — checklist, log administration, watch data feed"
```

---

## Task 9: Schedule screen

**Files:**
- Create: `apps/mobile/app/(app)/schedule/index.tsx`

- [ ] **Step 1: Create schedule screen**

Create `apps/mobile/app/(app)/schedule/index.tsx`:

```typescript
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import { trpc } from '../../../utils/trpc'
import { writeWatchData } from '../../../utils/watchBridge'
import { useApp } from '../../../context/AppContext'

function formatShiftTime(iso: string) {
  return new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ScheduleScreen() {
  const { orgId, recipientId } = useApp()

  const since = new Date().toISOString()
  const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: shifts, isLoading } = trpc.shifts.list.useQuery(
    { org_id: orgId ?? '', recipient_id: recipientId ?? '', since, until },
    {
      enabled: !!orgId && !!recipientId,
      staleTime: 5 * 60 * 1000,
      onSuccess: (data) => {
        const next = data?.[0]
        if (next) {
          writeWatchData({ nextShift: { assigneeName: next.assignee_name ?? 'Unassigned', startsAt: next.starts_at } })
        }
      },
    },
  )

  if (isLoading) {
    return <ActivityIndicator style={{ marginTop: 48 }} size="large" color="#0369a1" />
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Next 7 days</Text>
      <FlatList
        data={shifts ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.time}>
              <Text style={styles.timeText}>{formatShiftTime(item.starts_at)}</Text>
              <Text style={styles.duration}>
                {Math.round((new Date(item.ends_at).getTime() - new Date(item.starts_at).getTime()) / 3600000)}h
              </Text>
            </View>
            <Text style={styles.assignee}>{item.assignee_name ?? 'Unassigned'}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No shifts scheduled for the next 7 days.</Text>}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  time: { flex: 1 },
  timeText: { fontSize: 15, fontWeight: '500' },
  duration: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  assignee: { fontSize: 14, color: '#374151' },
  empty: { color: '#9ca3af', textAlign: 'center', marginTop: 48 },
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/schedule/
git commit -m "feat(mobile): schedule screen — next 7 days shifts + watch data feed"
```

---

## Task 10: Invite screen + deep link handling

**Files:**
- Create: `apps/mobile/app/(app)/invite/[token].tsx`

- [ ] **Step 1: Create invite screen**

Create `apps/mobile/app/(app)/invite/[token].tsx`:

```typescript
import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { getSession } from '../../../utils/auth'

type InviteDetails = {
  org_name: string
  role: string
  invited_by: string
}

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>()
  const router = useRouter()
  const [details, setDetails] = useState<InviteDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

  useEffect(() => {
    async function init() {
      const session = await getSession()
      if (!session) {
        // Save token and redirect to sign-in; verify screen will redirect back
        await SecureStore.setItemAsync('pending_invite_token', token)
        router.replace('/(auth)/sign-in')
        return
      }
      // Fetch invite details
      const res = await fetch(`${API_URL}/api/invite/${token}`)
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()
      setDetails(data)
      setLoading(false)
    }
    init()
  }, [token])

  async function handleAccept() {
    setAccepting(true)
    const session = await getSession()
    const res = await fetch(`${API_URL}/api/invite/${token}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
    })
    setAccepting(false)
    if (!res.ok) {
      Alert.alert('Error', 'Could not accept invite. It may have already been used.')
      return
    }
    await SecureStore.deleteItemAsync('pending_invite_token')
    router.replace('/(app)/journal')
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#0369a1" />

  if (!details) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Invite not found</Text>
        <Text style={styles.subtitle}>This invite may have expired or already been used.</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>You're invited!</Text>
      <Text style={styles.subtitle}>
        {details.invited_by} invited you to join {details.org_name} as a {details.role}.
      </Text>
      <TouchableOpacity style={styles.btn} onPress={handleAccept} disabled={accepting}>
        <Text style={styles.btnText}>{accepting ? 'Joining…' : 'Accept invite'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6b7280', marginBottom: 32, lineHeight: 24 },
  btn: { backgroundColor: '#0369a1', borderRadius: 8, padding: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/invite/
git commit -m "feat(mobile): invite screen — deep link acceptance with SecureStore token bridge"
```

---

## Task 11: Settings screen

**Files:**
- Create: `apps/mobile/app/(app)/settings/index.tsx`

- [ ] **Step 1: Create settings screen**

Create `apps/mobile/app/(app)/settings/index.tsx`:

```typescript
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { signOut } from '../../../utils/auth'

export default function SettingsScreen() {
  const router = useRouter()

  async function handleSignOut() {
    await signOut()
    router.replace('/(auth)/sign-in')
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      {/* Notification permission prompt added in Wave 2 */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 24, marginTop: 8 },
  signOutBtn: { borderWidth: 1, borderColor: '#ef4444', borderRadius: 8, padding: 14, alignItems: 'center' },
  signOutText: { color: '#ef4444', fontWeight: '600' },
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/settings/
git commit -m "feat(mobile): settings screen — sign out (notification prompt added in Wave 2)"
```

---

## Task 12: Offline flush + useSyncStatus hook

**Files:**
- Modify: `apps/mobile/hooks/useOfflineWrite.ts`
- Create: `apps/mobile/hooks/useSyncStatus.ts`

- [ ] **Step 1: Implement flush in useOfflineWrite**

Replace the TODO block in `apps/mobile/hooks/useOfflineWrite.ts`. The full file becomes:

```typescript
import { useEffect, useCallback } from 'react'
import NetInfo from '@react-native-community/netinfo'
import { enqueue, dequeue, incrementAttempts, getQueue } from '../store/offlineQueue'
import type { EventType } from '@carelog/types'
import { trpc } from '../utils/trpc'

const MAX_ATTEMPTS = 5

async function flushQueue(
  insertMutation: (input: {
    orgId: string
    recipientId: string
    eventType: string
    entryKind: 'human' | 'system'
    payload: Record<string, unknown>
    occurredAt: string
    idempotencyKey: string
  }) => Promise<unknown>,
  orgId: string,
) {
  const queue = await getQueue()
  if (queue.length === 0) return

  for (const write of queue) {
    if (write.attempts >= MAX_ATTEMPTS) {
      await dequeue(write.id)
      continue
    }
    try {
      await insertMutation({
        orgId,
        recipientId: write.recipient_id,
        eventType: write.event_type,
        entryKind: write.entry_kind,
        payload: write.payload as Record<string, unknown>,
        occurredAt: write.occurred_at,
        idempotencyKey: write.id,
      })
      await dequeue(write.id)
    } catch {
      await incrementAttempts(write.id)
    }
  }
}

export function useOfflineWrite(orgId: string) {
  const insertMutation = trpc.careEvents.insert.useMutation()

  // Flush on reconnect
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        flushQueue((input) => insertMutation.mutateAsync(input as any), orgId).catch(console.error)
      }
    })
    return unsub
  }, [orgId])

  const write = useCallback(
    async (event: {
      event_type: EventType
      entry_kind: 'human' | 'system'
      payload: unknown
      recipient_id: string
    }) => {
      const id = crypto.randomUUID()
      const occurred_at = new Date().toISOString()
      await enqueue({ id, occurred_at, attempts: 0, ...event })
      const net = await NetInfo.fetch()
      if (net.isConnected) {
        await flushQueue((input) => insertMutation.mutateAsync(input as any), orgId)
      }
    },
    [orgId],
  )

  return { write }
}
```

- [ ] **Step 2: Create useSyncStatus hook**

Create `apps/mobile/hooks/useSyncStatus.ts`:

```typescript
import { useEffect, useState } from 'react'
import NetInfo from '@react-native-community/netinfo'
import { getQueue } from '../store/offlineQueue'

type SyncStatus = 'synced' | 'pending' | 'offline'

export function useSyncStatus(): SyncStatus {
  const [isConnected, setIsConnected] = useState(true)
  const [queueLength, setQueueLength] = useState(0)

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsConnected(!!state.isConnected)
    })
    return unsub
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      getQueue().then((q) => setQueueLength(q.length))
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  if (!isConnected) return 'offline'
  if (queueLength > 0) return 'pending'
  return 'synced'
}
```

- [ ] **Step 3: Update journal screen to pass orgId to useOfflineWrite**

In `apps/mobile/app/(app)/journal/index.tsx`, update the `useOfflineWrite` call to pass `orgId`:

```typescript
const { write } = useOfflineWrite(orgId ?? '')
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/hooks/
git commit -m "feat(mobile): offline flush implementation + useSyncStatus hook"
```

---

## Task 13: watchBridge no-op stub

**Files:**
- Create: `apps/mobile/utils/watchBridge.ts`

- [ ] **Step 1: Create stub**

Create `apps/mobile/utils/watchBridge.ts`:

```typescript
// Stub — replaced by native Expo Module in Wave 3 (watch complications)
// Safe to call on Android and when no watch is paired.

type WatchData = {
  nextShift?: { assigneeName: string; startsAt: string } | null
  nextMedication?: { name: string; dueAt: string } | null
}

export function writeWatchData(_data: WatchData): void {
  // no-op until CarelogWatch native module is wired in Wave 3
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/utils/watchBridge.ts
git commit -m "feat(mobile): watchBridge no-op stub (replaced by native module in Wave 3)"
```

---

## Task 14: jest-expo test harness + core tests

**Files:**
- Create: `apps/mobile/jest.config.js`
- Create: `apps/mobile/__tests__/useOfflineWrite.test.ts`
- Create: `apps/mobile/__tests__/useSyncStatus.test.ts`
- Create: `apps/mobile/__tests__/watchBridge.test.ts`

- [ ] **Step 1: Install jest-expo**

```bash
cd apps/mobile
npx expo install jest-expo @testing-library/react-native
pnpm add -D @types/jest
```

- [ ] **Step 2: Create jest config**

Create `apps/mobile/jest.config.js`:

```javascript
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  setupFilesAfterFramework: ['@testing-library/react-native/extend-expect'],
  testPathPattern: '__tests__',
}
```

- [ ] **Step 3: Write watchBridge test**

Create `apps/mobile/__tests__/watchBridge.test.ts`:

```typescript
import { writeWatchData } from '../utils/watchBridge'

describe('watchBridge stub', () => {
  it('does not throw when called with partial data', () => {
    expect(() => writeWatchData({ nextShift: null })).not.toThrow()
  })

  it('does not throw when called with full data', () => {
    expect(() =>
      writeWatchData({
        nextShift: { assigneeName: 'Brady', startsAt: '2026-04-10T14:00:00Z' },
        nextMedication: { name: 'Lisinopril', dueAt: '2026-04-10T20:00:00Z' },
      }),
    ).not.toThrow()
  })

  it('does not throw when called with no arguments', () => {
    expect(() => writeWatchData({})).not.toThrow()
  })
})
```

- [ ] **Step 4: Write useSyncStatus test**

Create `apps/mobile/__tests__/useSyncStatus.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react-native'
import { useSyncStatus } from '../hooks/useSyncStatus'

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn((cb: (s: any) => void) => {
    cb({ isConnected: true })
    return jest.fn()
  }),
}))

jest.mock('../store/offlineQueue', () => ({
  getQueue: jest.fn().mockResolvedValue([]),
}))

describe('useSyncStatus', () => {
  it('returns synced when connected and queue is empty', async () => {
    const { result } = renderHook(() => useSyncStatus())
    expect(result.current).toBe('synced')
  })

  it('returns pending when queue has items', async () => {
    const { getQueue } = require('../store/offlineQueue')
    getQueue.mockResolvedValue([{ id: '1' }])
    const { result } = renderHook(() => useSyncStatus())
    // Wait for interval tick
    await act(async () => { await new Promise((r) => setTimeout(r, 2100)) })
    expect(result.current).toBe('pending')
  })
})
```

- [ ] **Step 5: Run tests**

```bash
cd apps/mobile && npx jest --passWithNoTests
```

Expected: all tests pass.

- [ ] **Step 6: Add test script to package.json**

In `apps/mobile/package.json`, add to `"scripts"`:
```json
"test": "jest"
```

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/jest.config.js apps/mobile/__tests__/ apps/mobile/package.json
git commit -m "test(mobile): jest-expo harness + watchBridge + useSyncStatus tests"
```

---

## Task 15: Maestro E2E flows

**Files:**
- Create: `apps/mobile/.maestro/sign-in.yaml`
- Create: `apps/mobile/.maestro/journal-entry.yaml`

- [ ] **Step 1: Create sign-in flow**

Create `apps/mobile/.maestro/sign-in.yaml`:

```yaml
appId: com.carelog.app
---
- launchApp
- assertVisible: "Sign in to Carelog"
- tapOn: "your@email.com"
- inputText: "test@carelog.dev"
- tapOn: "Send code"
- assertVisible: "Check your email"
```

- [ ] **Step 2: Create journal entry flow**

Create `apps/mobile/.maestro/journal-entry.yaml`:

```yaml
appId: com.carelog.app
---
- launchApp
- tapOn: "Journal"
- assertVisible: "What's happening"
- tapOn: "okay"
- tapOn:
    id: "journal-input"
- inputText: "Maestro test entry"
- tapOn: "Add entry"
- assertVisible: "Maestro test entry"
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/.maestro/
git commit -m "test(mobile): Maestro E2E flows — sign-in, journal entry"
```

---

## Verification

After all tasks:

```bash
# TypeScript
cd apps/mobile && npx tsc --noEmit

# Unit tests
cd apps/mobile && npx jest

# Start dev server and smoke test on simulator
npx expo start --ios
```

Manual checklist:
- [ ] OTP sign-in flow works end to end
- [ ] Journal entries appear in timeline
- [ ] Offline entry (airplane mode) enqueues + flushes on reconnect
- [ ] Sync banner appears when queue is non-empty
- [ ] Invite link opens app (test with `npx uri-scheme open "yourcarelog://invite/test123" --ios`)
- [ ] Sign out clears session
