/**
 * PP-003 / PP-014: Subscription read-only view.
 *
 * Reads plan + seat count via `trpc.billing.getSubscription` (router shipped
 * in TD-22 / PR #147). "Manage on web" opens the Carelog web subscriptions
 * page via expo-web-browser.
 */
import { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useAppTheme } from "../../../hooks/useAppTheme";
import { trpc } from "../../../utils/trpc";

const MANAGE_URL = "https://yourcarelog.com/subscriptions";

type SubscriptionStatus = "active" | "past_due" | "canceled";

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
};

function StatusBadge({
  status,
  colors,
}: {
  status: SubscriptionStatus;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  const bg =
    status === "active"
      ? colors.successBadgeBg
      : status === "past_due"
        ? colors.secondarySubtle
        : colors.dangerSubtle;
  const fg =
    status === "active"
      ? colors.successBadgeText
      : status === "past_due"
        ? colors.secondary
        : colors.danger;

  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 3,
      }}
    >
      <Text style={{ color: fg, fontWeight: "600", fontSize: 13 }}>
        {STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

// ts-prune-ignore-next // Expo Router page component
export default function SubscriptionScreen() {
  const { colors, spacing, radii, typography } = useAppTheme();
  const { data, isLoading, error, refetch } =
    trpc.billing.getSubscription.useQuery();

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
        card: {
          backgroundColor: colors.surfaceSubtle,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.borderNeutral,
          padding: spacing.xl,
          gap: spacing.md,
          marginBottom: spacing.lg,
        },
        row: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
        label: {
          fontSize: typography.bodySize,
          color: colors.textSecondary,
        },
        value: {
          fontSize: typography.bodySize,
          fontWeight: typography.weightSemibold,
          color: colors.textPrimary,
        },
        planName: {
          fontSize: 18,
          fontWeight: typography.weightBold,
          color: colors.textPrimary,
        },
        emptyText: {
          fontSize: typography.bodySize,
          color: colors.textSecondary,
          textAlign: "center",
          marginVertical: spacing.xl,
        },
        ctaBtn: {
          backgroundColor: colors.primary,
          borderRadius: radii.md,
          padding: spacing.lg,
          alignItems: "center",
        },
        ctaText: {
          color: "#fff",
          fontWeight: typography.weightBold,
          fontSize: typography.bodySize,
        },
        retryBtn: {
          borderWidth: 1,
          borderColor: colors.primary,
          borderRadius: radii.md,
          padding: spacing.lg,
          alignItems: "center",
          marginBottom: spacing.md,
        },
        retryText: {
          color: colors.primary,
          fontWeight: typography.weightSemibold,
          fontSize: typography.bodySize,
        },
        errorText: {
          color: colors.danger,
          textAlign: "center",
          marginBottom: spacing.md,
          fontSize: typography.bodySize,
        },
        centered: { flex: 1, justifyContent: "center", alignItems: "center" },
      }),
    [colors, spacing, radii, typography],
  );

  async function handleManageOnWeb() {
    await WebBrowser.openBrowserAsync(MANAGE_URL);
  }

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Subscription</Text>
        <Text style={styles.errorText}>Unable to load subscription</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => refetch()}
          accessibilityRole="button"
          accessibilityLabel="Retry loading subscription"
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Subscription</Text>

      {data == null ? (
        <Text style={styles.emptyText}>No active plan</Text>
      ) : (
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.planName}>{data.planName}</Text>
            <StatusBadge status={data.status} colors={colors} />
          </View>

          {data.renewalDate != null && (
            <View style={styles.row}>
              <Text style={styles.label}>Renewal date</Text>
              <Text style={styles.value}>{formatDate(data.renewalDate)}</Text>
            </View>
          )}

          <View style={styles.row}>
            <Text style={styles.label}>Seats</Text>
            <Text style={styles.value}>{data.seatCount}</Text>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={styles.ctaBtn}
        onPress={handleManageOnWeb}
        accessibilityRole="button"
        accessibilityLabel="Manage subscription on web"
      >
        <Text style={styles.ctaText}>Manage on web</Text>
      </TouchableOpacity>
    </View>
  );
}
