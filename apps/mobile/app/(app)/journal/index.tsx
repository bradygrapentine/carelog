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
          renderItem={({ item }) => (
            <View style={styles.entry}>
              <Text style={styles.entryTime}>
                {new Date(item.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Text style={styles.entryText}>{(item.payload as Record<string, unknown>)?.['text'] as string ?? item.event_type}</Text>
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
