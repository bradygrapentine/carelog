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
import type { Membership } from "@carelog/types";
import { colors, spacing, radii } from "../../../constants/tokens";
import { Panel } from "../../../components/Panel";

type MemberRow = Membership & { display_name?: string; email?: string };

const ROLES = ["coordinator", "caregiver", "aide", "supporter"] as const;

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  coordinator: { bg: colors.primarySubtle, text: colors.roleCoordinatorBg },
  caregiver: { bg: colors.roleCaregiverBg, text: colors.roleCaregiverText },
  aide: { bg: colors.secondarySubtle, text: colors.roleSupporterText },
  supporter: { bg: colors.surfaceSubtle, text: colors.textSecondary },
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

  const inviteAction = canInvite(currentRole) ? (
    <TouchableOpacity
      onPress={() => setShowInvite(true)}
      accessibilityRole="button"
      accessibilityLabel="Invite team member"
    >
      <Text style={styles.actionBtnText}>+ Invite</Text>
    </TouchableOpacity>
  ) : undefined;

  return (
    <View style={styles.container}>
      <Panel title="Team" action={inviteAction}>
        {isLoading ? (
          <ActivityIndicator
            style={styles.loader}
            size="large"
            color={colors.primary}
          />
        ) : (
          <FlatList
            data={(members ?? []) as MemberRow[]}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => {
              const roleColors =
                ROLE_COLORS[item.role] ?? ROLE_COLORS.supporter;
              return (
                <View style={styles.row}>
                  <View style={styles.info}>
                    <Text style={styles.name}>
                      {item.display_name ?? item.email ?? "Team member"}
                    </Text>
                    {item.email && (
                      <Text style={styles.email}>{item.email}</Text>
                    )}
                  </View>
                  <View
                    style={[styles.badge, { backgroundColor: roleColors.bg }]}
                  >
                    <Text
                      style={[styles.badgeText, { color: roleColors.text }]}
                    >
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
      </Panel>

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
  container: { flex: 1, backgroundColor: colors.surface, padding: spacing.lg },
  actionBtnText: { fontSize: 13, color: colors.primary, fontWeight: "600" },
  loader: { marginTop: 48 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSubtle,
  },
  info: { flex: 1, marginRight: spacing.md },
  name: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  email: { fontSize: 13, color: colors.muted, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: "500" },
  empty: { color: colors.mutedLight, textAlign: "center", marginTop: 48 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: spacing.lg,
    borderTopRightRadius: spacing.lg,
    padding: spacing.xl,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderNeutral,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: 15,
    marginBottom: spacing.md,
  },
  roleRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
    flexWrap: "wrap",
  },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderNeutral,
  },
  roleChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle,
  },
  roleChipText: { fontSize: 13, color: colors.textSecondary },
  roleChipTextActive: { color: colors.primary, fontWeight: "600" },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: 14,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: colors.white, fontWeight: "600", fontSize: 15 },
  cancelBtn: { alignItems: "center", padding: 10 },
  cancelText: { color: colors.muted, fontSize: 15 },
});
