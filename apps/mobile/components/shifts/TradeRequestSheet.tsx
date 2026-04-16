import { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { scaledFont } from "../../lib/typography";

interface TradeRequestSheetProps {
  shiftId: string;
  orgId: string;
  onSubmit: (message?: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function TradeRequestSheet({
  shiftId,
  orgId,
  onSubmit,
  onCancel,
  isLoading = false,
}: TradeRequestSheetProps) {
  const { colors, spacing } = useAppTheme();
  const [message, setMessage] = useState("");

  const charCount = message.length;
  const maxChars = 500;
  const isAtLimit = charCount >= maxChars;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          paddingVertical: spacing.lg,
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.surface,
        },
        title: {
          fontSize: scaledFont(16),
          fontWeight: "600",
          color: colors.ink,
          marginBottom: spacing.md,
        },
        label: {
          fontSize: scaledFont(13),
          fontWeight: "500",
          color: colors.textPrimary,
          marginBottom: spacing.sm,
        },
        input: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 6,
          padding: spacing.md,
          minHeight: 100,
          fontSize: scaledFont(13),
          color: colors.textPrimary,
          textAlignVertical: "top",
          marginBottom: spacing.sm,
        },
        charCount: {
          fontSize: scaledFont(11),
          color: isAtLimit ? colors.danger : colors.mutedLight,
          textAlign: "right",
          marginBottom: spacing.md,
        },
        note: {
          fontSize: scaledFont(12),
          color: colors.textSecondary,
          marginBottom: spacing.md,
          lineHeight: 16,
        },
        actionRow: {
          flexDirection: "row",
          gap: spacing.md,
        },
        button: {
          flex: 1,
          paddingVertical: spacing.md,
          borderRadius: 6,
          alignItems: "center",
          justifyContent: "center",
          minHeight: 44,
          flexDirection: "row",
        },
        cancelButton: {
          backgroundColor: colors.surfaceSubtle,
          borderWidth: 1,
          borderColor: colors.border,
        },
        submitButton: {
          backgroundColor: colors.primary,
        },
        buttonText: {
          fontSize: scaledFont(14),
          fontWeight: "600",
        },
        cancelText: {
          color: colors.ink,
        },
        submitText: {
          color: colors.surface,
        },
        loadingSpinner: {
          marginRight: spacing.sm,
        },
      }),
    [colors, spacing, isAtLimit],
  );

  const handleSubmit = () => {
    onSubmit(message.trim() || undefined);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Request Trade</Text>

      <Text style={styles.label}>Message (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Add a message to your request..."
        placeholderTextColor={colors.mutedLight}
        multiline
        maxLength={maxChars}
        value={message}
        onChangeText={setMessage}
        editable={!isLoading}
      />
      <Text style={styles.charCount}>
        {charCount}/{maxChars}
      </Text>

      <Text style={styles.note}>
        Submitting will request a trade for this shift.
      </Text>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={onCancel}
          disabled={isLoading}
        >
          <Text style={[styles.buttonText, styles.cancelText]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.submitButton]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading && (
            <ActivityIndicator
              color={colors.surface}
              style={styles.loadingSpinner}
            />
          )}
          <Text style={[styles.buttonText, styles.submitText]}>
            Request Trade
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
