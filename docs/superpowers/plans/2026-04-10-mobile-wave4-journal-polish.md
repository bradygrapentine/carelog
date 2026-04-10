# Mobile Wave 4 — Journal Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline entry expansion, emoji reactions (tRPC), mood badges, and a full-screen detail screen with coordinator-only flagging to the mobile journal.

**Architecture:** Pure logic extracted to `journalUtils.ts` for testability. Timeline entries expand inline on tap (single expanded at a time); an "Open entry →" button navigates to a new Expo Router screen `[eventId].tsx`. Reactions use four new tRPC procedures added to `careEventsRouter` by the web instance. Component render tests are skipped (Expo SDK instability per `apps/mobile/CLAUDE.md`); only pure utilities are unit-tested.

**Tech Stack:** React Native, Expo Router, tRPC React Query, jest-expo (node environment), `@testing-library/react-native` (hooks only)

> ⚠️ **Dependency:** Tasks 2 and 3 call `trpc.careEvents.react`, `trpc.careEvents.unreact`, `trpc.careEvents.reactions`, and `trpc.careEvents.flag`. These procedures must be added to `apps/web/server/routers/careEvents.ts` by the web instance **before** building Tasks 2–3, or TypeScript will error. Coordinate before starting Task 2.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `apps/mobile/utils/journalUtils.ts` | Create | Shared types, formatters, `canFlag` helper |
| `apps/mobile/__tests__/journalUtils.test.ts` | Create | Pure-logic unit tests |
| `apps/mobile/app/(app)/journal/index.tsx` | Modify | Inline expand, mood badge, reactions sub-component |
| `apps/mobile/app/(app)/journal/[eventId].tsx` | Create | Full-screen detail screen |

---

## Task 1: Journal utility helpers

**Files:**
- Create: `apps/mobile/utils/journalUtils.ts`
- Create: `apps/mobile/__tests__/journalUtils.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// apps/mobile/__tests__/journalUtils.test.ts
import { formatEntryTime, formatEntryDateTime, canFlag, MOOD_COLORS, REACTIONS } from '../utils/journalUtils'

describe('formatEntryTime', () => {
  it('returns a time string matching HH:MM format', () => {
    const result = formatEntryTime('2026-04-10T14:30:00.000Z')
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })
})

describe('formatEntryDateTime', () => {
  it('includes "at" separator between date and time', () => {
    const result = formatEntryDateTime('2026-04-10T14:30:00.000Z')
    expect(result).toContain(' at ')
  })

  it('is longer than 10 characters', () => {
    const result = formatEntryDateTime('2026-04-10T14:30:00.000Z')
    expect(result.length).toBeGreaterThan(10)
  })
})

describe('canFlag', () => {
  it('returns true for coordinator', () => {
    expect(canFlag('coordinator')).toBe(true)
  })

  it('returns false for caregiver', () => {
    expect(canFlag('caregiver')).toBe(false)
  })

  it('returns false for supporter', () => {
    expect(canFlag('supporter')).toBe(false)
  })

  it('returns false for aide', () => {
    expect(canFlag('aide')).toBe(false)
  })

  it('returns false for null', () => {
    expect(canFlag(null)).toBe(false)
  })
})

describe('MOOD_COLORS', () => {
  const moods = ['good', 'okay', 'difficult', 'crisis'] as const
  moods.forEach(mood => {
    it(`has bg and text color for "${mood}"`, () => {
      expect(MOOD_COLORS[mood].bg).toBeTruthy()
      expect(MOOD_COLORS[mood].text).toBeTruthy()
    })
  })
})

describe('REACTIONS', () => {
  it('has exactly 4 reactions', () => {
    expect(REACTIONS).toHaveLength(4)
  })

  it('contains heart, thinking_of_you, strong, grateful keys', () => {
    const keys = REACTIONS.map(r => r.key)
    expect(keys).toContain('heart')
    expect(keys).toContain('thinking_of_you')
    expect(keys).toContain('strong')
    expect(keys).toContain('grateful')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/mobile && pnpm test __tests__/journalUtils.test.ts
```

