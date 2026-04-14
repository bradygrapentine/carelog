import { useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { trpc } from "../../../utils/trpc";
import { writeWatchData } from "../../../utils/watchBridge";
import { useApp } from "../../../context/AppContext";
import { useOfflineWrite } from "../../../hooks/useOfflineWrite";
import { useSyncStatus } from "../../../hooks/useSyncStatus";
import { colors, spacing, radii } from "../../../constants/tokens";

// Supabase join returns medications as an array; we use the first element
type ScheduledMed = {
  id: string;
  scheduled_time: string;
  medications: { id: string; drug_name: string; dosage: string }[] | null;
};

type TodayLogEntry = {
  medication_id: string;
  scheduled_time: string;
  action: string;
};

export default function MedicationsScreen() {
  const { orgId, recipientId } = useApp();
  const { write } = useOfflineWrite(orgId ?? "");
  const syncStatus = useSyncStatus();

  const {
    data: scheduled,
    isLoading,
    refetch,
  } = trpc.medications.listScheduled.useQuery(
    { org_id: orgId ?? "", recipient_id: recipientId ?? "" },
    { enabled: !!orgId && !!recipientId, staleTime: 5 * 60 * 1000 },
  );

  const { data: todayLog } = trpc.medications.todayLog.useQuery(
    { org_id: orgId ?? "", recipient_id: recipientId ?? "" },
    { enabled: !!orgId && !!recipientId },
  );

  // Feed medications list to watch complications after data loads
  useEffect(() => {
    if (!scheduled) return;
    const meds = scheduled as unknown as ScheduledMed[];
    const medList = meds
      .filter((m) => m.medications?.[0])
      .map((m) => ({
        id: m.medications![0].id,
        name: m.medications![0].drug_name,
        dosage: m.medications![0].dosage,
        dueAt: m.scheduled_time,
        scheduledTime: m.scheduled_time,
      }));
    const next = medList[0] ?? null;
    writeWatchData({
      nextMedication: next,
      medications: medList,
    });
  }, [scheduled]);

  // Build set of administered med_id|scheduled_time pairs
  const administeredSet = new Set(
    ((todayLog as TodayLogEntry[]) ?? []).map(
      (l) => `${l.medication_id}|${l.scheduled_time}`,
    ),
  );

  if (isLoading) {
    return (
      <ActivityIndicator
        style={{ marginTop: 48 }}
        size="large"
        color={colors.primary}
      />
    );
  }

  const meds = (scheduled as unknown as ScheduledMed[]) ?? [];

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
              ? "● Offline — logs will sync when connected"
              : "↑ Syncing logs…"}
          </Text>
        </View>
      )}
      <Text style={styles.title}>Today's medications</Text>
      <FlatList
        data={meds}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const med = item.medications?.[0];
          if (!med) return null;
          const key = `${med.id}|${item.scheduled_time}`;
          const given = administeredSet.has(key);
          return (
            <View style={styles.row}>
              <View style={styles.info}>
                <Text style={styles.medName}>{med.drug_name}</Text>
                <Text style={styles.medDose}>
                  {med.dosage} · {item.scheduled_time}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.btn, given && styles.givenBtn]}
                disabled={given}
                onPress={() =>
                  write({
                    event_type: "medication",
                    entry_kind: "medication_log",
                    payload: {
                      medication_id: med.id,
                      scheduled_time: item.scheduled_time,
                      action: "given",
                    },
                    recipient_id: recipientId!,
                  }).then(() => refetch())
                }
                accessibilityRole="button"
                accessibilityLabel={
                  given
                    ? "Already given"
                    : "Mark " + med.drug_name + " as given"
                }
              >
                <Text style={[styles.btnText, given && styles.givenText]}>
                  {given ? "✓ Given" : "Mark given"}
                </Text>
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>No medications scheduled for today.</Text>
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
  info: { flex: 1 },
  medName: { fontSize: 16, fontWeight: "600" },
  medDose: { fontSize: 13, color: colors.muted, marginTop: 2 },
  btn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  givenBtn: {
    backgroundColor: colors.successSubtle,
    borderWidth: 1,
    borderColor: colors.successLight,
  },
  btnText: { color: colors.white, fontWeight: "600", fontSize: 13 },
  givenText: { color: colors.successStrong },
  empty: { color: colors.mutedLight, textAlign: "center", marginTop: 48 },
});
