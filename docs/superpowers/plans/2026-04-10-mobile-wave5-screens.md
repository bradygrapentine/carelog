# Mobile Wave 5 — Team, Symptoms, Burnout, Expenses, Documents

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 new mobile screens (team, symptoms, burnout, expenses, documents) with 2 new bottom tabs (Team + More hub), consuming existing tRPC backends.

**Architecture:** Each screen is a thin tRPC consumer — no new backend work. Shared utilities in `wave5Utils.ts` provide formatters and permission helpers (TDD). Stepped wizard pattern for symptom and burnout entry. Document upload uses `expo-image-picker` + `expo-document-picker` posting multipart form to existing `/api/documents/upload`.

**Tech Stack:** React Native, Expo Router, tRPC React Query, expo-image-picker, expo-document-picker

**Spec:** `docs/superpowers/specs/2026-04-10-mobile-wave5-screens-design.md`

**Mobile scope only:** Do NOT modify any files outside `apps/mobile/`. The web instance handles `apps/web/`, `packages/`, `supabase/`.

---

## Context for all tasks

**Key files to understand patterns:**
- `apps/mobile/app/(app)/_layout.tsx` — tab bar (currently 4 visible tabs + hidden routes)
- `apps/mobile/app/(app)/journal/index.tsx` — example screen with tRPC, FlatList, StyleSheet
- `apps/mobile/utils/journalUtils.ts` — example shared utils module
- `apps/mobile/context/AppContext.tsx` — provides `orgId`, `recipientId`, `currentRole` via `useApp()`
- `apps/mobile/utils/trpc.ts` — tRPC client, `trpc` is a `createTRPCReact<AppRouter>()` instance

**tRPC input conventions:** Some routers use snake_case fields (`org_id`, `recipient_id`), some use camelCase (`orgId`). Match each router exactly:
- `memberships`: camelCase (`orgId`, `recipientId`)
- `symptoms`: snake_case (`org_id`, `recipient_id`)
- `burnout`: snake_case (`org_id`, `user_id`, `week_stamp`)
- `expenses`: snake_case (`org_id`, `recipient_id`)
- `documents`: snake_case (`org_id`, `recipient_id`)

**Auth token for API routes:** Use `getSession()` from `../../utils/auth` → `session.access_token`.

---

## Task 1: Shared utilities + tests

**Files:**
- Create: `apps/mobile/utils/wave5Utils.ts`
- Create: `apps/mobile/__tests__/wave5Utils.test.ts`

### Step 1: Write failing tests

- [ ] Create `apps/mobile/__tests__/wave5Utils.test.ts`:

```ts
import {
  formatCurrency,
  formatWeekStamp,
  formatFileSize,
  canInvite,
  canLogSymptoms,
  canLogExpense,
  canUploadDocument,
  canDeleteExpense,
  EXPENSE_CATEGORIES,
  DOC_TYPES,
  APPETITE_OPTIONS,
  MOBILITY_OPTIONS,
} from '../utils/wave5Utils'

describe('wave5Utils', () => {
  describe('formatCurrency', () => {
    it('formats whole numbers', () => {
      expect(formatCurrency(42)).toBe('$42.00')
    })
    it('formats decimals', () => {
      expect(formatCurrency(42.5)).toBe('$42.50')
    })
    it('formats zero', () => {
      expect(formatCurrency(0)).toBe('$0.00')
    })
    it('formats large amounts', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56')
    })
  })

  describe('formatWeekStamp', () => {
    it('parses ISO week to readable string', () => {
      const result = formatWeekStamp('2026-W15')
      expect(result).toContain('Apr')
    })
    it('returns input for invalid stamp', () => {
      expect(formatWeekStamp('bad')).toBe('bad')
    })
  })

  describe('formatFileSize', () => {
    it('formats bytes', () => {
      expect(formatFileSize(512)).toBe('512 B')
    })
    it('formats kilobytes', () => {
      expect(formatFileSize(2048)).toBe('2.0 KB')
    })
    it('formats megabytes', () => {
      expect(formatFileSize(1048576)).toBe('1.0 MB')
    })
    it('formats zero', () => {
      expect(formatFileSize(0)).toBe('0 B')
    })
  })

  describe('canInvite', () => {
    it('coordinator can invite', () => {
      expect(canInvite('coordinator')).toBe(true)
    })
    it('caregiver cannot invite', () => {
      expect(canInvite('caregiver')).toBe(false)
    })
    it('supporter cannot invite', () => {
      expect(canInvite('supporter')).toBe(false)
    })
    it('aide cannot invite', () => {
      expect(canInvite('aide')).toBe(false)
    })
    it('null cannot invite', () => {
      expect(canInvite(null)).toBe(false)
    })
  })

  describe('canLogSymptoms', () => {
    it('coordinator can log', () => {
      expect(canLogSymptoms('coordinator')).toBe(true)
    })
    it('caregiver can log', () => {
      expect(canLogSymptoms('caregiver')).toBe(true)
    })
    it('supporter cannot log', () => {
      expect(canLogSymptoms('supporter')).toBe(false)
    })
    it('aide cannot log', () => {
      expect(canLogSymptoms('aide')).toBe(false)
    })
    it('null cannot log', () => {
      expect(canLogSymptoms(null)).toBe(false)
    })
  })

  describe('canLogExpense', () => {
    it('coordinator can log', () => {
      expect(canLogExpense('coordinator')).toBe(true)
    })
    it('caregiver can log', () => {
      expect(canLogExpense('caregiver')).toBe(true)
    })
    it('supporter cannot log', () => {
      expect(canLogExpense('supporter')).toBe(false)
    })
    it('null cannot log', () => {
      expect(canLogExpense(null)).toBe(false)
    })
  })

  describe('canUploadDocument', () => {
    it('coordinator can upload', () => {
      expect(canUploadDocument('coordinator')).toBe(true)
    })
    it('caregiver cannot upload', () => {
      expect(canUploadDocument('caregiver')).toBe(false)
    })
    it('null cannot upload', () => {
      expect(canUploadDocument(null)).toBe(false)
    })
  })

  describe('canDeleteExpense', () => {
    it('coordinator can delete', () => {
      expect(canDeleteExpense('coordinator')).toBe(true)
    })
    it('caregiver cannot delete', () => {
      expect(canDeleteExpense('caregiver')).toBe(false)
    })
    it('null cannot delete', () => {
      expect(canDeleteExpense(null)).toBe(false)
    })
  })

  describe('constants', () => {
    it('EXPENSE_CATEGORIES has 8 items', () => {
      expect(EXPENSE_CATEGORIES).toHaveLength(8)
    })
    it('DOC_TYPES has 6 items', () => {
      expect(DOC_TYPES).toHaveLength(6)
    })
    it('APPETITE_OPTIONS has 4 items', () => {
      expect(APPETITE_OPTIONS).toHaveLength(4)
    })
    it('MOBILITY_OPTIONS has 4 items', () => {
      expect(MOBILITY_OPTIONS).toHaveLength(4)
    })
  })
})
```

