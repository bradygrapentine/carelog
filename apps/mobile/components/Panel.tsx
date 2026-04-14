import { useMemo } from "react";
import type { ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "../hooks/useAppTheme";

type PanelProps = {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  style?: object;
};

// Reusable panel matching the web's violet-tinted header pattern:
// - Light-purple header strip that fills edge-to-edge
// - Bottom border acts as the divider
// - Tight gap between header and body (no double-separator)
//
// Use for every screen section that groups related content on mobile.
export function Panel({ title, action, children, style }: PanelProps) {
  const { colors, radii, spacing, typography, shadows } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: colors.surfaceRaised,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
          ...shadows.card,
        },
        header: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: colors.primarySubtle,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        title: {
          fontSize: typography.smallSize,
          fontWeight: typography.weightSemibold,
          color: colors.textPrimary,
        },
        action: {
          flexDirection: "row",
          alignItems: "center",
        },
        body: {
          padding: spacing.lg,
          gap: spacing.sm,
        },
      }),
    [colors, radii, spacing, typography, shadows],
  );

  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {action ? <View style={styles.action}>{action}</View> : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}
