// apps/mobile/app/(app)/journal/index.tsx
import { useState, useMemo } from "react";
import { haptics } from "../../../utils/haptics";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "../../../utils/trpc";
import { useOfflineWrite } from "../../../hooks/useOfflineWrite";
import { useSyncStatus } from "../../../hooks/useSyncStatus";
import { useApp } from "../../../context/AppContext";
import {
  Mood,
  ReactionKey,
  MOOD_COLORS,
  REACTIONS,
  formatEntryTime,
} from "../../../utils/journalUtils";
import { useAppTheme } from "../../../hooks/useAppTheme";
import { Panel } from "../../../components/Panel";
import { SkeletonRow } from "../../../components/Skeleton";

const MOOD_TAGS = ["good", "okay", "difficult", "crisis"] as const;

// ── Reactions sub-component ────────────────────────────────────────────────
// Only mounted when an entry is expanded — query fires on mount.
function EntryReactions({
  eventId,
  styles,
  colors,
}: {
  eventId: string;
  styles: ReturnType<typeof buildStyles>;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  const { data, refetch } = trpc.careEvents.reactions.useQuery({ eventId });
  const reactMut = trpc.careEvents.react.useMutation({
    onSuccess: () => refetch(),
  });
  const unreactMut = trpc.careEvents.unreact.useMutation({
    onSuccess: () => refetch(),
  });

  const counts = data?.counts ?? {};
  const myReaction = data?.myReaction ?? null;

  function toggle(key: ReactionKey) {
    if (myReaction === key) {
      unreactMut.mutate({ eventId });
    } else {
      reactMut.mutate({ eventId, reaction: key });
    }
  }

  return (
    <View style={styles.reactionRow}>
      {REACTIONS.map((r) => {
        const count = counts[r.key] ?? 0;
        const active = myReaction === r.key;
        return (
          <TouchableOpacity
            key={r.key}
            onPress={() => toggle(r.key)}
            style={[styles.reactionBtn, active && styles.reactionActive]}
            accessibilityRole="button"
            accessibilityLabel={
              r.label + (myReaction === r.key ? ", selected" : "")
            }
          >
            <Text style={styles.reactionEmoji}>{r.emoji}</Text>
            {count > 0 && <Text style={styles.reactionCount}>{count}</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Extracted style builder so EntryReactions can receive the same styles object
function buildStyles(
  colors: ReturnType<typeof useAppTheme>["colors"],
  spacing: ReturnType<typeof useAppTheme>["spacing"],
  radii: ReturnType<typeof useAppTheme>["radii"],
) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
      padding: spacing.lg,
      gap: spacing.md,
    },
    syncBanner: { paddingVertical: 6, paddingHorizontal: spacing.md },
    offlineBanner: { backgroundColor: colors.secondarySubtle },
    pendingBanner: { backgroundColor: colors.primarySubtle },
    syncText: { fontSize: 12, color: colors.textSecondary },
    journalPanel: { flex: 1 },
    formPanel: {},
    loader: { marginTop: 48 },
    entry: {
      borderLeftWidth: 2,
      borderLeftColor: colors.borderNeutral,
      paddingLeft: spacing.md,
      marginBottom: spacing.lg,
      paddingVertical: 4,
    },
    entryHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: 2,
    },
    entryTime: { fontSize: 12, color: colors.mutedLight },
    moodBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: 12,
    },
    moodText: { fontSize: 11, fontWeight: "500" },
    entryText: { fontSize: 15, color: colors.textPrimary, lineHeight: 22 },
    reactionRow: {
      flexDirection: "row",
      gap: 6,
      marginTop: spacing.sm,
      flexWrap: "wrap",
    },
    reactionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.borderNeutral,
      backgroundColor: colors.surfaceSubtle,
    },
    reactionActive: {
      borderColor: colors.primaryLight,
      backgroundColor: colors.primarySubtle,
    },
    reactionEmoji: { fontSize: 14 },
    reactionCount: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    openBtn: { marginTop: spacing.sm, alignSelf: "flex-start" },
    openBtnText: { fontSize: 13, color: colors.primary, fontWeight: "500" },
    empty: { color: colors.mutedLight, textAlign: "center", marginTop: 48 },
    moodRow: { flexDirection: "row", gap: spacing.sm, marginBottom: 10 },
    moodTag: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.borderNeutral,
    },
    moodTagText: { fontSize: 13, color: colors.textSecondary },
    input: {
      borderWidth: 1,
      borderColor: colors.borderNeutral,
      borderRadius: radii.md,
      padding: 10,
      fontSize: 15,
      minHeight: 72,
      textAlignVertical: "top",
      marginBottom: 10,
    },
    submitBtn: {
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      padding: spacing.md,
      alignItems: "center",
    },
    submitDisabled: { opacity: 0.4 },
    submitText: { color: colors.white, fontWeight: "600" },
  });
}

