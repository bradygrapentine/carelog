import { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAppTheme } from "../../../hooks/useAppTheme";
import { scaledFont } from "../../../lib/font-scale";

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors, spacing, radii, fontFamily } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: spacing.xxl,
          backgroundColor: colors.surface,
        },
        icon: {
          fontSize: scaledFont(64),
          marginBottom: spacing.xxl,
        },
        title: {
          fontSize: scaledFont(28),
          fontFamily: fontFamily.bold,
          color: colors.ink,
          textAlign: "center",
          marginBottom: spacing.lg,
        },
        body: {
          fontSize: scaledFont(16),
          fontFamily: fontFamily.regular,
          color: colors.textSecondary,
          textAlign: "center",
          lineHeight: scaledFont(24),
          marginBottom: spacing.xxxl,
        },
        button: {
          backgroundColor: colors.primary,
          borderRadius: radii.md,
          paddingVertical: spacing.lg,
          paddingHorizontal: spacing.xxl,
          alignItems: "center",
          minWidth: 200,
          minHeight: 48,
          justifyContent: "center",
        },
        buttonText: {
          color: colors.white,
          fontSize: scaledFont(16),
          fontFamily: fontFamily.semibold,
        },
      }),
    [colors, spacing, radii, fontFamily],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.icon} accessibilityElementsHidden>
        🏠
      </Text>
      <Text style={styles.title}>Welcome to Carelog</Text>
      <Text style={styles.body}>
        Carelog helps your family coordinate care — medications, schedules, and
        daily updates, all in one place.
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/(auth)/onboarding/care-recipient")}
        accessibilityRole="button"
        accessibilityLabel="Get started"
      >
        <Text style={styles.buttonText}>Get started →</Text>
      </TouchableOpacity>
    </View>
  );
}