Expected: FAIL — `Cannot find module '../utils/journalUtils'`

- [ ] **Step 3: Create `journalUtils.ts`**

```ts
// apps/mobile/utils/journalUtils.ts

export type Mood = 'good' | 'okay' | 'difficult' | 'crisis'
export type ReactionKey = 'heart' | 'thinking_of_you' | 'strong' | 'grateful'

export const MOOD_COLORS: Record<Mood, { bg: string; text: string }> = {
  good:      { bg: '#f0fdf4', text: '#166534' },
  okay:      { bg: '#fefce8', text: '#854d0e' },
  difficult: { bg: '#fff7ed', text: '#9a3412' },
  crisis:    { bg: '#fef2f2', text: '#991b1b' },
}

export const REACTIONS = [
  { key: 'heart' as const,            emoji: '❤️', label: 'Heart' },
  { key: 'thinking_of_you' as const,  emoji: '🤍', label: 'Thinking of you' },
  { key: 'strong' as const,           emoji: '💪', label: 'Strong' },
  { key: 'grateful' as const,         emoji: '🙏', label: 'Grateful' },
] as const

export function formatEntryTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function formatEntryDateTime(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) +
    ' at ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  )
}

export function canFlag(role: string | null): boolean {
  return role === 'coordinator'
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/mobile && pnpm test __tests__/journalUtils.test.ts
```

Expected: PASS — 12 tests passing

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/utils/journalUtils.ts apps/mobile/__tests__/journalUtils.test.ts
git commit -m "feat(mobile): add journalUtils — formatters, canFlag, mood colors, reactions"
```

---

## Task 2: Timeline inline expansion

> ⚠️ **Requires web instance to have added tRPC procedures first.** Check that `trpc.careEvents.reactions`, `trpc.careEvents.react`, and `trpc.careEvents.unreact` exist in the router before this task.

**Files:**
- Modify: `apps/mobile/app/(app)/journal/index.tsx`

Replace the full contents of `apps/mobile/app/(app)/journal/index.tsx` with:

- [ ] **Step 1: Rewrite `index.tsx`**

```tsx
// apps/mobile/app/(app)/journal/index.tsx
import { useState } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { trpc } from '../../../utils/trpc'
import { useOfflineWrite } from '../../../hooks/useOfflineWrite'
import { useSyncStatus } from '../../../hooks/useSyncStatus'
import { useApp } from '../../../context/AppContext'
import {
  Mood, ReactionKey, MOOD_COLORS, REACTIONS,
  formatEntryTime,
} from '../../../utils/journalUtils'

const MOOD_TAGS = ['good', 'okay', 'difficult', 'crisis'] as const
const INPUT_MOOD_COLORS: Record<Mood, string> = {
  good: '#22c55e', okay: '#f59e0b', difficult: '#ef4444', crisis: '#7f1d1d',
}

