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
import { formatWeekStamp } from "../../../utils/wave5Utils";
import { colors, spacing, radii } from "../../../constants/tokens";

function currentWeekStamp(): string {
  const d = new Date();
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const dayOfYear = Math.ceil(
    (d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000,
  );
  const dayOfWeek = d.getDay() || 7;
  const weekNum = Math.ceil((dayOfYear + (jan4.getDay() || 7) - 1) / 7);
  const padded = String(weekNum).padStart(2, "0");
  return d.getFullYear() + "-W" + padded;
}

export default function BurnoutScreen() {
  const router = useRouter();
  const { orgId, currentRole } = useApp();

  const { data, isLoading } = trpc.burnout.myHistory.useQuery(
    { org_id: orgId ?? "" },
    { enabled: !!orgId },
  );

  const thisWeek = currentWeekStamp();
  const alreadyCheckedIn = (data ?? []).some((c) => c.week_stamp === thisWeek);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.checkinBtn, alreadyCheckedIn && styles.checkinDisabled]}
        onPress={() => router.push("/burnout/checkin")}
        disabled={alreadyCheckedIn}
        accessibilityRole="button"
        accessibilityLabel={
          alreadyCheckedIn
            ? "Already checked in this week"
            : "Check in this week"
        }
      >
        <Text style={styles.checkinText}>
          {alreadyCheckedIn ? "Checked in this week ✓" : "Check in this week"}
        </Text>
      </TouchableOpacity>

      {currentRole === "coordinator" && (
        <TouchableOpacity
          style={styles.summaryBtn}
          onPress={() => router.push("/burnout/summary")}
          accessibilityRole="button"
          accessibilityLabel="Team summary"
        >
          <Text style={styles.summaryBtnText}>Team summary</Text>
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
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.week}>
                {formatWeekStamp(item.week_stamp)}
              </Text>
              <View style={styles.scores}>
                <Text style={styles.score}>Sleep: {item.sleep_score}/5</Text>
                <Text style={styles.score}>Stress: {item.stress_score}/5</Text>
                <Text style={styles.score}>
                  Support: {item.support_score}/5
                </Text>
              </View>
              {item.notes && (
                <Text style={styles.notes} numberOfLines={1}>
                  {item.notes}
                </Text>
              )}
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              No check-ins yet. How are you doing?
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceRaised },
  checkinBtn: {
    margin: spacing.lg,
    marginBottom: 0,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: 14,
    alignItems: "center",
  },
  checkinDisabled: { backgroundColor: colors.borderInput },
  checkinText: { color: colors.white, fontWeight: "600", fontSize: 15 },
  summaryBtn: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: "center",
  },
  summaryBtnText: { color: colors.primary, fontWeight: "600", fontSize: 14 },
  loader: { marginTop: 48 },
  list: { padding: spacing.lg },
  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSubtle,
  },
  week: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  scores: { flexDirection: "row", gap: 12 },
  score: { fontSize: 13, color: colors.textSecondary },
  notes: { fontSize: 13, color: colors.muted, marginTop: 4 },
  empty: { color: colors.mutedLight, textAlign: "center", marginTop: 48 },
});
