import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { trpc } from "../../../utils/trpc";
import { useApp } from "../../../context/AppContext";
import { canInvite } from "../../../utils/wave5Utils";

const ROLES = ["coordinator", "caregiver", "aide", "supporter"] as const;

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  coordinator: { bg: "#ede9fe", text: "#5b21b6" },
  caregiver: { bg: "#dbeafe", text: "#1e40af" },
  aide: { bg: "#fef3c7", text: "#92400e" },
  supporter: { bg: "#f3f4f6", text: "#374151" },
};

export default function TeamScreen() {
  const { orgId, recipientId, currentRole } = useApp();
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("caregiver");
  const [sending, setSending] = useState(false);

  const {
    data: members,
    isLoading,
    refetch,
  } = trpc.memberships.list.useQuery(
    { orgId: orgId ?? "" },
    { enabled: !!orgId },
  );

  const inviteMut = trpc.memberships.invite.useMutation({
    onSuccess: () => {
      setShowInvite(false);
      setEmail("");
      setRole("caregiver");
      refetch();
      Alert.alert("Invite sent");
    },
    onError: (err) => {
      Alert.alert("Error", err.message);
    },
  });

  async function handleInvite() {
    if (!email.trim() || !orgId) return;
    setSending(true);
    try {
      await inviteMut.mutateAsync({
        orgId,
        recipientId: recipientId ?? null,
        role,
        email: email.trim(),
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#0369a1" />
      ) : (
        <FlatList
          data={members ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const colors = ROLE_COLORS[item.role] ?? ROLE_COLORS.supporter;
            return (
              <View style={styles.row}>
                <View style={styles.info}>
                  <Text style={styles.name}>
                    {item.display_name ?? item.email ?? "Team member"}
                  </Text>
                  {item.email && <Text style={styles.email}>{item.email}</Text>}
                </View>
                <View style={[styles.badge, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.badgeText, { color: colors.text }]}>
                    {item.role}
                  </Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>No team members yet.</Text>
          }
        />
      )}

      {canInvite(currentRole) && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowInvite(true)}
          accessibilityRole="button"
          accessibilityLabel="Invite team member"
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      <Modal visible={showInvite} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Invite team member</Text>
            <TextInput
              style={styles.input}
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.roleRow}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChip, role === r && styles.roleChipActive]}
                  onPress={() => setRole(r)}
                  accessibilityRole="button"
                  accessibilityLabel={r + " role"}
                >
                  <Text
                    style={[
                      styles.roleChipText,
                      role === r && styles.roleChipTextActive,
                    ]}
                  >
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!email.trim() || sending) && styles.sendDisabled,
              ]}
              onPress={handleInvite}
              disabled={!email.trim() || sending}
              accessibilityRole="button"
              accessibilityLabel={sending ? "Sending invite" : "Send invite"}
            >
              <Text style={styles.sendText}>
                {sending ? "Sending…" : "Send invite"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setShowInvite(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  loader: { marginTop: 48 },
  list: { padding: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  info: { flex: 1, marginRight: 12 },
  name: { fontSize: 15, fontWeight: "600", color: "#111827" },
  email: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: "500" },
  empty: { color: "#9ca3af", textAlign: "center", marginTop: 48 },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#0369a1",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: { color: "#fff", fontSize: 28, lineHeight: 30 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  roleRow: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  roleChipActive: { borderColor: "#0369a1", backgroundColor: "#eff6ff" },
  roleChipText: { fontSize: 13, color: "#374151" },
  roleChipTextActive: { color: "#0369a1", fontWeight: "600" },
  sendBtn: {
    backgroundColor: "#0369a1",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginBottom: 8,
  },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  cancelBtn: { alignItems: "center", padding: 10 },
  cancelText: { color: "#6b7280", fontSize: 15 },
});
