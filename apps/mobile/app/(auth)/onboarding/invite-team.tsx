import { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAppTheme } from "../../../hooks/useAppTheme";
import { scaledFont } from "../../../lib/font-scale";
import { completeOnboarding } from "../../../lib/onboarding";

export default function InviteTeamScreen() {
  const router = useRouter();
  const { colors, spacing, radii, fontFamily } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          padding: spacing.xxl,
          backgroundColor: colors.surface,
          justifyContent: "center",
        },
        title: {
          fontSize: scaledFont(24),
          fontFamily: fontFamily.bold,
          color: colors.ink,
          marginBottom: spacing.sm,
        },
        body: {
          fontSize: scaledFont(15),
          fontFamily: fontFamily.regular,
          color: colors.textSecondary,
          lineHeight: scaledFont(22),
          marginBottom: spacing.xxxl,
        },
        primaryButton: {
          backgroundColor: colors.primary,
          borderRadius: radii.md,
          paddingVertical: spacing.lg,
          alignItems: "center",
          minHeight: 48,
          justifyContent: "center",
          marginBottom: spacing.md,
        },
        primaryButtonText: {
          color: colors.white,
          fontSize: scaledFont(16),
          fontFamily: fontFamily.semibold,
        },
        secondaryButton: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radii.md,
          paddingVertical: spacing.lg,
          alignItems: "center",
          minHeight: 48,
          justifyContent: "center",
        },
        secondaryButtonText: {
          color: colors.primary,
          fontSize: scaledFont(16),
          fontFamily: fontFamily.medium,
        },
      }),
    [colors, spacing, radii, fontFamily],
  );

  async function handleSendInvites() {
    Alert.alert("Coming soon", "Invite sending will be available shortly.");
    await completeOnboarding();
    router.replace("/(app)");
  }

  async function handleSkip() {
    await completeOnboarding();
    router.replace("/(app)");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Invite your team</Text>
      <Text style={styles.body}>
        Caregiving is a team effort. You can invite family members and helpers
        to collaborate.
      </Text>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleSendInvites}
        accessibilityRole="button"
        accessibilityLabel="Send invites to team members"
      >
        <Text style={styles.primaryButtonText}>Send invites</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={handleSkip}
        accessibilityRole="button"
        accessibilityLabel="Skip for now and go to app"
      >
        <Text style={styles.secondaryButtonText}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  );
}
