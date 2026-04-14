import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "../../../utils/trpc";
import { useApp } from "../../../context/AppContext";
import { useSyncStatus } from "../../../hooks/useSyncStatus";
import { canLogSymptoms } from "../../../utils/wave5Utils";
import { MOOD_COLORS, type Mood } from "../../../utils/journalUtils";
import { colors, spacing, radii } from "../../../constants/tokens";

export default function SymptomsScreen() {
  const router = useRouter();
  const { orgId, recipientId, currentRole } = useApp();
  const syncStatus = useSyncStatus();

  const { data, isLoading } = trpc.symptoms.list.useQuery(
    { org_id: orgId ?? "", recipient_id: recipientId ?? "" },
    { enabled: !!orgId && !!recipientId },
  );

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return (
      d.toLocaleDateString([], { month: "short", day: "numeric" }) +
      " " +
      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  }

  return (
    <View style={styles.container}>
      {syncStatus !== "synced" && (
        <View
          style={{
            paddingVertical: 6,
            paddingHorizontal: spacing.md,
            backgroundColor:
              syncStatus === "offline"
                ? colors.secondarySubtle
                : colors.primarySubtle,
          }}
        >
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
            {syncStatus === "offline"
              ? "● Offline — readings will sync when connected"
              : "↑ Syncing readings…"}
          </Text>
        </View>
      )}
      {canLogSymptoms(currentRole) && (
        <TouchableOpacity
          style={styles.logBtn}
          onPress={() => router.push("/symptoms/log")}
          accessibilityRole="button"
          accessibilityLabel="Log symptoms"
        >
          <Text style={styles.logBtnText}>Log symptoms</Text>
        </TouchableOpacity>
      )}

      {isLoading ? (
        <ActivityIndicator
          style={styles.loader}
          size="large"
          color={colors.primary}
        />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const moodColor = item.mood ? MOOD_COLORS[item.mood as Mood] : null;
            return (
              <View style={styles.row}>
                <Text style={styles.date}>{formatDate(item.recorded_at)}</Text>
                <View style={styles.metrics}>
                  {item.pain_level != null && (
                    <Text style={styles.metric}>
                      Pain: {item.pain_level}/10
                    </Text>
                  )}
                  {item.mood && moodColor && (
                    <View
                      style={[
                        styles.moodBadge,
                        { backgroundColor: moodColor.bg },
                      ]}
                    >
                      <Text
                        style={[styles.moodText, { color: moodColor.text }]}
                      >
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
                  <Text style={styles.notes} numberOfLines={2}>
                    {item.notes}
                  </Text>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>No symptom readings yet.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceRaised },
  logBtn: {
    margin: spacing.lg,
    marginBottom: 0,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: 14,
    alignItems: "center",
  },
  logBtnText: { color: colors.white, fontWeight: "600", fontSize: 15 },
  loader: { marginTop: 48 },
  list: { padding: spacing.lg },
  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSubtle,
  },
  date: { fontSize: 12, color: colors.mutedLight, marginBottom: 4 },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    alignItems: "center",
  },
  metric: { fontSize: 13, color: colors.textSecondary },
  moodBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 12,
  },
  moodText: { fontSize: 11, fontWeight: "500" },
  notes: { fontSize: 13, color: colors.muted, marginTop: 4 },
  empty: { color: colors.mutedLight, textAlign: "center", marginTop: 48 },
});
