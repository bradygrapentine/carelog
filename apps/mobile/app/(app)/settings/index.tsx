import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { signOut, getAccessToken } from "../../../utils/auth";
import { colors, spacing, radii } from "../../../constants/tokens";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

async function registerPushToken(): Promise<void> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    Alert.alert(
      "Notifications blocked",
      "Enable notifications in Settings to receive alerts.",
    );
    return;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  const accessToken = await getAccessToken();
  const res = await fetch(API_URL + "/api/push/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { authorization: "Bearer " + accessToken } : {}),
    },
    body: JSON.stringify({ token, platform: Platform.OS }),
  });

  if (!res.ok) {
    throw new Error("Registration failed: " + res.status);
  }
}

export default function SettingsScreen() {
  const router = useRouter();
  const [registering, setRegistering] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.replace("/(auth)/sign-in");
  }

  async function handleEnableNotifications() {
    setRegistering(true);
    try {
      await registerPushToken();
      Alert.alert(
        "Notifications enabled",
        "You will now receive alerts for this org.",
      );
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Could not enable notifications.",
      );
    } finally {
      setRegistering(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <TouchableOpacity
        style={styles.notifBtn}
        onPress={handleEnableNotifications}
        disabled={registering}
        accessibilityRole="button"
        accessibilityLabel={
          registering ? "Enabling notifications" : "Enable push notifications"
        }
      >
        <Text style={styles.notifText}>
          {registering ? "Enabling…" : "Enable push notifications"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.signOutBtn}
        onPress={handleSignOut}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.surfaceRaised,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 24,
    marginTop: spacing.sm,
  },
  notifBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    padding: 14,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  notifText: { color: colors.primary, fontWeight: "600" },
  signOutBtn: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.md,
    padding: 14,
    alignItems: "center",
  },
  signOutText: { color: colors.danger, fontWeight: "600" },
});