### Step 2: Run tests to verify they fail

- [ ] Run: `cd apps/mobile && pnpm test -- wave5Utils`
- Expected: FAIL — `Cannot find module '../utils/wave5Utils'`

### Step 3: Write implementation

- [ ] Create `apps/mobile/utils/wave5Utils.ts`:

```ts
// --- Types ---

export type ExpenseCategory =
  | 'medication'
  | 'supplies'
  | 'equipment'
  | 'home_modification'
  | 'aide_hours'
  | 'transport'
  | 'food'
  | 'other'

export type DocType =
  | 'hipaa_authorization'
  | 'power_of_attorney'
  | 'advance_directive'
  | 'insurance_card'
  | 'medication_list'
  | 'other'

export type Appetite = 'normal' | 'reduced' | 'poor' | 'none'
export type Mobility = 'normal' | 'limited' | 'assisted' | 'bedbound'

// --- Constants ---

export const EXPENSE_CATEGORIES: { key: ExpenseCategory; label: string }[] = [
  { key: 'medication', label: 'Medication' },
  { key: 'supplies', label: 'Supplies' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'home_modification', label: 'Home modification' },
  { key: 'aide_hours', label: 'Aide hours' },
  { key: 'transport', label: 'Transport' },
  { key: 'food', label: 'Food' },
  { key: 'other', label: 'Other' },
]

export const DOC_TYPES: { key: DocType; label: string }[] = [
  { key: 'hipaa_authorization', label: 'HIPAA authorization' },
  { key: 'power_of_attorney', label: 'Power of attorney' },
  { key: 'advance_directive', label: 'Advance directive' },
  { key: 'insurance_card', label: 'Insurance card' },
  { key: 'medication_list', label: 'Medication list' },
  { key: 'other', label: 'Other' },
]

export const APPETITE_OPTIONS: { key: Appetite; label: string }[] = [
  { key: 'normal', label: 'Normal' },
  { key: 'reduced', label: 'Reduced' },
  { key: 'poor', label: 'Poor' },
  { key: 'none', label: 'None' },
]

export const MOBILITY_OPTIONS: { key: Mobility; label: string }[] = [
  { key: 'normal', label: 'Normal' },
  { key: 'limited', label: 'Limited' },
  { key: 'assisted', label: 'Assisted' },
  { key: 'bedbound', label: 'Bedbound' },
]

// --- Formatters ---

export function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatWeekStamp(stamp: string): string {
  const match = stamp.match(/^(\d{4})-W(\d{2})$/)
  if (!match) return stamp
  const year = parseInt(match[1], 10)
  const week = parseInt(match[2], 10)
  // ISO week 1 contains Jan 4. Calculate Monday of the given week.
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = jan4.getDay() || 7 // Mon=1..Sun=7
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7)
  const monthName = monday.toLocaleDateString('en-US', { month: 'short' })
  return 'Week of ' + monthName + ' ' + monday.getDate()
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// --- Permission helpers ---

export function canInvite(role: string | null): boolean {
  return role === 'coordinator'
}

export function canLogSymptoms(role: string | null): boolean {
  return role === 'coordinator' || role === 'caregiver'
}

export function canLogExpense(role: string | null): boolean {
  return role === 'coordinator' || role === 'caregiver'
}

export function canUploadDocument(role: string | null): boolean {
  return role === 'coordinator'
}

export function canDeleteExpense(role: string | null): boolean {
  return role === 'coordinator'
}
```

### Step 4: Run tests to verify they pass

- [ ] Run: `cd apps/mobile && pnpm test -- wave5Utils`
- Expected: 24 tests PASS

### Step 5: Commit

- [ ] ```bash
git add apps/mobile/utils/wave5Utils.ts apps/mobile/__tests__/wave5Utils.test.ts
git commit -m "feat(mobile): add wave5Utils — formatters, permission helpers, constants"
```

---

## Task 2: Tab layout + More hub screen

**Files:**
- Modify: `apps/mobile/app/(app)/_layout.tsx`
- Create: `apps/mobile/app/(app)/team/index.tsx` (placeholder)
- Create: `apps/mobile/app/(app)/more/index.tsx`

**Depends on:** Task 1 (imports from `wave5Utils.ts`)

### Step 1: Create More hub screen

- [ ] Create `apps/mobile/app/(app)/more/index.tsx`:

```tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'

const ITEMS = [
  { title: 'Symptoms', route: '/symptoms' as const, icon: '🩺' },
  { title: 'Burnout', route: '/burnout' as const, icon: '🔋' },
  { title: 'Expenses', route: '/expenses' as const, icon: '💰' },
  { title: 'Documents', route: '/documents' as const, icon: '📄' },
]

export default function MoreScreen() {
  const router = useRouter()

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>More</Text>
      <View style={styles.grid}>
        {ITEMS.map((item) => (
          <TouchableOpacity
            key={item.route}
            style={styles.card}
            onPress={() => router.push(item.route)}
            accessibilityRole="button"
            accessibilityLabel={item.title}
          >
            <Text style={styles.icon}>{item.icon}</Text>
            <Text style={styles.label}>{item.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  heading: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47%',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  icon: { fontSize: 28 },
  label: { fontSize: 15, fontWeight: '600', color: '#111827' },
})
```

### Step 2: Create Team screen placeholder

- [ ] Create `apps/mobile/app/(app)/team/index.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native'

export default function TeamScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Team — loading…</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  text: { color: '#9ca3af', fontSize: 15 },
})
```

### Step 3: Update tab layout

- [ ] Modify `apps/mobile/app/(app)/_layout.tsx` to add Team + More tabs, and hide routes for sub-screens:

```tsx
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
      <Tabs.Screen name="journal/[eventId]" options={{ href: null }} />
      <Tabs.Screen name="medications/index" options={{ title: 'Medications' }} />
      <Tabs.Screen name="schedule/index" options={{ title: 'Schedule' }} />
      <Tabs.Screen name="team/index" options={{ title: 'Team' }} />
      <Tabs.Screen name="more/index" options={{ title: 'More' }} />
      <Tabs.Screen name="invite/[token]" options={{ href: null }} />
      <Tabs.Screen name="settings/index" options={{ title: 'Settings' }} />
      {/* Sub-screens accessible via router.push, hidden from tabs */}
      <Tabs.Screen name="symptoms/index" options={{ href: null }} />
      <Tabs.Screen name="symptoms/log" options={{ href: null }} />
      <Tabs.Screen name="burnout/index" options={{ href: null }} />
      <Tabs.Screen name="burnout/checkin" options={{ href: null }} />
      <Tabs.Screen name="burnout/summary" options={{ href: null }} />
      <Tabs.Screen name="expenses/index" options={{ href: null }} />
      <Tabs.Screen name="expenses/add" options={{ href: null }} />
      <Tabs.Screen name="documents/index" options={{ href: null }} />
    </Tabs>
  )
}
```

