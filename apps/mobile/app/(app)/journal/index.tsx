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
            accessibilityRole="button"
            accessibilityLabel={r.label + (myReaction === r.key ? ', selected' : '')}
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
                accessibilityRole="button"
                accessibilityLabel={isExpanded ? 'Collapse entry' : 'Expand entry'}
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
                      accessibilityRole="button"
                      accessibilityLabel="Open full entry"
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
              accessibilityRole="button"
              accessibilityLabel={m + ' mood'}
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
          accessibilityRole="button"
          accessibilityLabel={submitting ? 'Saving entry' : 'Add entry'}
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
