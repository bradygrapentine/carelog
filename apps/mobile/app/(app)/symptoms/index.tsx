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
import { canLogSymptoms } from "../../../utils/wave5Utils";
import { MOOD_COLORS, type Mood } from "../../../utils/journalUtils";

export default function SymptomsScreen() {
  const router = useRouter();
  const { orgId, recipientId, currentRole } = useApp();

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
        <ActivityIndicator style={styles.loader} size="large" color="#0369a1" />
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
  container: { flex: 1, backgroundColor: "#fff" },
  logBtn: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: "#0369a1",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  logBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  loader: { marginTop: 48 },
  list: { padding: 16 },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  date: { fontSize: 12, color: "#9ca3af", marginBottom: 4 },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  metric: { fontSize: 13, color: "#374151" },
  moodBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  moodText: { fontSize: 11, fontWeight: "500" },
  notes: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  empty: { color: "#9ca3af", textAlign: "center", marginTop: 48 },
});
