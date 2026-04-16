/**
 * PP-003: Subscription read-only view
 *
 * Shows plan name, status badge, renewal date, and seat count.
 * "Manage on web" opens the Carelog web subscriptions page via expo-linking.
 *
 * NOTE: No billing tRPC router exists yet in AppRouter. This screen uses a
 * placeholder REST fetch (TODO: wire trpc.billing.getSubscription once the
 * router is added to apps/web/server/trpc/router.ts).
 */
import { useMemo, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import * as Linking from "expo-linking";
import { useAppTheme } from "../../../hooks/useAppTheme";
import { getAccessToken } from "../../../utils/auth";

const MANAGE_URL = "https://yourcarelog.com/subscriptions";
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

type SubscriptionStatus = "active" | "past_due" | "canceled";

type SubscriptionData = {
  planName: string;
  status: SubscriptionStatus;
  renewalDate: string | null;
  seatCount: number;
};

type FetchState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "success"; data: SubscriptionData | null };

function useSubscription(): FetchState & { refetch: () => void } {
  const [state, setState] = useState<FetchState>({ phase: "loading" });

  const fetch_ = useCallback(async () => {
    setState({ phase: "loading" });
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/api/trpc/billing.getSubscription`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 404 || !res.ok) {
        // Billing endpoint not yet implemented — return null (no active plan)
        setState({ phase: "success", data: null });
        return;
      }
      const json = (await res.json()) as { result?: { data?: SubscriptionData } };
      setState({ phase: "success", data: json?.result?.data ?? null });
    } catch {
      setState({ phase: "success", data: null });
    }
  }, []);

  // Kick off on first render
  useEffect(() => {
    void fetch_();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ...state, refetch: fetch_ };
}

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
};

function StatusBadge({ status, colors }: { status: SubscriptionStatus; colors: ReturnType<typeof useAppTheme>["colors"] }) {
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
    <View style={{ backgroundColor: bg, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 }}>
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
  const fetchState = useSubscription();

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
    await Linking.openURL(MANAGE_URL);
  }

  if (fetchState.phase === "loading") {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (fetchState.phase === "error") {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Subscription</Text>
        <Text style={styles.errorText}>Unable to load subscription</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={fetchState.refetch}
          accessibilityRole="button"
          accessibilityLabel="Retry loading subscription"
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { data } = fetchState;

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
