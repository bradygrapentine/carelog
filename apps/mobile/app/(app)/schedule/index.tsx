import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { trpc } from "../../../utils/trpc";
import { writeWatchData } from "../../../utils/watchBridge";
import { useApp } from "../../../context/AppContext";
import { useAppTheme } from "../../../hooks/useAppTheme";
import { Panel } from "../../../components/Panel";
import { SkeletonRow } from "../../../components/Skeleton";
import { TradeRequestSheet } from "../../../components/shifts/TradeRequestSheet";
import { scaledFont } from "../../../lib/typography";

// DB columns: start_at / end_at (not starts_at / ends_at)
type Shift = {
  id: string;
  start_at: string;
  end_at: string;
  assignee_user_id: string;
  status: string;
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
  const { orgId, recipientId, currentRole } = useApp();
  const { colors, spacing } = useAppTheme();
  const [tradeSheetVisible, setTradeSheetVisible] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [completeShiftId, setCompleteShiftId] = useState<string | null>(null);
  const [handoffNote, setHandoffNote] = useState("");

  // shiftListInput requires 'from'/'to' — NOT 'since'/'until'
  const from = new Date().toISOString();
  const to = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: shifts, isLoading } = trpc.shifts.list.useQuery(
    { org_id: orgId ?? "", recipient_id: recipientId ?? "", from, to },
    { enabled: !!orgId && !!recipientId, staleTime: 5 * 60 * 1000 },
  );

  const utils = trpc.useUtils();
  const createTradeMutation = trpc.shiftTradeRequests.create.useMutation();
  const completeMutation = trpc.shifts.complete.useMutation({
    onSuccess: () => utils.shifts.list.invalidate(),
  });
  const insertEventMutation = trpc.careEvents.insert.useMutation();

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

  const list = (shifts as unknown as Shift[]) ?? [];

  const canComplete =
    currentRole === "coordinator" ||
    currentRole === "caregiver" ||
    currentRole === "aide";

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.surface,
          padding: spacing.lg,
        },
        loader: { marginTop: 48 },
        row: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.surfaceSubtle,
        },
        time: { flex: 1 },
        timeText: { fontSize: scaledFont(15), fontWeight: "500" },
        duration: {
          fontSize: scaledFont(12),
          color: colors.mutedLight,
          marginTop: 2,
        },
        assignee: { fontSize: scaledFont(14), color: colors.textSecondary },
        empty: { color: colors.mutedLight, textAlign: "center", marginTop: 48 },
        rowWithButton: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.surfaceSubtle,
        },
        tradeButton: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: 6,
          backgroundColor: colors.primarySubtle,
        },
        tradeButtonText: {
          fontSize: scaledFont(12),
          fontWeight: "500",
          color: colors.primary,
        },
        completeButton: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: 6,
          backgroundColor: colors.primary,
          marginLeft: spacing.sm,
        },
        completeButtonText: {
          fontSize: scaledFont(12),
          fontWeight: "500",
          color: colors.white,
        },
        modalOverlay: {
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          justifyContent: "flex-end",
        },
        modalContent: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
        },
        handoffModalContent: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          padding: spacing.lg,
          gap: spacing.md,
        },
        handoffTitle: {
          fontSize: scaledFont(16),
          fontWeight: "600",
          color: colors.textPrimary,
          marginBottom: spacing.sm,
        },
        handoffSubtitle: {
          fontSize: scaledFont(13),
          color: colors.textSecondary,
          marginBottom: spacing.sm,
        },
        handoffInput: {
          borderWidth: 1,
          borderColor: colors.borderNeutral,
          borderRadius: 8,
          padding: spacing.md,
          fontSize: scaledFont(14),
          minHeight: 80,
          textAlignVertical: "top",
          color: colors.textPrimary,
        },
        handoffActions: {
          flexDirection: "row",
          gap: spacing.md,
          marginTop: spacing.sm,
        },
        handoffPrimaryBtn: {
          flex: 1,
          backgroundColor: colors.primary,
          paddingVertical: spacing.md,
          borderRadius: 8,
          alignItems: "center",
        },
        handoffPrimaryText: {
          color: colors.white,
          fontWeight: "600",
          fontSize: scaledFont(14),
        },
        handoffSecondaryBtn: {
          flex: 1,
          borderWidth: 1,
          borderColor: colors.borderNeutral,
          paddingVertical: spacing.md,
          borderRadius: 8,
          alignItems: "center",
        },
        handoffSecondaryText: {
          color: colors.textSecondary,
          fontWeight: "500",
          fontSize: scaledFont(14),
        },
      }),
    [colors, spacing],
  );

  const handleOpenTradeSheet = (shiftId: string) => {
    setSelectedShiftId(shiftId);
    setTradeSheetVisible(true);
  };

  const handleSubmitTrade = (message?: string) => {
    if (!selectedShiftId || !orgId) return;
    createTradeMutation.mutate(
      { shift_id: selectedShiftId, org_id: orgId, message },
      {
        onSuccess: () => {
          setTradeSheetVisible(false);
          setSelectedShiftId(null);
        },
      },
    );
  };

  const handleOpenComplete = (shiftId: string) => {
    setCompleteShiftId(shiftId);
    setHandoffNote("");
  };

  const handleCompleteShift = () => {
    if (!completeShiftId || !orgId || !recipientId) return;
    completeMutation.mutate(
      { id: completeShiftId, org_id: orgId },
      {
        onSuccess: () => {
          if (handoffNote.trim()) {
            insertEventMutation.mutate({
              orgId,
              recipientId,
              eventType: "handoff",
              entryKind: "human",
              payload: { text: handoffNote.trim() },
            });
          }
          setCompleteShiftId(null);
          setHandoffNote("");
        },
      },
    );
  };

  const handleSkipHandoff = () => {
    if (!completeShiftId || !orgId) return;
    completeMutation.mutate(
      { id: completeShiftId, org_id: orgId },
      {
        onSuccess: () => {
          setCompleteShiftId(null);
          setHandoffNote("");
        },
      },
    );
  };

  return (
    <View style={styles.container}>
      <Panel title="Next 7 days">
        {isLoading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : (
          <FlatList
            data={list}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => {
              const durationHours = Math.round(
                (new Date(item.end_at).getTime() -
                  new Date(item.start_at).getTime()) /
                  3_600_000,
              );
              return (
                <View style={styles.rowWithButton}>
                  <View style={styles.time}>
                    <Text style={styles.timeText}>
                      {formatShiftTime(item.start_at)}
                    </Text>
                    <Text style={styles.duration}>{durationHours}h</Text>
                  </View>
                  <Text style={styles.assignee}>{item.notes ?? "—"}</Text>
                  <TouchableOpacity
                    style={styles.tradeButton}
                    onPress={() => handleOpenTradeSheet(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Request trade for shift on ${formatShiftTime(item.start_at)}`}
                  >
                    <Text style={styles.tradeButtonText}>+ Trade</Text>
                  </TouchableOpacity>
                  {canComplete &&
                    item.status !== "completed" &&
                    item.status !== "cancelled" && (
                      <TouchableOpacity
                        style={styles.completeButton}
                        onPress={() => handleOpenComplete(item.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Complete shift on ${formatShiftTime(item.start_at)}`}
                      >
                        <Text style={styles.completeButtonText}>Complete</Text>
                      </TouchableOpacity>
                    )}
                </View>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.empty}>
                No shifts coming up. Ask your coordinator to add coverage.
              </Text>
            }
          />
        )}
      </Panel>

      <Modal
        visible={tradeSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTradeSheetVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TradeRequestSheet
              shiftId={selectedShiftId ?? ""}
              orgId={orgId ?? ""}
              onSubmit={handleSubmitTrade}
              onCancel={() => setTradeSheetVisible(false)}
              isLoading={createTradeMutation.isPending}
            />
          </View>
        </View>
      </Modal>

      {/* Handoff note modal — shown after tapping Complete on a shift */}
      <Modal
        visible={!!completeShiftId}
        transparent
        animationType="slide"
        onRequestClose={() => setCompleteShiftId(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.handoffModalContent}>
            <Text style={styles.handoffTitle}>Complete shift</Text>
            <Text style={styles.handoffSubtitle}>
              Add an optional handoff note for the next caregiver.
            </Text>
            <TextInput
              style={styles.handoffInput}
              placeholder="Add a handoff note for the next caregiver…"
              value={handoffNote}
              onChangeText={setHandoffNote}
              multiline
              maxLength={1000}
              accessibilityLabel="Handoff note"
            />
            <View style={styles.handoffActions}>
              <TouchableOpacity
                style={styles.handoffSecondaryBtn}
                onPress={() => setCompleteShiftId(null)}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.handoffSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.handoffSecondaryBtn}
                onPress={handleSkipHandoff}
                disabled={completeMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel="Skip handoff note and complete shift"
              >
                <Text style={styles.handoffSecondaryText}>
                  {completeMutation.isPending ? "Saving…" : "Skip"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.handoffPrimaryBtn}
                onPress={handleCompleteShift}
                disabled={completeMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel="Save handoff note and complete shift"
              >
                <Text style={styles.handoffPrimaryText}>
                  {completeMutation.isPending ? "Saving…" : "Complete shift"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
