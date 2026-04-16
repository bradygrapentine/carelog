import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useAppTheme } from "../../../hooks/useAppTheme";
import { scaledFont } from "../../../lib/font-scale";

export default function CareRecipientScreen() {
  const router = useRouter();
  const { colors, spacing, radii, fontFamily } = useAppTheme();
  const [recipientName, setRecipientName] = useState("");
  const [caregiverName, setCaregiverName] = useState("");

  const isValid =
    recipientName.trim().length > 0 && caregiverName.trim().length > 0;

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
        subtitle: {
          fontSize: scaledFont(15),
          fontFamily: fontFamily.regular,
          color: colors.muted,
          marginBottom: spacing.xxxl,
        },
        label: {
          fontSize: scaledFont(14),
          fontFamily: fontFamily.medium,
          color: colors.textPrimary,
          marginBottom: spacing.xs,
        },
        input: {
          borderWidth: 1,
          borderColor: colors.borderInput,
          borderRadius: radii.md,
          padding: spacing.lg,
          fontSize: scaledFont(16),
          fontFamily: fontFamily.regular,
          color: colors.textPrimary,
          backgroundColor: colors.surfaceRaised,
          marginBottom: spacing.lg,
          minHeight: 48,
        },
        button: {
          backgroundColor: colors.primary,
          borderRadius: radii.md,
          paddingVertical: spacing.lg,
          alignItems: "center",
          minHeight: 48,
          justifyContent: "center",
          opacity: isValid ? 1 : 0.5,
        },
        buttonText: {
          color: colors.white,
          fontSize: scaledFont(16),
          fontFamily: fontFamily.semibold,
        },
      }),
    [colors, spacing, radii, fontFamily, isValid],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Who are you caring for?</Text>
      <Text style={styles.subtitle}>
        This helps personalize your Carelog experience.
      </Text>

      <Text style={styles.label}>Their display name</Text>
      <TextInput
        style={styles.input}
        value={recipientName}
        onChangeText={setRecipientName}
        placeholder="e.g. Mom, Dad, Grandma"
        placeholderTextColor={colors.mutedLight}
        autoCapitalize="words"
        returnKeyType="next"
        accessibilityLabel="Care recipient display name"
      />

      <Text style={styles.label}>Your name</Text>
      <TextInput
        style={styles.input}
        value={caregiverName}
        onChangeText={setCaregiverName}
        placeholder="e.g. Alex"
        placeholderTextColor={colors.mutedLight}
        autoCapitalize="words"
        returnKeyType="done"
        accessibilityLabel="Your name as shown to team members"
      />

      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          if (!isValid) return;
          router.push("/(auth)/onboarding/invite-team");
        }}
        disabled={!isValid}
        accessibilityRole="button"
        accessibilityLabel={
          isValid ? "Continue to invite team" : "Fill in both fields to continue"
        }
        accessibilityState={{ disabled: !isValid }}
      >
        <Text style={styles.buttonText}>Continue →</Text>
      </TouchableOpacity>
    </View>
  );
}
