import { useState, useMemo, useEffect } from "react";
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
import { useMutationWithRefresh } from "../../../hooks/useMutationWithRefresh";
import { canInvite } from "../../../utils/wave5Utils";
import type { Membership } from "@carelog/types";
import { useAppTheme } from "../../../hooks/useAppTheme";
import { Panel } from "../../../components/Panel";
import { supabase } from "../../../utils/supabase";

type MemberRow = Membership & { display_name?: string; email?: string };

const ROLES = ["coordinator", "caregiver", "aide", "supporter"] as const;

export default function TeamScreen() {
  const { orgId, recipientId, currentRole } = useApp();
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("caregiver");
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { colors, spacing, radii } = useAppTheme();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
    coordinator: { bg: colors.primarySubtle, text: colors.roleCoordinatorBg },
    caregiver: { bg: colors.roleCaregiverBg, text: colors.roleCaregiverText },
    aide: { bg: colors.secondarySubtle, text: colors.roleSupporterText },
    supporter: { bg: colors.surfaceSubtle, text: colors.textSecondary },
  };

  const {
    data: members,
    isLoading,
    refetch,
  } = trpc.memberships.list.useQuery(
    { orgId: orgId ?? "" },
    { enabled: !!orgId },
  );

  const inviteMut = useMutationWithRefresh(
    trpc.memberships.invite.useMutation,
    refetch,
    {
      onSuccess: () => {
        setShowInvite(false);
        setEmail("");
        setRole("caregiver");
        Alert.alert("Invite sent");
      },
      onError: (err) => Alert.alert("Error", err.message),
    },
  );

  const changeRoleMut = useMutationWithRefresh(
    trpc.memberships.changeRole.useMutation,
    refetch,
    { onError: (err) => Alert.alert("Error", err.message) },
  );

  const removeMut = useMutationWithRefresh(
    trpc.memberships.remove.useMutation,
    refetch,
    { onError: (err) => Alert.alert("Error", err.message) },
  );

  function handleMemberPress(item: MemberRow) {
    if (currentRole !== "coordinator" || !orgId) return;
    const isSelf = item.user_id === currentUserId;
    if (isSelf) return;

    const isPending = !item.accepted_at;

    const buttons: { text: string; onPress?: () => void; style?: "destructive" | "cancel" | "default" }[] = [
      {
        text: "Change role",
        onPress: () => handleChangeRole(item),
      },
      {
        text: "Remove member",
        style: "destructive",
        onPress: () => handleRemoveMember(item),
      },
    ];

    if (isPending) {
      buttons.unshift({
        text: "Resend invite",
        onPress: () => handleResendInvite(item),
      });
    }

    buttons.push({ text: "Cancel", style: "cancel" });

    Alert.alert(
      item.display_name ?? item.email ?? "Team member",
      undefined,
      buttons,
    );
  }

  function handleChangeRole(item: MemberRow) {
    if (!orgId) return;
    Alert.alert(
      "Change role",
      `Select a new role for ${item.display_name ?? item.email ?? "this member"}`,
      [
        ...ROLES.map((r) => ({
          text: r.charAt(0).toUpperCase() + r.slice(1),
          onPress: () => {
            if (r === item.role) return;
            changeRoleMut.mutate({ orgId, membershipId: item.id, role: r });
          },
        })),
        { text: "Cancel", style: "cancel" as const },
      ],
    );
  }

  function handleRemoveMember(item: MemberRow) {
    if (!orgId) return;
    Alert.alert(
      "Remove member",
      `Remove ${item.display_name ?? item.email ?? "this member"} from the team?`,
      [
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeMut.mutate({ orgId, membershipId: item.id }),
        },
        { text: "Cancel", style: "cancel" },
      ],
    );
  }

  function handleResendInvite(item: MemberRow) {
    if (!orgId || !item.email) return;
    inviteMut.mutate({
      orgId,
      recipientId: recipientId ?? null,
      role: item.role,
      email: item.email,
    });
  }

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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.surface,
          padding: spacing.lg,
        },
        actionBtnText: {
          fontSize: 13,
          color: colors.primary,
          fontWeight: "600",
        },
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
        pendingTag: {
          fontSize: 11,
          color: colors.muted,
          marginTop: 2,
          fontStyle: "italic",
        },
        empty: {
          color: colors.mutedLight,
          textAlign: "center",
          marginTop: 48,
        },
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
      }),
    [colors, spacing, radii],
  );

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
              const isCoordinator = currentRole === "coordinator";
              const isSelf = item.user_id === currentUserId;
              const canAdmin = isCoordinator && !isSelf;
              const memberName =
                item.display_name ?? item.email ?? "Team member";
              return (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => handleMemberPress(item)}
                  disabled={!canAdmin}
                  accessibilityRole="button"
                  accessibilityLabel={
                    canAdmin
                      ? `Manage ${memberName}`
                      : memberName
                  }
                >
                  <View style={styles.info}>
                    <Text style={styles.name}>{memberName}</Text>
                    {item.email && (
                      <Text style={styles.email}>{item.email}</Text>
                    )}
                    {!item.accepted_at && (
                      <Text style={styles.pendingTag}>pending</Text>
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
                </TouchableOpacity>
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
