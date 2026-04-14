import { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { getSession } from "../../../utils/auth";
import { useAppTheme } from "../../../hooks/useAppTheme";

type InviteDetails = {
  org_name: string;
  role: string;
  invited_by: string;
};

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const [details, setDetails] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
  const { colors, spacing, radii } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          justifyContent: "center",
          padding: spacing.xxl,
          backgroundColor: colors.surfaceRaised,
        },
        title: { fontSize: 24, fontWeight: "700", marginBottom: spacing.sm },
        subtitle: {
          fontSize: 16,
          color: colors.muted,
          marginBottom: 32,
          lineHeight: 24,
        },
        btn: {
          backgroundColor: colors.primary,
          borderRadius: radii.md,
          padding: spacing.lg,
          alignItems: "center",
        },
        btnText: { color: colors.white, fontWeight: "600", fontSize: 16 },
      }),
    [colors, spacing, radii],
  );

  useEffect(() => {
    async function init() {
      const session = await getSession();
      if (!session) {
        await SecureStore.setItemAsync("pending_invite_token", token);
        router.replace("/(auth)/sign-in");
        return;
      }
      const res = await fetch(`${API_URL}/api/invite/${token}`);
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = (await res.json()) as InviteDetails;
      setDetails(data);
      setLoading(false);
    }
    init();
  }, [token]);

  async function handleAccept() {
    setAccepting(true);
    const session = await getSession();
    const res = await fetch(`${API_URL}/api/invite/${token}/accept`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
    });
    setAccepting(false);
    if (!res.ok) {
      Alert.alert(
        "Error",
        "Could not accept invite. It may have already been used.",
      );
      return;
    }
    await SecureStore.deleteItemAsync("pending_invite_token");
    router.replace("/(app)/journal");
  }

  if (loading) {
    return (
      <ActivityIndicator
        style={{ flex: 1 }}
        size="large"
        color={colors.primary}
      />
    );
  }

  if (!details) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Invite not found</Text>
        <Text style={styles.subtitle}>
          This invite may have expired or already been used.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>You're invited!</Text>
      <Text style={styles.subtitle}>
        {details.invited_by} invited you to join {details.org_name} as a{" "}
        {details.role}.
      </Text>
      <TouchableOpacity
        style={styles.btn}
        onPress={handleAccept}
        disabled={accepting}
        accessibilityRole="button"
        accessibilityLabel={accepting ? "Joining" : "Accept invite"}
      >
        <Text style={styles.btnText}>
          {accepting ? "Joining…" : "Accept invite"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