// ── Main screen ────────────────────────────────────────────────────────────
export default function JournalScreen() {
  const router = useRouter();
  const { orgId, recipientId } = useApp();
  const [text, setText] = useState("");
  const [mood, setMood] = useState<Mood>("okay");
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const syncStatus = useSyncStatus();
  const { write } = useOfflineWrite(orgId ?? "");
  const { colors, spacing, radii } = useAppTheme();

  // Module-level map moved inside component to consume live colors
  const INPUT_MOOD_COLORS: Record<Mood, string> = {
    good: colors.moodGood,
    okay: colors.moodOkay,
    difficult: colors.moodDifficult,
    crisis: colors.moodCrisis,
  };

  const styles = useMemo(
    () => buildStyles(colors, spacing, radii),
    [colors, spacing, radii],
  );

  const {
    data: timeline,
    isLoading,
    refetch,
  } = trpc.careEvents.timeline.useQuery(
    { recipientId: recipientId ?? "" },
    { enabled: !!recipientId, staleTime: 5 * 60 * 1000 },
  );

  async function handleSubmit() {
    if (!text.trim() || !recipientId) return;
    const entry = text.trim();
    setText("");
    setSubmitting(true);
    haptics.tap();

    try {
      await write({
        event_type: "journal",
        entry_kind: "journal_entry",
        payload: { text: entry, mood },
        recipient_id: recipientId,
      });
      refetch();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      {syncStatus !== "synced" && (
        <View
          style={[
            styles.syncBanner,
            syncStatus === "offline"
              ? styles.offlineBanner
              : styles.pendingBanner,
          ]}
        >
          <Text style={styles.syncText}>
            {syncStatus === "offline"
              ? "● Offline — entries will sync when connected"
              : "↑ Syncing entries…"}
          </Text>
        </View>
      )}

      <Panel title="Journal" style={styles.journalPanel}>
        {isLoading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : (
          <FlatList
            data={timeline ?? []}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => {
              const payload = (item.payload as Record<string, unknown>) ?? {};
              const entryText = (payload["text"] as string) ?? item.event_type;
              const entryMood = payload["mood"] as Mood | undefined;
              const isExpanded = expandedId === item.id;
              const moodColor = entryMood ? MOOD_COLORS[entryMood] : null;

              return (
                <TouchableOpacity
                  style={styles.entry}
                  onPress={() => setExpandedId(isExpanded ? null : item.id)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isExpanded ? "Collapse entry" : "Expand entry"
                  }
                >
                  <View style={styles.entryHeader}>
                    <Text style={styles.entryTime}>
                      {formatEntryTime(item.occurred_at)}
                    </Text>
                    {entryMood && moodColor && (
                      <View
                        style={[
                          styles.moodBadge,
                          { backgroundColor: moodColor.bg },
                        ]}
                      >
                        <Text
                          style={[styles.moodText, { color: moodColor.text }]}
                        >
                          {entryMood}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={styles.entryText}
                    numberOfLines={isExpanded ? undefined : 2}
                  >
                    {entryText}
                  </Text>
                  {isExpanded && (
                    <>
                      <EntryReactions
                        eventId={item.id}
                        styles={styles}
                        colors={colors}
                      />
                      <TouchableOpacity
                        style={styles.openBtn}
                        onPress={() => router.push("/journal/" + item.id)}
                        accessibilityRole="button"
                        accessibilityLabel="Open full entry"
                      >
                        <Text style={styles.openBtnText}>Open entry →</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.empty}>
                Nothing logged yet. Tap + to write your first journal entry.
              </Text>
            }
          />
        )}
      </Panel>

      <Panel title="New Entry" style={styles.formPanel}>
        <View style={styles.moodRow}>
          {MOOD_TAGS.map((m) => (
            <TouchableOpacity
              key={m}
              style={[
                styles.moodTag,
                mood === m && { backgroundColor: INPUT_MOOD_COLORS[m] },
              ]}
              onPress={() => setMood(m)}
              accessibilityRole="button"
              accessibilityLabel={m + " mood"}
            >
              <Text
                style={[
                  styles.moodTagText,
                  mood === m && { color: colors.white },
                ]}
              >
                {m}
              </Text>
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
          style={[
            styles.submitBtn,
            (!text.trim() || submitting) && styles.submitDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!text.trim() || submitting}
          accessibilityRole="button"
          accessibilityLabel={submitting ? "Saving entry" : "Add entry"}
        >
          <Text style={styles.submitText}>
            {submitting ? "Saving…" : "Add entry"}
          </Text>
        </TouchableOpacity>
      </Panel>
    </View>
  );
}
