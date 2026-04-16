import { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { scaledFont } from "../../lib/typography";

type ShiftTradeRow = {
  id: string;
  shift_id: string;
  org_id: string;
  requested_by: string;
  target_user_id: string | null;
  status: "open" | "accepted" | "declined" | "expired" | "cancelled";
  message: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  expires_at: string;
};

interface TradeRequestCardProps {
  trade: ShiftTradeRow;
  currentUserId: string;
  onRespond: (requestId: string, action: "accept" | "decline") => void;
}

function truncateId(id: string): string {
  return id.substring(0, 8);
}

function getStatusColor(
  status: string,
  colors: Record<string, string>,
): string {
  switch (status) {
    case "open":
      return colors.primary;
    case "accepted":
      return colors.success;
    case "declined":
      return colors.danger;
    case "expired":
    case "cancelled":
      return colors.mutedLight;
    default:
      return colors.mutedLight;
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "open":
      return "Open";
    case "accepted":
      return "Accepted";
    case "declined":
      return "Declined";
    case "expired":
      return "Expired";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function TradeRequestCard({
  trade,
  currentUserId,
  onRespond,
}: TradeRequestCardProps) {
  const { colors, spacing } = useAppTheme();

  const isRequester = trade.requested_by === currentUserId;
  const isTarget =
    trade.target_user_id === currentUserId || trade.target_user_id === null;
  const canRespond = trade.status === "open" && isTarget && !isRequester;
  const canCancel = trade.status === "open" && isRequester;

  const statusColor = getStatusColor(trade.status, colors);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.surfaceSubtle,
        },
        header: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing.sm,
        },
        requesterText: {
          fontSize: scaledFont(14),
          fontWeight: "500",
          color: colors.ink,
        },
        targetText: {
          fontSize: scaledFont(13),
          color: colors.textSecondary,
          marginBottom: spacing.sm,
        },
        messageBubble: {
          backgroundColor: colors.surfaceSubtle,
          padding: spacing.sm,
          borderRadius: 6,
          marginVertical: spacing.sm,
        },
        messageText: {
          fontSize: scaledFont(13),
          color: colors.textPrimary,
          lineHeight: 18,
        },
        actionRow: {
          flexDirection: "row",
          gap: spacing.sm,
          marginTop: spacing.md,
        },
        button: {
          flex: 1,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: 6,
          alignItems: "center",
          justifyContent: "center",
        },
        acceptButton: {
          backgroundColor: colors.success,
        },
        declineButton: {
          backgroundColor: colors.danger,
        },
        cancelButton: {
          backgroundColor: colors.danger,
        },
        buttonText: {
          fontSize: scaledFont(13),
          fontWeight: "600",
          color: colors.surface,
        },
        statusBadge: {
          paddingHorizontal: spacing.sm,
          paddingVertical: 2,
          borderRadius: 4,
          backgroundColor: statusColor,
        },
        statusText: {
          fontSize: scaledFont(11),
          fontWeight: "600",
          color: colors.surface,
        },
      }),
    [colors, spacing],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.requesterText}>
          {isRequester ? "You" : truncateId(trade.requested_by)}
        </Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{getStatusLabel(trade.status)}</Text>
        </View>
      </View>

      <Text style={styles.targetText}>
        {trade.target_user_id === null
          ? "Open trade"
          : `To: ${truncateId(trade.target_user_id)}`}
      </Text>

      {trade.message && (
        <View style={styles.messageBubble}>
          <Text style={styles.messageText}>{trade.message}</Text>
        </View>
      )}

      {(canRespond || canCancel) && (
        <View style={styles.actionRow}>
          {canRespond && (
            <>
              <TouchableOpacity
                style={[styles.button, styles.acceptButton]}
                onPress={() => onRespond(trade.id, "accept")}
              >
                <Text style={styles.buttonText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.declineButton]}
                onPress={() => onRespond(trade.id, "decline")}
              >
                <Text style={styles.buttonText}>Decline</Text>
              </TouchableOpacity>
            </>
          )}
          {canCancel && (
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => onRespond(trade.id, "decline")}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}
