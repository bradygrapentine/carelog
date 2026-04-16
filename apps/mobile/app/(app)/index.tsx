import { useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "../../utils/trpc";
import { useApp } from "../../context/AppContext";
import { useAppTheme } from "../../hooks/useAppTheme";
import { scaledFont } from "../../lib/typography";

// ts-prune-ignore-next // Expo Router page component
export default function OrgSelectorScreen() {
  const router = useRouter();
  const { setOrg } = useApp();
  const { data: orgs, isLoading } = trpc.organizations.list.useQuery();
  const { colors, spacing, radii } = useAppTheme();

  // ts-prune-ignore-next // Expo Router page component
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          padding: spacing.lg,
          backgroundColor: colors.surfaceRaised,
        },
        center: { flex: 1, justifyContent: "center", alignItems: "center" },
        title: {
          fontSize: scaledFont(22),
          fontWeight: "700",
          marginBottom: spacing.lg,
          marginTop: 48,
        },
        card: {
          borderWidth: 1,
          borderColor: colors.borderNeutral,
          borderRadius: radii.md,
          padding: spacing.lg,
          marginBottom: 10,
        },
        cardTitle: { fontSize: scaledFont(17), fontWeight: "600" },
        empty: { color: colors.mutedLight, textAlign: "center", marginTop: 48 },
      }),
    [colors, spacing, radii],
  );

  useEffect(() => {
    if (orgs?.length === 1) {
      const org = orgs[0];
      setOrg(org.id, "", "coordinator");
      router.replace("/(app)/journal");
    }
  }, [orgs]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your care teams</Text>
      <FlatList
        data={orgs ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => {
              setOrg(item.id, "", "coordinator");
              router.replace("/(app)/journal");
            }}
            accessibilityRole="button"
            accessibilityLabel={item.name}
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            You're not on any care teams yet. Ask a coordinator to invite you,
            or create a care team to get started.
          </Text>
        }
      />
    </View>
  );
}
