import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useState } from "react";
import * as Clipboard from "expo-clipboard";
import { trpc } from "../../../utils/trpc";
import { useApp } from "../../../context/AppContext";
import { colors, spacing, radii } from "../../../constants/tokens";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

type Request = {
  id: string;
  title: string;
  description: string | null;
  slots_total: number;
  slots_filled: number;
  active: boolean;
  share_token: string;
  created_at: string;
};

export default function OuterCircleScreen() {
  const { orgId, recipientId, currentRole } = useApp();
  const isCoordinator = currentRole === "coordinator";

  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slotsTotal, setSlotsTotal] = useState("");

  const { data, isLoading, refetch } = trpc.outerCircle.list.useQuery(
    { org_id: orgId ?? "", recipient_id: recipientId ?? "" },
    { enabled: !!orgId && !!recipientId },
  );

  const createMut = trpc.outerCircle.create.useMutation({
    onSuccess: () => {
      setModalVisible(false);
      setTitle("");
      setDescription("");
      setSlotsTotal("");
      refetch();
    },
  });

  const deactivateMut = trpc.outerCircle.deactivate.useMutation({
    onSuccess: () => refetch(),
  });

  function handleCreate() {
    const titleVal = title.trim();
    const descVal = description.trim();
    const slotsVal = parseInt(slotsTotal, 10);
    if (!titleVal || isNaN(slotsVal) || slotsVal < 1) {
      Alert.alert("Please enter a title and a valid number of slots.");
      return;
    }
    createMut.mutate({
      org_id: orgId ?? "",
      recipient_id: recipientId ?? "",
      title: titleVal,
      description: descVal || undefined,
      request_type: "other",
      slots_total: slotsVal,
    });
  }

  function handleCopyLink(item: Request) {
    const url = `${API_URL}/care/${item.share_token}`;
    Clipboard.setStringAsync(url).then(() => {
      Alert.alert("Link copied");
    });
  }

  function handleClose(item: Request) {
    Alert.alert("Close request?", "This will mark the request as inactive.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Close",
        style: "destructive",
        onPress: () =>
          deactivateMut.mutate({ id: item.id, org_id: orgId ?? "" }),
      },
    ]);
  }

  function renderItem({ item }: { item: Request }) {
    return (
      <View style={styles.row}>
        <View style={styles.rowHeader}>
          <Text style={styles.title}>{item.title}</Text>
          {item.active ? (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          ) : (
            <Text style={styles.closedText}>Closed</Text>
          )}
        </View>
        {item.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        <Text style={styles.slots}>
          {item.slots_filled} / {item.slots_total} slots filled
        </Text>
        {item.active && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleCopyLink(item)}
              accessibilityRole="button"
              accessibilityLabel="Copy volunteer link"
            >
              <Text style={styles.actionBtnText}>Copy link</Text>
            </TouchableOpacity>
            {isCoordinator && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.closeBtn]}
                onPress={() => handleClose(item)}
                accessibilityRole="button"
                accessibilityLabel="Close request"
              >
                <Text style={[styles.actionBtnText, styles.closeBtnText]}>
                  Close
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isCoordinator && (
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Add volunteer request"
        >
          <Text style={styles.addBtnText}>Add Request</Text>
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
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={styles.empty}>No volunteer requests yet.</Text>
          }
        />
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>New Volunteer Request</Text>

            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Grocery run"
              accessibilityLabel="Request title"
            />

            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="More details…"
              multiline
              numberOfLines={3}
              accessibilityLabel="Request description"
            />

            <Text style={styles.label}>Number of slots</Text>
            <TextInput
              style={styles.input}
              value={slotsTotal}
              onChangeText={setSlotsTotal}
              placeholder="1"
              keyboardType="numeric"
              accessibilityLabel="Number of slots"
            />

            <TouchableOpacity
              style={[styles.addBtn, styles.submitBtn]}
              onPress={handleCreate}
              disabled={createMut.isPending}
              accessibilityRole="button"
            >
              <Text style={styles.addBtnText}>
                {createMut.isPending ? "Saving…" : "Submit"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setModalVisible(false)}
              accessibilityRole="button"
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceRaised },
  addBtn: {
    margin: spacing.lg,
    marginBottom: 0,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: 14,
    alignItems: "center",
  },
  addBtnText: { color: colors.white, fontWeight: "600", fontSize: 15 },
  loader: { marginTop: 48 },
  list: { padding: spacing.lg },
  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSubtle,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
    flex: 1,
  },
  activeBadge: {
    backgroundColor: colors.successBadgeBg,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.sm,
  },
  activeBadgeText: { fontSize: 11, fontWeight: "500", color: colors.successBadgeText },
  closedText: {
    fontSize: 12,
    color: colors.mutedLight,
    fontStyle: "italic",
    marginLeft: spacing.sm,
  },
  description: { fontSize: 13, color: colors.muted, marginBottom: 4 },
  slots: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  actions: { flexDirection: "row", gap: spacing.sm },
  actionBtn: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  actionBtnText: { fontSize: 13, color: colors.textSecondary },
  closeBtn: { backgroundColor: colors.dangerSubtle },
  closeBtnText: { color: colors.dangerStrong },
  empty: { color: colors.mutedLight, textAlign: "center", marginTop: 48 },
  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalSheet: {
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: spacing.lg,
    borderTopRightRadius: spacing.lg,
    padding: spacing.xxl,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.textSecondary,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: radii.md,
    padding: 10,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  submitBtn: { marginTop: 4, marginBottom: spacing.sm },
  cancelBtn: { alignItems: "center", paddingVertical: 10 },
  cancelBtnText: { fontSize: 14, color: colors.muted },
});
