import { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAppTheme } from "../../../hooks/useAppTheme";

const ITEMS = [
  { title: "Symptoms", route: "/symptoms" as const, icon: "🩺" },
  { title: "Burnout", route: "/burnout" as const, icon: "🔋" },
  { title: "Expenses", route: "/expenses" as const, icon: "💰" },
  { title: "Documents", route: "/documents" as const, icon: "📄" },
  { title: "Volunteer Requests", route: "/outer-circle" as const, icon: "🤝" },
  { title: "Care Brief", route: "/care-brief" as const, icon: "📋" },
  { title: "Benefits", route: "/benefits" as const, icon: "🏥" },
  { title: "End-of-Life", route: "/eol-planner" as const, icon: "📝" },
];

// ts-prune-ignore-next // Expo Router page component
export default function MoreScreen() {
  const router = useRouter();
  const { colors, spacing, radii, typography } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.surfaceRaised,
          padding: spacing.lg,
        },
        heading: {
          fontSize: typography.titleSize,
          fontWeight: typography.weightBold,
          color: colors.textPrimary,
          marginBottom: spacing.xl,
        },
        grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
        card: {
          width: "47%",
          backgroundColor: colors.surfaceSubtle,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.borderNeutral,
          padding: spacing.xl,
          alignItems: "center",
          gap: spacing.sm,
        },
        icon: { fontSize: 28 },
        label: {
          fontSize: typography.bodySize,
          fontWeight: typography.weightSemibold,
          color: colors.textPrimary,
        },
      }),
    [colors, spacing, radii, typography],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>More</Text>
      <View style={styles.grid}>
        {ITEMS.map((item) => (
          <TouchableOpacity
            key={item.route}
            style={styles.card}
            onPress={() => router.push(item.route)}
            accessibilityRole="button"
            accessibilityLabel={item.title}
          >
            <Text style={styles.icon}>{item.icon}</Text>
            <Text style={styles.label}>{item.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