// ── Reactions sub-component ────────────────────────────────────────────────
// Only mounted when an entry is expanded — query fires on mount.
function EntryReactions({ eventId }: { eventId: string }) {
  const { data, refetch } = trpc.careEvents.reactions.useQuery({ eventId })
  const reactMut = trpc.careEvents.react.useMutation({ onSuccess: () => refetch() })
  const unreactMut = trpc.careEvents.unreact.useMutation({ onSuccess: () => refetch() })

  const counts = data?.counts ?? {}
  const myReaction = data?.myReaction ?? null

  function toggle(key: ReactionKey) {
    if (myReaction === key) {
      unreactMut.mutate({ eventId })
    } else {
      reactMut.mutate({ eventId, reaction: key })
    }
  }

  return (
    <View style={styles.reactionRow}>
      {REACTIONS.map(r => {
        const count = counts[r.key] ?? 0
        const active = myReaction === r.key
        return (
          <TouchableOpacity
            key={r.key}
            onPress={() => toggle(r.key)}
            style={[styles.reactionBtn, active && styles.reactionActive]}
          >
            <Text style={styles.reactionEmoji}>{r.emoji}</Text>
            {count > 0 && <Text style={styles.reactionCount}>{count}</Text>}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

// ── Main screen ────────────────────────────────────────────────────────────
export default function JournalScreen() {
  const router = useRouter()
  const { orgId, recipientId } = useApp()
  const [text, setText] = useState('')
  const [mood, setMood] = useState<Mood>('okay')
  const [submitting, setSubmitting] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const syncStatus = useSyncStatus()
  const { write } = useOfflineWrite(orgId ?? '')

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
          renderItem={({ item }) => {
            const payload = (item.payload as Record<string, unknown>) ?? {}
            const entryText = (payload['text'] as string) ?? item.event_type
            const entryMood = payload['mood'] as Mood | undefined
            const isExpanded = expandedId === item.id
            const moodColor = entryMood ? MOOD_COLORS[entryMood] : null

            return (
              <TouchableOpacity
                style={styles.entry}
                onPress={() => setExpandedId(isExpanded ? null : item.id)}
                activeOpacity={0.7}
              >
                <View style={styles.entryHeader}>
                  <Text style={styles.entryTime}>{formatEntryTime(item.occurred_at)}</Text>
                  {entryMood && moodColor && (
                    <View style={[styles.moodBadge, { backgroundColor: moodColor.bg }]}>
                      <Text style={[styles.moodText, { color: moodColor.text }]}>{entryMood}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.entryText} numberOfLines={isExpanded ? undefined : 2}>
                  {entryText}
                </Text>
                {isExpanded && (
                  <>
                    <EntryReactions eventId={item.id} />
                    <TouchableOpacity
                      style={styles.openBtn}
                      onPress={() => router.push('/journal/' + item.id)}
                    >
                      <Text style={styles.openBtnText}>Open entry →</Text>
                    </TouchableOpacity>
                  </>
                )}
              </TouchableOpacity>
            )
          }}
          ListEmptyComponent={<Text style={styles.empty}>No entries yet. Add the first one below.</Text>}
        />
      )}

      <View style={styles.form}>
        <View style={styles.moodRow}>
          {MOOD_TAGS.map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.moodTag, mood === m && { backgroundColor: INPUT_MOOD_COLORS[m] }]}
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
  entry: { borderLeftWidth: 2, borderLeftColor: '#e5e7eb', paddingLeft: 12, marginBottom: 16, paddingVertical: 4 },
  entryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  entryTime: { fontSize: 12, color: '#9ca3af' },
  moodBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  moodText: { fontSize: 11, fontWeight: '500' },
  entryText: { fontSize: 15, color: '#111827', lineHeight: 22 },
  reactionRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  reactionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  reactionActive: { borderColor: '#93c5fd', backgroundColor: '#eff6ff' },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 12, color: '#374151', fontWeight: '500' },
  openBtn: { marginTop: 8, alignSelf: 'flex-start' },
  openBtnText: { fontSize: 13, color: '#0369a1', fontWeight: '500' },
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

- [ ] **Step 2: Run TypeScript check**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors. If you see errors on `trpc.careEvents.react` / `.unreact` / `.reactions`, the web instance hasn't added the procedures yet — stop and coordinate.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(app\)/journal/index.tsx
git commit -m "feat(mobile): timeline inline expand — mood badge, reactions, open entry"
```

---

## Task 3: Journal detail screen

> ⚠️ **Requires `trpc.careEvents.flag` to exist in the web router.**

**Files:**
- Create: `apps/mobile/app/(app)/journal/[eventId].tsx`

- [ ] **Step 1: Create `[eventId].tsx`**

```tsx
// apps/mobile/app/(app)/journal/[eventId].tsx
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { trpc } from '../../../utils/trpc'
import { useApp } from '../../../context/AppContext'
import {
  Mood, ReactionKey, MOOD_COLORS, REACTIONS,
  formatEntryDateTime, canFlag,
} from '../../../utils/journalUtils'

export default function JournalDetailScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>()
  const router = useRouter()
  const { currentRole } = useApp()

  const { data: event, isLoading } = trpc.careEvents.getOne.useQuery({ eventId })
  const { data: reactions, refetch: refetchReactions } = trpc.careEvents.reactions.useQuery({ eventId })
  const reactMut    = trpc.careEvents.react.useMutation({ onSuccess: () => refetchReactions() })
  const unreactMut  = trpc.careEvents.unreact.useMutation({ onSuccess: () => refetchReactions() })
  const flagMut     = trpc.careEvents.flag.useMutation()

  const counts     = reactions?.counts ?? {}
  const myReaction = reactions?.myReaction ?? null

  function toggleReaction(key: ReactionKey) {
    if (myReaction === key) {
      unreactMut.mutate({ eventId })
    } else {
      reactMut.mutate({ eventId, reaction: key })
    }
  }

  function toggleFlag() {
    if (!event) return
    flagMut.mutate({ eventId, flagged: !event.flagged })
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0369a1" />
      </View>
    )
  }

  if (!event) return null

  const payload    = (event.payload as Record<string, unknown>) ?? {}
  const entryText  = (payload['text'] as string) ?? ''
  const entryMood  = payload['mood'] as Mood | undefined
  const moodColor  = entryMood ? MOOD_COLORS[entryMood] : null

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.entryText}>{entryText}</Text>

        <View style={styles.meta}>
          {entryMood && moodColor && (
            <View style={[styles.moodBadge, { backgroundColor: moodColor.bg }]}>
              <Text style={[styles.moodText, { color: moodColor.text }]}>{entryMood}</Text>
            </View>
          )}
          <Text style={styles.dateText}>{formatEntryDateTime(event.occurred_at)}</Text>
        </View>

        <View style={styles.reactionRow}>
          {REACTIONS.map(r => {
            const count  = counts[r.key] ?? 0
            const active = myReaction === r.key
            return (
              <TouchableOpacity
                key={r.key}
                onPress={() => toggleReaction(r.key)}
                style={[styles.reactionBtn, active && styles.reactionActive]}
              >
                <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                <Text style={styles.reactionLabel}>{r.label}</Text>
                {count > 0 && <Text style={styles.reactionCount}>{count}</Text>}
              </TouchableOpacity>
            )
          })}
        </View>

        {canFlag(currentRole) && (
          <TouchableOpacity
            onPress={toggleFlag}
            disabled={flagMut.isPending}
            style={[styles.flagBtn, event.flagged && styles.flagActive]}
          >
            <Text style={[styles.flagText, event.flagged && styles.flagActiveText]}>
              {event.flagged ? 'Unflag' : 'Flag for doctor'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f9fafb' },
  content:        { padding: 16 },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backBtn:        { marginBottom: 12 },
  backText:       { fontSize: 14, color: '#0369a1' },
  card:           { backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  entryText:      { fontSize: 16, color: '#111827', lineHeight: 24, marginBottom: 12 },
  meta:           { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  moodBadge:      { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  moodText:       { fontSize: 12, fontWeight: '500' },
  dateText:       { fontSize: 12, color: '#9ca3af' },
  reactionRow:    { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  reactionBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  reactionActive: { borderColor: '#93c5fd', backgroundColor: '#eff6ff' },
  reactionEmoji:  { fontSize: 16 },
  reactionLabel:  { fontSize: 13, color: '#374151' },
  reactionCount:  { fontSize: 12, color: '#374151', fontWeight: '600' },
  flagBtn:        { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, alignItems: 'center' },
  flagActive:     { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  flagText:       { fontSize: 14, color: '#374151', fontWeight: '500' },
  flagActiveText: { color: '#1d4ed8' },
})
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors. If errors on `trpc.careEvents.flag`, coordinate with web instance.

- [ ] **Step 3: Run full mobile test suite**

```bash
cd apps/mobile && pnpm test
```

Expected: All tests pass (journalUtils + existing tests).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(app\)/journal/\[eventId\].tsx
git commit -m "feat(mobile): journal detail screen — reactions, flag for coordinator"
```
