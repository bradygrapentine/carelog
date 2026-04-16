import { useMemo } from "react";
import { haptics } from "../../../utils/haptics";
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
import { useAppTheme } from "../../../hooks/useAppTheme";

// ts-prune-ignore-next // Expo Router page component
export default function JournalDetailScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const { currentRole } = useApp();
  const { colors, spacing, radii } = useAppTheme();

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
  const flagMut = trpc.careEvents.flag.useMutation({
    onSuccess: () => haptics.success(),
    onError: () => haptics.error(),
  });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.surfaceSubtle },
        content: { padding: spacing.lg },
        center: { flex: 1, alignItems: "center", justifyContent: "center" },
        backBtn: { marginBottom: spacing.md },
        backText: { fontSize: 14, color: colors.primary },
        card: {
          backgroundColor: colors.surfaceRaised,
          borderRadius: radii.lg,
          padding: spacing.lg,
          shadowColor: colors.black,
          shadowOpacity: 0.05,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 1 },
        },
        entryText: {
          fontSize: 16,
          color: colors.textPrimary,
          lineHeight: 24,
          marginBottom: spacing.md,
        },
        meta: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          marginBottom: spacing.lg,
          flexWrap: "wrap",
        },
        moodBadge: {
          paddingHorizontal: 10,
          paddingVertical: 3,
          borderRadius: 12,
        },
        moodText: { fontSize: 12, fontWeight: "500" },
        dateText: { fontSize: 12, color: colors.mutedLight },
        reactionRow: {
          flexDirection: "row",
          gap: spacing.sm,
          flexWrap: "wrap",
          marginBottom: spacing.lg,
        },
        reactionBtn: {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: spacing.md,
          paddingVertical: 6,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.borderNeutral,
          backgroundColor: colors.surfaceSubtle,
        },
        reactionActive: {
          borderColor: colors.primaryLight,
          backgroundColor: colors.primarySubtle,
        },
        reactionEmoji: { fontSize: 16 },
        reactionLabel: { fontSize: 13, color: colors.textSecondary },
        reactionCount: {
          fontSize: 12,
          color: colors.textSecondary,
          fontWeight: "600",
        },
        flagBtn: {
          borderWidth: 1,
          borderColor: colors.borderInput,
          borderRadius: radii.md,
          padding: spacing.md,
          alignItems: "center",
        },
        flagActive: {
          borderColor: colors.primaryLight,
          backgroundColor: colors.primarySubtle,
        },
        flagText: {
          fontSize: 14,
          color: colors.textSecondary,
          fontWeight: "500",
        },
        flagActiveText: { color: colors.primary },
      }),
    [colors, spacing, radii],
  );

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
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.mutedLight, marginBottom: spacing.md }}>
          Entry not found.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={{ color: colors.primary }}>← Go back</Text>
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