### Step 4: Verify app compiles

- [ ] Run: `cd apps/mobile && npx expo export --platform ios --no-minify 2>&1 | tail -5`
- Expected: No errors (or run `npx tsc --noEmit` if tsconfig is set up)

### Step 5: Commit

- [ ] ```bash
git add apps/mobile/app/\(app\)/_layout.tsx apps/mobile/app/\(app\)/more/index.tsx apps/mobile/app/\(app\)/team/index.tsx
git commit -m "feat(mobile): add Team + More tabs with hub screen"
```

---

## Task 3: Team screen — member list + invite

**Files:**
- Modify: `apps/mobile/app/(app)/team/index.tsx` (replace placeholder)

**Depends on:** Task 2 (tab layout), Task 1 (canInvite)

### Step 1: Implement Team screen

- [ ] Replace `apps/mobile/app/(app)/team/index.tsx` with:

```tsx
import { useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { trpc } from '../../../utils/trpc'
import { useApp } from '../../../context/AppContext'
import { canInvite } from '../../../utils/wave5Utils'

const ROLES = ['coordinator', 'caregiver', 'aide', 'supporter'] as const

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  coordinator: { bg: '#ede9fe', text: '#5b21b6' },
  caregiver:   { bg: '#dbeafe', text: '#1e40af' },
  aide:        { bg: '#fef3c7', text: '#92400e' },
  supporter:   { bg: '#f3f4f6', text: '#374151' },
}

export default function TeamScreen() {
  const { orgId, recipientId, currentRole } = useApp()
  const [showInvite, setShowInvite] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<(typeof ROLES)[number]>('caregiver')
  const [sending, setSending] = useState(false)

  const { data: members, isLoading, refetch } = trpc.memberships.list.useQuery(
    { orgId: orgId ?? '' },
    { enabled: !!orgId },
  )

  const inviteMut = trpc.memberships.invite.useMutation({
    onSuccess: () => {
      setShowInvite(false)
      setEmail('')
      setRole('caregiver')
      refetch()
      Alert.alert('Invite sent')
    },
    onError: (err) => {
      Alert.alert('Error', err.message)
    },
  })

  async function handleInvite() {
    if (!email.trim() || !orgId) return
    setSending(true)
    try {
      await inviteMut.mutateAsync({
        orgId,
        recipientId: recipientId ?? null,
        role,
        email: email.trim(),
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#0369a1" />
      ) : (
        <FlatList
          data={members ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const colors = ROLE_COLORS[item.role] ?? ROLE_COLORS.supporter
            return (
              <View style={styles.row}>
                <View style={styles.info}>
                  <Text style={styles.name}>
                    {item.display_name ?? item.email ?? 'Team member'}
                  </Text>
                  {item.email && (
                    <Text style={styles.email}>{item.email}</Text>
                  )}
                </View>
                <View style={[styles.badge, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.badgeText, { color: colors.text }]}>
                    {item.role}
                  </Text>
                </View>
              </View>
            )
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>No team members yet.</Text>
          }
        />
      )}

      {canInvite(currentRole) && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowInvite(true)}
          accessibilityRole="button"
          accessibilityLabel="Invite team member"
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      <Modal visible={showInvite} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Invite team member</Text>
            <TextInput
              style={styles.input}
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.roleRow}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChip, role === r && styles.roleChipActive]}
                  onPress={() => setRole(r)}
                  accessibilityRole="button"
                  accessibilityLabel={r + ' role'}
                >
                  <Text
                    style={[
                      styles.roleChipText,
                      role === r && styles.roleChipTextActive,
                    ]}
                  >
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.sendBtn, (!email.trim() || sending) && styles.sendDisabled]}
              onPress={handleInvite}
              disabled={!email.trim() || sending}
              accessibilityRole="button"
              accessibilityLabel={sending ? 'Sending invite' : 'Send invite'}
            >
              <Text style={styles.sendText}>
                {sending ? 'Sending…' : 'Send invite'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setShowInvite(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loader: { marginTop: 48 },
  list: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  info: { flex: 1, marginRight: 12 },
  name: { fontSize: 15, fontWeight: '600', color: '#111827' },
  email: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '500' },
  empty: { color: '#9ca3af', textAlign: 'center', marginTop: 48 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0369a1',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 30 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  roleRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  roleChipActive: { borderColor: '#0369a1', backgroundColor: '#eff6ff' },
  roleChipText: { fontSize: 13, color: '#374151' },
  roleChipTextActive: { color: '#0369a1', fontWeight: '600' },
  sendBtn: {
    backgroundColor: '#0369a1',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  cancelBtn: { alignItems: 'center', padding: 10 },
  cancelText: { color: '#6b7280', fontSize: 15 },
})
```

### Step 2: Verify app compiles

- [ ] Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | tail -10` (or `npx expo export --platform ios --no-minify`)
- Expected: No type errors

### Step 3: Commit

- [ ] ```bash
git add apps/mobile/app/\(app\)/team/index.tsx
git commit -m "feat(mobile): team screen — member list + coordinator invite"
```

---

## Task 4: Symptom tracker — history + wizard

**Files:**
- Create: `apps/mobile/app/(app)/symptoms/index.tsx`
- Create: `apps/mobile/app/(app)/symptoms/log.tsx`

**Depends on:** Task 2 (layout routes), Task 1 (APPETITE_OPTIONS, MOBILITY_OPTIONS, canLogSymptoms)

### Step 1: Create symptom history screen

- [ ] Create `apps/mobile/app/(app)/symptoms/index.tsx`:

```tsx
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { trpc } from '../../../utils/trpc'
import { useApp } from '../../../context/AppContext'
import { canLogSymptoms } from '../../../utils/wave5Utils'
import { MOOD_COLORS, type Mood } from '../../../utils/journalUtils'

