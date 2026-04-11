// apps/mobile/app/(app)/journal/[eventId].tsx
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { trpc } from "../../../utils/trpc";
import { useApp } from "../../../context/AppContext";
import {
  Mood,
  ReactionKey,
  MOOD_COLORS,
  REACTIONS,
  formatEntryDateTime,
  canFlag,
} from "../../../utils/journalUtils";

export default function JournalDetailScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const { currentRole } = useApp();

  const { data: event, isLoading } = trpc.careEvents.getOne.useQuery({
    eventId,
  });
  const { data: reactions, refetch: refetchReactions } =
    trpc.careEvents.reactions.useQuery({ eventId });
  const reactMut = trpc.careEvents.react.useMutation({
    onSuccess: () => refetchReactions(),
  });
  const unreactMut = trpc.careEvents.unreact.useMutation({
    onSuccess: () => refetchReactions(),
  });
  const flagMut = trpc.careEvents.flag.useMutation();

  const counts = reactions?.counts ?? {};
  const myReaction = reactions?.myReaction ?? null;

  function toggleReaction(key: ReactionKey) {
    if (myReaction === key) {
      unreactMut.mutate({ eventId });
    } else {
      reactMut.mutate({ eventId, reaction: key });
    }
  }

  function toggleFlag() {
    if (!event) return;
    flagMut.mutate({ eventId, flagged: !event.flagged });
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0369a1" />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "#9ca3af", marginBottom: 12 }}>
          Entry not found.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={{ color: "#0369a1" }}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const payload = (event.payload as Record<string, unknown>) ?? {};
  const entryText = (payload["text"] as string) ?? "";
  const entryMood = payload["mood"] as Mood | undefined;
  const moodColor = entryMood ? MOOD_COLORS[entryMood] : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.entryText}>{entryText}</Text>

        <View style={styles.meta}>
          {entryMood && moodColor && (
            <View style={[styles.moodBadge, { backgroundColor: moodColor.bg }]}>
              <Text style={[styles.moodText, { color: moodColor.text }]}>
                {entryMood}
              </Text>
            </View>
          )}
          <Text style={styles.dateText}>
            {formatEntryDateTime(event.occurred_at)}
          </Text>
        </View>

        <View style={styles.reactionRow}>
          {REACTIONS.map((r) => {
            const count = counts[r.key] ?? 0;
            const active = myReaction === r.key;
            return (
              <TouchableOpacity
                key={r.key}
                onPress={() => toggleReaction(r.key)}
                style={[styles.reactionBtn, active && styles.reactionActive]}
                accessibilityRole="button"
                accessibilityLabel={r.label + (active ? ", selected" : "")}
              >
                <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                <Text style={styles.reactionLabel}>{r.label}</Text>
                {count > 0 && <Text style={styles.reactionCount}>{count}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {canFlag(currentRole) && (
          <TouchableOpacity
            onPress={toggleFlag}
            disabled={flagMut.isPending}
            style={[styles.flagBtn, event.flagged && styles.flagActive]}
            accessibilityRole="button"
            accessibilityLabel={
              event.flagged ? "Unflag entry" : "Flag for doctor"
            }
          >
            <Text
              style={[styles.flagText, event.flagged && styles.flagActiveText]}
            >
              {event.flagged ? "Unflag" : "Flag for doctor"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  backBtn: { marginBottom: 12 },
  backText: { fontSize: 14, color: "#0369a1" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  entryText: {
    fontSize: 16,
    color: "#111827",
    lineHeight: 24,
    marginBottom: 12,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  moodBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  moodText: { fontSize: 12, fontWeight: "500" },
  dateText: { fontSize: 12, color: "#9ca3af" },
  reactionRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  reactionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  reactionActive: { borderColor: "#93c5fd", backgroundColor: "#eff6ff" },
  reactionEmoji: { fontSize: 16 },
  reactionLabel: { fontSize: 13, color: "#374151" },
  reactionCount: { fontSize: 12, color: "#374151", fontWeight: "600" },
  flagBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  flagActive: { borderColor: "#3b82f6", backgroundColor: "#eff6ff" },
  flagText: { fontSize: 14, color: "#374151", fontWeight: "500" },
  flagActiveText: { color: "#1d4ed8" },
});
