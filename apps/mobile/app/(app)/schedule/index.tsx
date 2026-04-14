import { useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { trpc } from "../../../utils/trpc";
import { writeWatchData } from "../../../utils/watchBridge";
import { useApp } from "../../../context/AppContext";
import { colors, spacing } from "../../../constants/tokens";

// DB columns: start_at / end_at (not starts_at / ends_at)
type Shift = {
  id: string;
  start_at: string;
  end_at: string;
  assignee_user_id: string;
  notes: string | null;
};

function formatShiftTime(iso: string) {
  return new Date(iso).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ScheduleScreen() {
  const { orgId, recipientId } = useApp();

  // shiftListInput requires 'from'/'to' — NOT 'since'/'until'
  const from = new Date().toISOString();
  const to = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: shifts, isLoading } = trpc.shifts.list.useQuery(
    { org_id: orgId ?? "", recipient_id: recipientId ?? "", from, to },
    { enabled: !!orgId && !!recipientId, staleTime: 5 * 60 * 1000 },
  );

  // Feed next shift to watch complications after data loads
  useEffect(() => {
    if (!shifts) return;
    const list = shifts as unknown as Shift[];
    const next = list[0];
    if (next) {
      writeWatchData({
        nextShift: {
          assigneeName: next.assignee_user_id,
          startsAt: next.start_at,
        },
      });
    }
  }, [shifts]);

  if (isLoading) {
    return (
      <ActivityIndicator
        style={{ marginTop: 48 }}
        size="large"
        color={colors.primary}
      />
    );
  }

  const list = (shifts as unknown as Shift[]) ?? [];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Next 7 days</Text>
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const durationHours = Math.round(
            (new Date(item.end_at).getTime() -
              new Date(item.start_at).getTime()) /
              3_600_000,
          );
          return (
            <View style={styles.row}>
              <View style={styles.time}>
                <Text style={styles.timeText}>
                  {formatShiftTime(item.start_at)}
                </Text>
                <Text style={styles.duration}>{durationHours}h</Text>
              </View>
              <Text style={styles.assignee}>{item.notes ?? "—"}</Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No shifts scheduled for the next 7 days.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSubtle,
  },
  time: { flex: 1 },
  timeText: { fontSize: 15, fontWeight: "500" },
  duration: { fontSize: 12, color: colors.mutedLight, marginTop: 2 },
  assignee: { fontSize: 14, color: colors.textSecondary },
  empty: { color: colors.mutedLight, textAlign: "center", marginTop: 48 },
});