export default function SymptomsScreen() {
  const router = useRouter()
  const { orgId, recipientId, currentRole } = useApp()

  const { data, isLoading } = trpc.symptoms.list.useQuery(
    { org_id: orgId ?? '', recipient_id: recipientId ?? '' },
    { enabled: !!orgId && !!recipientId },
  )

  function formatDate(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <View style={styles.container}>
      {canLogSymptoms(currentRole) && (
        <TouchableOpacity
          style={styles.logBtn}
          onPress={() => router.push('/symptoms/log')}
          accessibilityRole="button"
          accessibilityLabel="Log symptoms"
        >
          <Text style={styles.logBtnText}>Log symptoms</Text>
        </TouchableOpacity>
      )}

      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#0369a1" />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const moodColor = item.mood ? MOOD_COLORS[item.mood as Mood] : null
            return (
              <View style={styles.row}>
                <Text style={styles.date}>{formatDate(item.recorded_at)}</Text>
                <View style={styles.metrics}>
                  {item.pain_level != null && (
                    <Text style={styles.metric}>Pain: {item.pain_level}/10</Text>
                  )}
                  {item.mood && moodColor && (
                    <View style={[styles.moodBadge, { backgroundColor: moodColor.bg }]}>
                      <Text style={[styles.moodText, { color: moodColor.text }]}>
                        {item.mood}
                      </Text>
                    </View>
                  )}
                  {item.appetite && (
                    <Text style={styles.metric}>Appetite: {item.appetite}</Text>
                  )}
                  {item.mobility && (
                    <Text style={styles.metric}>Mobility: {item.mobility}</Text>
                  )}
                </View>
                {item.notes && (
                  <Text style={styles.notes} numberOfLines={2}>{item.notes}</Text>
                )}
              </View>
            )
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>No symptom readings yet.</Text>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  logBtn: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#0369a1',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  logBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  loader: { marginTop: 48 },
  list: { padding: 16 },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  date: { fontSize: 12, color: '#9ca3af', marginBottom: 4 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  metric: { fontSize: 13, color: '#374151' },
  moodBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  moodText: { fontSize: 11, fontWeight: '500' },
  notes: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  empty: { color: '#9ca3af', textAlign: 'center', marginTop: 48 },
})
```

### Step 2: Create symptom wizard screen

- [ ] Create `apps/mobile/app/(app)/symptoms/log.tsx`:

```tsx
import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { trpc } from '../../../utils/trpc'
import { useApp } from '../../../context/AppContext'
import { APPETITE_OPTIONS, MOBILITY_OPTIONS, type Appetite, type Mobility } from '../../../utils/wave5Utils'
import { MOOD_COLORS, type Mood } from '../../../utils/journalUtils'

const MOODS: Mood[] = ['good', 'okay', 'difficult', 'crisis']

export default function SymptomLogScreen() {
  const router = useRouter()
  const { orgId, recipientId } = useApp()
  const [step, setStep] = useState(0)
  const [pain, setPain] = useState<number | null>(null)
  const [mood, setMood] = useState<Mood | null>(null)
  const [appetite, setAppetite] = useState<Appetite | null>(null)
  const [mobility, setMobility] = useState<Mobility | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const logMut = trpc.symptoms.log.useMutation({
    onSuccess: () => router.back(),
    onError: (err) => Alert.alert('Error', err.message),
  })

  async function handleSubmit() {
    if (!orgId || !recipientId) return
    setSubmitting(true)
    try {
      await logMut.mutateAsync({
        org_id: orgId,
        recipient_id: recipientId,
        pain_level: pain ?? undefined,
        mood: mood ?? undefined,
        appetite: appetite ?? undefined,
        mobility: mobility ?? undefined,
        notes: notes.trim() || undefined,
      })
    } finally {
      setSubmitting(false)
    }
  }

  function goBack() {
    if (step === 0) router.back()
    else setStep(step - 1)
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={goBack}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel={step === 0 ? 'Cancel' : 'Previous step'}
      >
        <Text style={styles.backText}>← {step === 0 ? 'Cancel' : 'Back'}</Text>
      </TouchableOpacity>

      <Text style={styles.stepLabel}>Step {step + 1} of 4</Text>

      {step === 0 && (
        <View style={styles.stepContent}>
          <Text style={styles.question}>Pain level (0-10)</Text>
          <View style={styles.numberRow}>
            {Array.from({ length: 11 }, (_, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.numberBtn, pain === i && styles.numberActive]}
                onPress={() => { setPain(i); setStep(1) }}
                accessibilityRole="button"
                accessibilityLabel={'Pain level ' + i}
              >
                <Text style={[styles.numberText, pain === i && styles.numberTextActive]}>
                  {i}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => setStep(1)}
            accessibilityRole="button"
            accessibilityLabel="Skip pain level"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 1 && (
        <View style={styles.stepContent}>
          <Text style={styles.question}>How are they feeling?</Text>
          <View style={styles.optionRow}>
            {MOODS.map((m) => {
              const colors = MOOD_COLORS[m]
              const active = mood === m
              return (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.optionBtn,
                    { borderColor: active ? colors.text : '#e5e7eb' },
                    active && { backgroundColor: colors.bg },
                  ]}
                  onPress={() => { setMood(m); setStep(2) }}
                  accessibilityRole="button"
                  accessibilityLabel={m + ' mood'}
                >
                  <Text style={[styles.optionText, active && { color: colors.text }]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => setStep(2)}
            accessibilityRole="button"
            accessibilityLabel="Skip mood"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 2 && (
        <ScrollView style={styles.stepContent}>
          <Text style={styles.question}>Appetite</Text>
          <View style={styles.optionRow}>
            {APPETITE_OPTIONS.map((o) => (
              <TouchableOpacity
                key={o.key}
                style={[styles.optionBtn, appetite === o.key && styles.optionActive]}
                onPress={() => setAppetite(o.key)}
                accessibilityRole="button"
                accessibilityLabel={o.label + ' appetite'}
              >
                <Text style={[styles.optionText, appetite === o.key && styles.optionTextActive]}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.question, { marginTop: 24 }]}>Mobility</Text>
          <View style={styles.optionRow}>
            {MOBILITY_OPTIONS.map((o) => (
              <TouchableOpacity
                key={o.key}
                style={[styles.optionBtn, mobility === o.key && styles.optionActive]}
                onPress={() => setMobility(o.key)}
                accessibilityRole="button"
                accessibilityLabel={o.label + ' mobility'}
              >
                <Text style={[styles.optionText, mobility === o.key && styles.optionTextActive]}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.nextBtn, { marginTop: 24 }]}
            onPress={() => setStep(3)}
            accessibilityRole="button"
            accessibilityLabel="Next step"
          >
            <Text style={styles.nextText}>Next</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {step === 3 && (
        <View style={styles.stepContent}>
          <Text style={styles.question}>Notes (optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Any additional observations…"
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel={submitting ? 'Saving' : 'Save symptoms'}
          >
            <Text style={styles.submitText}>
              {submitting ? 'Saving…' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  backBtn: { padding: 16, paddingBottom: 0 },
  backText: { fontSize: 15, color: '#0369a1' },
  stepLabel: { paddingHorizontal: 16, paddingTop: 8, fontSize: 12, color: '#9ca3af' },
  stepContent: { padding: 16, flex: 1 },
  question: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 20 },
  numberRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  numberBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberActive: { borderColor: '#0369a1', backgroundColor: '#eff6ff' },
  numberText: { fontSize: 16, color: '#374151' },
  numberTextActive: { color: '#0369a1', fontWeight: '700' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  optionActive: { borderColor: '#0369a1', backgroundColor: '#eff6ff' },
  optionText: { fontSize: 15, color: '#374151' },
  optionTextActive: { color: '#0369a1', fontWeight: '600' },
  skipBtn: { marginTop: 20, alignSelf: 'flex-start' },
  skipText: { fontSize: 14, color: '#9ca3af' },
  nextBtn: {
    backgroundColor: '#0369a1',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  nextText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  notesInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  submitBtn: {
    backgroundColor: '#0369a1',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 15 },
})
```

### Step 3: Verify app compiles

- [ ] Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | tail -10`
- Expected: No type errors

### Step 4: Commit

- [ ] ```bash
git add apps/mobile/app/\(app\)/symptoms/
git commit -m "feat(mobile): symptom tracker — history list + 4-step wizard"
```

---

## Task 5: Burnout check-in — history + wizard + summary

**Files:**
- Create: `apps/mobile/app/(app)/burnout/index.tsx`
- Create: `apps/mobile/app/(app)/burnout/checkin.tsx`
- Create: `apps/mobile/app/(app)/burnout/summary.tsx`

**Depends on:** Task 2 (layout routes), Task 1 (formatWeekStamp)

### Step 1: Create burnout history screen

- [ ] Create `apps/mobile/app/(app)/burnout/index.tsx`:

```tsx
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { trpc } from '../../../utils/trpc'
import { useApp } from '../../../context/AppContext'
import { formatWeekStamp } from '../../../utils/wave5Utils'

function currentWeekStamp(): string {
  const d = new Date()
  const jan4 = new Date(d.getFullYear(), 0, 4)
  const dayOfYear = Math.ceil(
    (d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000,
  )
  const dayOfWeek = d.getDay() || 7
  const weekNum = Math.ceil((dayOfYear + (jan4.getDay() || 7) - 1) / 7)
  const padded = String(weekNum).padStart(2, '0')
  return d.getFullYear() + '-W' + padded
}

export default function BurnoutScreen() {
  const router = useRouter()
  const { orgId, currentRole } = useApp()

  const { data, isLoading } = trpc.burnout.myHistory.useQuery(
    { org_id: orgId ?? '' },
    { enabled: !!orgId },
  )

  const thisWeek = currentWeekStamp()
  const alreadyCheckedIn = (data ?? []).some((c) => c.week_stamp === thisWeek)

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.checkinBtn, alreadyCheckedIn && styles.checkinDisabled]}
        onPress={() => router.push('/burnout/checkin')}
        disabled={alreadyCheckedIn}
        accessibilityRole="button"
        accessibilityLabel={
          alreadyCheckedIn ? 'Already checked in this week' : 'Check in this week'
        }
      >
        <Text style={styles.checkinText}>
          {alreadyCheckedIn ? 'Checked in this week ✓' : 'Check in this week'}
        </Text>
      </TouchableOpacity>

      {currentRole === 'coordinator' && (
        <TouchableOpacity
          style={styles.summaryBtn}
          onPress={() => router.push('/burnout/summary')}
          accessibilityRole="button"
          accessibilityLabel="Team summary"
        >
          <Text style={styles.summaryBtnText}>Team summary</Text>
        </TouchableOpacity>
      )}

      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#0369a1" />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.week}>{formatWeekStamp(item.week_stamp)}</Text>
              <View style={styles.scores}>
                <Text style={styles.score}>Sleep: {item.sleep_score}/5</Text>
                <Text style={styles.score}>Stress: {item.stress_score}/5</Text>
                <Text style={styles.score}>Support: {item.support_score}/5</Text>
              </View>
              {item.notes && (
                <Text style={styles.notes} numberOfLines={1}>{item.notes}</Text>
              )}
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No check-ins yet. How are you doing?</Text>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  checkinBtn: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#0369a1',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  checkinDisabled: { backgroundColor: '#d1d5db' },
  checkinText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  summaryBtn: {
    marginHorizontal: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#0369a1',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  summaryBtnText: { color: '#0369a1', fontWeight: '600', fontSize: 14 },
  loader: { marginTop: 48 },
  list: { padding: 16 },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  week: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 4 },
  scores: { flexDirection: 'row', gap: 12 },
  score: { fontSize: 13, color: '#374151' },
  notes: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  empty: { color: '#9ca3af', textAlign: 'center', marginTop: 48 },
})
```

### Step 2: Create burnout wizard screen

- [ ] Create `apps/mobile/app/(app)/burnout/checkin.tsx`:

```tsx
import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { trpc } from '../../../utils/trpc'
import { useApp } from '../../../context/AppContext'
import { getSession } from '../../../utils/auth'

const QUESTIONS = [
  "How's your sleep?",
  "How's your stress?",
  'Do you feel supported?',
]

function currentWeekStamp(): string {
  const d = new Date()
  const jan4 = new Date(d.getFullYear(), 0, 4)
  const dayOfYear = Math.ceil(
    (d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000,
  )
  const weekNum = Math.ceil((dayOfYear + (jan4.getDay() || 7) - 1) / 7)
  const padded = String(weekNum).padStart(2, '0')
  return d.getFullYear() + '-W' + padded
}

export default function BurnoutCheckinScreen() {
  const router = useRouter()
  const { orgId } = useApp()
  const [step, setStep] = useState(0)
  const [scores, setScores] = useState<(number | null)[]>([null, null, null])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const checkInMut = trpc.burnout.checkIn.useMutation({
    onSuccess: () => router.back(),
    onError: (err) => Alert.alert('Error', err.message),
  })

  function selectScore(value: number) {
    const next = [...scores]
    next[step] = value
    setScores(next)
    if (step < 2) setStep(step + 1)
    else setStep(3)
  }

  async function handleSubmit() {
    if (!orgId) return
    const session = await getSession()
    if (!session) return
    setSubmitting(true)
    try {
      await checkInMut.mutateAsync({
        org_id: orgId,
        user_id: session.user.id,
        sleep_score: scores[0] ?? 3,
        stress_score: scores[1] ?? 3,
        support_score: scores[2] ?? 3,
        notes: notes.trim() || undefined,
        week_stamp: currentWeekStamp(),
      })
    } finally {
      setSubmitting(false)
    }
  }

  function goBack() {
    if (step === 0) router.back()
    else setStep(step - 1)
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={goBack}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel={step === 0 ? 'Cancel' : 'Previous step'}
      >
        <Text style={styles.backText}>← {step === 0 ? 'Cancel' : 'Back'}</Text>
      </TouchableOpacity>

      <Text style={styles.stepLabel}>Step {Math.min(step + 1, 4)} of 4</Text>

      {step < 3 && (
        <View style={styles.stepContent}>
          <Text style={styles.question}>{QUESTIONS[step]}</Text>
          <View style={styles.scaleRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity
                key={n}
                style={[
                  styles.scaleBtn,
                  scores[step] === n && styles.scaleActive,
                ]}
                onPress={() => selectScore(n)}
                accessibilityRole="button"
                accessibilityLabel={'Score ' + n + ' of 5'}
              >
                <Text
                  style={[
                    styles.scaleText,
                    scores[step] === n && styles.scaleTextActive,
                  ]}
                >
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.scaleLabels}>
            <Text style={styles.scaleLabelText}>Struggling</Text>
            <Text style={styles.scaleLabelText}>Great</Text>
          </View>
        </View>
      )}

      {step === 3 && (
        <View style={styles.stepContent}>
          <Text style={styles.question}>Anything else? (optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="How you're really doing…"
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel={submitting ? 'Saving' : 'Submit check-in'}
          >
            <Text style={styles.submitText}>
              {submitting ? 'Saving…' : 'Submit'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  backBtn: { padding: 16, paddingBottom: 0 },
  backText: { fontSize: 15, color: '#0369a1' },
  stepLabel: { paddingHorizontal: 16, paddingTop: 8, fontSize: 12, color: '#9ca3af' },
  stepContent: { padding: 16, flex: 1 },
  question: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 32 },
  scaleRow: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  scaleBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scaleActive: { borderColor: '#0369a1', backgroundColor: '#eff6ff' },
  scaleText: { fontSize: 20, color: '#374151', fontWeight: '600' },
  scaleTextActive: { color: '#0369a1' },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  scaleLabelText: { fontSize: 12, color: '#9ca3af' },
  notesInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  submitBtn: {
    backgroundColor: '#0369a1',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 15 },
})
```

### Step 3: Create burnout summary screen

- [ ] Create `apps/mobile/app/(app)/burnout/summary.tsx`:

```tsx
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native'
import { useRouter } from 'expo-router'
import { trpc } from '../../../utils/trpc'
import { useApp } from '../../../context/AppContext'
import { formatWeekStamp } from '../../../utils/wave5Utils'

export default function BurnoutSummaryScreen() {
  const router = useRouter()
  const { orgId } = useApp()

  const { data, isLoading } = trpc.burnout.orgSummary.useQuery(
    { org_id: orgId ?? '' },
    { enabled: !!orgId },
  )

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.heading}>Team burnout summary</Text>
      <Text style={styles.subtext}>
        Averages shown only for weeks with 3+ responses.
      </Text>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#0369a1" />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.week_stamp}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.week}>{formatWeekStamp(item.week_stamp)}</Text>
              <View style={styles.scores}>
                <View style={styles.scoreCol}>
                  <Text style={styles.scoreLabel}>Sleep</Text>
                  <Text style={styles.scoreValue}>{item.avg_sleep.toFixed(1)}</Text>
                </View>
                <View style={styles.scoreCol}>
                  <Text style={styles.scoreLabel}>Stress</Text>
                  <Text style={styles.scoreValue}>{item.avg_stress.toFixed(1)}</Text>
                </View>
                <View style={styles.scoreCol}>
                  <Text style={styles.scoreLabel}>Support</Text>
                  <Text style={styles.scoreValue}>{item.avg_support.toFixed(1)}</Text>
                </View>
              </View>
              <Text style={styles.count}>{item.count} responses</Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              Not enough responses yet. Need 3+ per week.
            </Text>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  backBtn: { padding: 16, paddingBottom: 0 },
  backText: { fontSize: 15, color: '#0369a1' },
  heading: { fontSize: 20, fontWeight: '700', color: '#111827', paddingHorizontal: 16, paddingTop: 12 },
  subtext: { fontSize: 13, color: '#9ca3af', paddingHorizontal: 16, marginTop: 4 },
  loader: { marginTop: 48 },
  list: { padding: 16 },
  row: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  week: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 6 },
  scores: { flexDirection: 'row', gap: 20 },
  scoreCol: { alignItems: 'center' },
  scoreLabel: { fontSize: 11, color: '#9ca3af', marginBottom: 2 },
  scoreValue: { fontSize: 18, fontWeight: '700', color: '#111827' },
  count: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  empty: { color: '#9ca3af', textAlign: 'center', marginTop: 48 },
})
```

### Step 4: Verify app compiles

- [ ] Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | tail -10`
- Expected: No type errors

### Step 5: Commit

- [ ] ```bash
git add apps/mobile/app/\(app\)/burnout/
git commit -m "feat(mobile): burnout check-in — history, 4-step wizard, coordinator summary"
```

---

## Task 6: Expense log — list + add

**Files:**
- Create: `apps/mobile/app/(app)/expenses/index.tsx`
- Create: `apps/mobile/app/(app)/expenses/add.tsx`

**Depends on:** Task 2 (layout routes), Task 1 (EXPENSE_CATEGORIES, formatCurrency, canLogExpense, canDeleteExpense)

### Step 1: Create expense list screen

- [ ] Create `apps/mobile/app/(app)/expenses/index.tsx`:

```tsx
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { trpc } from '../../../utils/trpc'
import { useApp } from '../../../context/AppContext'
import { formatCurrency, canLogExpense, canDeleteExpense } from '../../../utils/wave5Utils'

type Expense = {
  id: string
  amount: number
  category: string
  description: string
  incurred_at: string
}

function groupByMonth(expenses: Expense[]): { title: string; data: Expense[] }[] {
  const groups = new Map<string, Expense[]>()
  for (const e of expenses) {
    const d = new Date(e.incurred_at)
    const key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const arr = groups.get(key) ?? []
    arr.push(e)
    groups.set(key, arr)
  }
  return Array.from(groups, ([title, data]) => ({ title, data }))
}

const CATEGORY_LABELS: Record<string, string> = {
  medication: 'Medication',
  supplies: 'Supplies',
  equipment: 'Equipment',
  home_modification: 'Home mod',
  aide_hours: 'Aide hours',
  transport: 'Transport',
  food: 'Food',
  other: 'Other',
}

export default function ExpensesScreen() {
  const router = useRouter()
  const { orgId, recipientId, currentRole } = useApp()

  const { data, isLoading, refetch } = trpc.expenses.list.useQuery(
    { org_id: orgId ?? '', recipient_id: recipientId ?? '' },
    { enabled: !!orgId && !!recipientId },
  )

  const deleteMut = trpc.expenses.delete.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => Alert.alert('Error', err.message),
  })

  function confirmDelete(id: string) {
    Alert.alert('Delete expense?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMut.mutate({ id, org_id: orgId ?? '' }),
      },
    ])
  }

  const sections = groupByMonth((data as Expense[]) ?? [])

  return (
    <View style={styles.container}>
      {canLogExpense(currentRole) && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/expenses/add')}
          accessibilityRole="button"
          accessibilityLabel="Add expense"
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#0369a1" />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onLongPress={
                canDeleteExpense(currentRole)
                  ? () => confirmDelete(item.id)
                  : undefined
              }
              activeOpacity={canDeleteExpense(currentRole) ? 0.6 : 1}
              accessibilityRole="button"
              accessibilityLabel={
                formatCurrency(item.amount) + ' ' + item.description +
                (canDeleteExpense(currentRole) ? ', long press to delete' : '')
              }
            >
              <View style={styles.rowLeft}>
                <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
                <View style={styles.catBadge}>
                  <Text style={styles.catText}>
                    {CATEGORY_LABELS[item.category] ?? item.category}
                  </Text>
                </View>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.desc} numberOfLines={1}>{item.description}</Text>
                <Text style={styles.date}>
                  {new Date(item.incurred_at).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No expenses logged yet.</Text>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loader: { marginTop: 48 },
  list: { padding: 16, paddingBottom: 80 },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7280',
    marginTop: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amount: { fontSize: 16, fontWeight: '700', color: '#111827' },
  catBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  catText: { fontSize: 11, color: '#374151' },
  rowRight: { alignItems: 'flex-end', flex: 1, marginLeft: 12 },
  desc: { fontSize: 13, color: '#374151' },
  date: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  empty: { color: '#9ca3af', textAlign: 'center', marginTop: 48 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0369a1',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 10,
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 30 },
})
```

### Step 2: Create expense add screen

- [ ] Create `apps/mobile/app/(app)/expenses/add.tsx`:

```tsx
import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useRouter } from 'expo-router'
import { trpc } from '../../../utils/trpc'
import { useApp } from '../../../context/AppContext'
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '../../../utils/wave5Utils'

export default function ExpenseAddScreen() {
  const router = useRouter()
  const { orgId, recipientId } = useApp()
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('medication')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const createMut = trpc.expenses.create.useMutation({
    onSuccess: () => router.back(),
    onError: (err) => Alert.alert('Error', err.message),
  })

  const numericAmount = parseFloat(amount.replace(/[^0-9.]/g, ''))
  const valid = !isNaN(numericAmount) && numericAmount > 0 && description.trim()

  async function handleSubmit() {
    if (!valid || !orgId || !recipientId) return
    setSubmitting(true)
    try {
      await createMut.mutateAsync({
        org_id: orgId,
        recipient_id: recipientId,
        amount: numericAmount,
        category,
        description: description.trim(),
        incurred_at: date.toISOString().split('T')[0],
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
      >
        <Text style={styles.backText}>← Cancel</Text>
      </TouchableOpacity>

      <Text style={styles.heading}>Log expense</Text>

      <Text style={styles.label}>Amount</Text>
      <TextInput
        style={styles.amountInput}
        placeholder="$0.00"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>Category</Text>
      <View style={styles.chipRow}>
        {EXPENSE_CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c.key}
            style={[styles.chip, category === c.key && styles.chipActive]}
            onPress={() => setCategory(c.key)}
            accessibilityRole="button"
            accessibilityLabel={c.label + ' category'}
          >
            <Text style={[styles.chipText, category === c.key && styles.chipTextActive]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={styles.input}
        placeholder="What was this for?"
        value={description}
        onChangeText={setDescription}
        maxLength={200}
      />

      <Text style={styles.label}>Date</Text>
      <TouchableOpacity
        style={styles.dateBtn}
        onPress={() => setShowDatePicker(true)}
        accessibilityRole="button"
        accessibilityLabel="Select date"
      >
        <Text style={styles.dateText}>
          {date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
        </Text>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          maximumDate={new Date()}
          onChange={(_, d) => {
            setShowDatePicker(Platform.OS === 'ios')
            if (d) setDate(d)
          }}
        />
      )}

      <TouchableOpacity
        style={[styles.submitBtn, (!valid || submitting) && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={!valid || submitting}
        accessibilityRole="button"
        accessibilityLabel={submitting ? 'Saving' : 'Save expense'}
      >
        <Text style={styles.submitText}>
          {submitting ? 'Saving…' : 'Save expense'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  backBtn: { marginBottom: 8 },
  backText: { fontSize: 15, color: '#0369a1' },
  heading: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 6, marginTop: 16 },
  amountInput: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipActive: { borderColor: '#0369a1', backgroundColor: '#eff6ff' },
  chipText: { fontSize: 13, color: '#374151' },
  chipTextActive: { color: '#0369a1', fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  dateBtn: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
  },
  dateText: { fontSize: 15, color: '#111827' },
  submitBtn: {
    backgroundColor: '#0369a1',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 15 },
})
```

**Note:** This screen imports `@react-native-community/datetimepicker`. If not already installed:
```bash
cd apps/mobile && npx expo install @react-native-community/datetimepicker
```

### Step 3: Verify app compiles

- [ ] Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | tail -10`
- Expected: No type errors

### Step 4: Commit

- [ ] ```bash
git add apps/mobile/app/\(app\)/expenses/
git commit -m "feat(mobile): expense log — month-grouped list + amount-first add screen"
```

---

## Task 7: Document vault — list + upload

**Files:**
- Create: `apps/mobile/app/(app)/documents/index.tsx`

**Depends on:** Task 2 (layout routes), Task 1 (DOC_TYPES, formatFileSize, canUploadDocument)

**Required packages:**
```bash
cd apps/mobile && npx expo install expo-image-picker expo-document-picker
```

### Step 1: Create document vault screen

- [ ] Create `apps/mobile/app/(app)/documents/index.tsx`:

```tsx
import { useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  ActionSheetIOS,
  Platform,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { useRouter } from 'expo-router'
import { trpc } from '../../../utils/trpc'
import { useApp } from '../../../context/AppContext'
import { getSession } from '../../../utils/auth'
import { DOC_TYPES, formatFileSize, canUploadDocument, type DocType } from '../../../utils/wave5Utils'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

const DOC_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  DOC_TYPES.map((d) => [d.key, d.label]),
)

export default function DocumentsScreen() {
  const router = useRouter()
  const { orgId, recipientId, currentRole } = useApp()
  const [uploading, setUploading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [pickedFile, setPickedFile] = useState<{
    uri: string
    name: string
    mimeType: string
  } | null>(null)
  const [docType, setDocType] = useState<DocType>('other')

  const { data, isLoading, refetch } = trpc.documents.list.useQuery(
    { org_id: orgId ?? '', recipient_id: recipientId ?? '' },
    { enabled: !!orgId && !!recipientId },
  )

  const deleteMut = trpc.documents.delete.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => Alert.alert('Error', err.message),
  })

  function confirmDelete(id: string) {
    Alert.alert('Delete document?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMut.mutate({ id, org_id: orgId ?? '' }),
      },
    ])
  }

  async function handleView(id: string) {
    const session = await getSession()
    if (!session) return
    try {
      const res = await fetch(API_URL + '/api/documents/' + id + '/download', {
        headers: { authorization: 'Bearer ' + session.access_token },
        redirect: 'manual',
      })
      const location = res.headers.get('location')
      if (location) {
        await Linking.openURL(location)
      } else {
        Alert.alert('Error', 'Could not get download URL')
      }
    } catch {
      Alert.alert('Error', 'Failed to open document')
    }
  }

  function showPickerOptions() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take photo', 'Choose file'],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) pickFromCamera()
          else if (idx === 2) pickFromFiles()
        },
      )
    } else {
      Alert.alert('Upload document', '', [
        { text: 'Take photo', onPress: pickFromCamera },
        { text: 'Choose file', onPress: pickFromFiles },
        { text: 'Cancel', style: 'cancel' },
      ])
    }
  }

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Camera permission required')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      setPickedFile({
        uri: asset.uri,
        name: asset.fileName ?? 'photo.jpg',
        mimeType: asset.mimeType ?? 'image/jpeg',
      })
      setShowUploadModal(true)
    }
  }

  async function pickFromFiles() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'],
    })
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      setPickedFile({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? 'application/pdf',
      })
      setShowUploadModal(true)
    }
  }

  async function handleUpload() {
    if (!pickedFile || !orgId || !recipientId) return
    const session = await getSession()
    if (!session) return

    setUploading(true)
    try {
      const form = new FormData()
      form.append('orgId', orgId)
      form.append('recipientId', recipientId)
      form.append('displayName', pickedFile.name)
      form.append('docType', docType)
      form.append('file', {
        uri: pickedFile.uri,
        name: pickedFile.name,
        type: pickedFile.mimeType,
      } as unknown as Blob)

      const res = await fetch(API_URL + '/api/documents/upload', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + session.access_token },
        body: form,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'Upload failed')
      }

      setShowUploadModal(false)
      setPickedFile(null)
      setDocType('other')
      refetch()
      Alert.alert('Document uploaded')
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#0369a1" />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => handleView(item.id)}
              onLongPress={
                canUploadDocument(currentRole)
                  ? () => confirmDelete(item.id)
                  : undefined
              }
              accessibilityRole="button"
              accessibilityLabel={
                item.display_name +
                (canUploadDocument(currentRole) ? ', long press to delete' : '')
              }
            >
              <View style={styles.rowMain}>
                <Text style={styles.docName} numberOfLines={1}>
                  {item.display_name}
                </Text>
                <View style={styles.docTypeBadge}>
                  <Text style={styles.docTypeText}>
                    {DOC_TYPE_LABELS[item.doc_type] ?? item.doc_type}
                  </Text>
                </View>
              </View>
              <View style={styles.rowMeta}>
                <Text style={styles.metaText}>{formatFileSize(item.file_size)}</Text>
                <Text style={styles.metaText}>
                  {new Date(item.created_at).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No documents yet.</Text>
          }
        />
      )}

      {canUploadDocument(currentRole) && (
        <TouchableOpacity
          style={styles.fab}
          onPress={showPickerOptions}
          accessibilityRole="button"
          accessibilityLabel="Upload document"
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      <Modal visible={showUploadModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Upload document</Text>
            {pickedFile && (
              <Text style={styles.fileName} numberOfLines={1}>
                {pickedFile.name}
              </Text>
            )}

            <Text style={styles.fieldLabel}>Document type</Text>
            <View style={styles.chipRow}>
              {DOC_TYPES.map((d) => (
                <TouchableOpacity
                  key={d.key}
                  style={[styles.chip, docType === d.key && styles.chipActive]}
                  onPress={() => setDocType(d.key)}
                  accessibilityRole="button"
                  accessibilityLabel={d.label + ' document type'}
                >
                  <Text style={[styles.chipText, docType === d.key && styles.chipTextActive]}>
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.uploadBtn, uploading && styles.uploadDisabled]}
              onPress={handleUpload}
              disabled={uploading}
              accessibilityRole="button"
              accessibilityLabel={uploading ? 'Uploading' : 'Upload'}
            >
              <Text style={styles.uploadText}>
                {uploading ? 'Uploading…' : 'Upload'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                setShowUploadModal(false)
                setPickedFile(null)
              }}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loader: { marginTop: 48 },
  list: { padding: 16, paddingBottom: 80 },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  docName: { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1 },
  docTypeBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  docTypeText: { fontSize: 11, color: '#374151' },
  rowMeta: { flexDirection: 'row', gap: 12, marginTop: 4 },
  metaText: { fontSize: 12, color: '#9ca3af' },
  empty: { color: '#9ca3af', textAlign: 'center', marginTop: 48 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0369a1',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 10,
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 30 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  fileName: { fontSize: 14, color: '#6b7280', marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipActive: { borderColor: '#0369a1', backgroundColor: '#eff6ff' },
  chipText: { fontSize: 12, color: '#374151' },
  chipTextActive: { color: '#0369a1', fontWeight: '600' },
  uploadBtn: {
    backgroundColor: '#0369a1',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  uploadDisabled: { opacity: 0.4 },
  uploadText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  cancelBtn: { alignItems: 'center', padding: 10 },
  cancelText: { color: '#6b7280', fontSize: 15 },
})
```

### Step 2: Install required packages

- [ ] Run: `cd apps/mobile && npx expo install expo-image-picker expo-document-picker`

### Step 3: Verify app compiles

- [ ] Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | tail -10`
- Expected: No type errors

### Step 4: Commit

- [ ] ```bash
git add apps/mobile/app/\(app\)/documents/ apps/mobile/package.json
git commit -m "feat(mobile): document vault — list, camera/file upload, tap-to-view"
```

---

## Summary

| Task | Files | What it does |
|------|-------|-------------|
| 1 | `wave5Utils.ts`, `wave5Utils.test.ts` | Shared formatters, permissions, constants (TDD) |
| 2 | `_layout.tsx`, `more/index.tsx`, `team/index.tsx` (placeholder) | Tab bar + More hub |
| 3 | `team/index.tsx` | Member list + coordinator invite modal |
| 4 | `symptoms/index.tsx`, `symptoms/log.tsx` | Symptom history + 4-step wizard |
| 5 | `burnout/index.tsx`, `burnout/checkin.tsx`, `burnout/summary.tsx` | Burnout history + wizard + coordinator summary |
| 6 | `expenses/index.tsx`, `expenses/add.tsx` | Month-grouped expense list + amount-first add |
| 7 | `documents/index.tsx` | Doc list + camera/file upload + tap-to-view |

Total: 13 files (1 modify, 12 create). All within `apps/mobile/`.
