import { useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "../../../utils/trpc";
import { useApp } from "../../../context/AppContext";
import { formatWeekStamp } from "../../../utils/wave5Utils";
import { useAppTheme } from "../../../hooks/useAppTheme";

export default function BurnoutSummaryScreen() {
  const router = useRouter();
  const { orgId } = useApp();
  const { colors, spacing } = useAppTheme();

  const { data, isLoading } = trpc.burnout.orgSummary.useQuery(
    { org_id: orgId ?? "" },
    { enabled: !!orgId },
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.surfaceRaised },
        backBtn: { padding: spacing.lg, paddingBottom: 0 },
        backText: { fontSize: 15, color: colors.primary },
        heading: {
          fontSize: 20,
          fontWeight: "700",
          color: colors.textPrimary,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
        },
        subtext: {
          fontSize: 13,
          color: colors.mutedLight,
          paddingHorizontal: spacing.lg,
          marginTop: 4,
        },
        loader: { marginTop: 48 },
        list: { padding: spacing.lg },
        row: {
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.surfaceSubtle,
        },
        week: {
          fontSize: 14,
          fontWeight: "600",
          color: colors.textPrimary,
          marginBottom: 6,
        },
        scores: { flexDirection: "row", gap: 20 },
        scoreCol: { alignItems: "center" },
        scoreLabel: { fontSize: 11, color: colors.mutedLight, marginBottom: 2 },
        scoreValue: {
          fontSize: 18,
          fontWeight: "700",
          color: colors.textPrimary,
        },
        count: { fontSize: 12, color: colors.mutedLight, marginTop: 4 },
        empty: { color: colors.mutedLight, textAlign: "center", marginTop: 48 },
      }),
    [colors, spacing],
  );

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
        <ActivityIndicator
          style={styles.loader}
          size="large"
          color={colors.primary}
        />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.week_stamp}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.week}>
                {formatWeekStamp(item.week_stamp)}
              </Text>
              <View style={styles.scores}>
                <View style={styles.scoreCol}>
                  <Text style={styles.scoreLabel}>Sleep</Text>
                  <Text style={styles.scoreValue}>
                    {item.avg_sleep.toFixed(1)}
                  </Text>
                </View>
                <View style={styles.scoreCol}>
                  <Text style={styles.scoreLabel}>Stress</Text>
                  <Text style={styles.scoreValue}>
                    {item.avg_stress.toFixed(1)}
                  </Text>
                </View>
                <View style={styles.scoreCol}>
                  <Text style={styles.scoreLabel}>Support</Text>
                  <Text style={styles.scoreValue}>
                    {item.avg_support.toFixed(1)}
                  </Text>
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
  );
}
