import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useApp } from "../../../context/AppContext";
import { getSession } from "../../../utils/auth";
import { useAppTheme } from "../../../hooks/useAppTheme";
import { Panel } from "../../../components/Panel";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

type Brief = {
  shareToken: string;
  generatedAt: string;
};

export default function CareBriefScreen() {
  const { orgId, recipientId, currentRole } = useApp();
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { colors, spacing, radii } = useAppTheme();

  const isCoordinator = currentRole === "coordinator";

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.surface },
        content: { padding: spacing.lg },
        actionBtnText: {
          fontSize: 13,
          color: colors.primary,
          fontWeight: "600",
        },
        actionBtnDisabled: { color: colors.mutedLight },
        subtitle: {
          fontSize: 14,
          color: colors.muted,
          marginBottom: spacing.md,
        },
        error: { color: colors.danger, marginBottom: 12, fontSize: 14 },
        empty: {
          color: colors.mutedLight,
          textAlign: "center",
          marginTop: 48,
        },
        card: {
          borderWidth: 1,
          borderColor: colors.borderNeutral,
          borderRadius: radii.md,
          padding: 14,
          marginBottom: 12,
        },
        cardDate: {
          fontSize: 12,
          color: colors.mutedLight,
          marginBottom: 6,
        },
        cardUrl: {
          fontSize: 13,
          color: colors.textSecondary,
          marginBottom: 10,
        },
        cardActions: { flexDirection: "row", gap: 8 },
        cardActionBtn: {
          backgroundColor: colors.surfaceSubtle,
          borderRadius: radii.sm,
          paddingVertical: 7,
          paddingHorizontal: 12,
        },
        cardActionBtnText: {
          fontSize: 13,
          color: colors.textSecondary,
          fontWeight: "500",
        },
        revokeBtn: { backgroundColor: colors.dangerPanel },
        revokeBtnText: { color: colors.danger },
      }),
    [colors, spacing, radii],
  );

  async function handleGenerate() {
    const localOrgId = orgId;
    const localRecipientId = recipientId;
    setError(null);
    setLoading(true);
    try {
      const session = await getSession();
      if (!session) {
        setError("You need to be signed in.");
        return;
      }
      const res = await fetch(`${API_URL}/api/brief`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          orgId: localOrgId,
          recipientId: localRecipientId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to generate brief");
        return;
      }
      setBriefs((prev) => [
        ...prev,
        { shareToken: data.shareToken, generatedAt: new Date().toISOString() },
      ]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(shareToken: string) {
    try {
      const session = await getSession();
      if (!session) {
        Alert.alert("Error", "You need to be signed in.");
        return;
      }
      await fetch(`${API_URL}/api/brief/${shareToken}/revoke`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setBriefs((prev) => prev.filter((b) => b.shareToken !== shareToken));
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to revoke");
    }
  }

  async function handleCopy(url: string) {
    await Clipboard.setStringAsync(url);
    Alert.alert("Link copied", url);
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return (
      d.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) +
      " " +
      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  }

  const generateAction = isCoordinator ? (
    <TouchableOpacity
      onPress={handleGenerate}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={loading ? "Generating brief" : "Generate care brief"}
    >
      <Text style={[styles.actionBtnText, loading && styles.actionBtnDisabled]}>
        {loading ? "Generating…" : "+ Generate"}
      </Text>
    </TouchableOpacity>
  ) : undefined;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Panel title="Care Brief" action={generateAction}>
        <Text style={styles.subtitle}>
          Generate a shareable summary for doctors and care providers.
        </Text>

        {error != null && <Text style={styles.error}>{error}</Text>}

        {briefs.length === 0 && !error && (
          <Text style={styles.empty}>No briefs generated yet.</Text>
        )}

        {briefs.map((brief) => {
          const url = `${API_URL}/brief/${brief.shareToken}`;
          return (
            <View key={brief.shareToken} style={styles.card}>
              <Text style={styles.cardDate}>
                {formatDate(brief.generatedAt)}
              </Text>
              <Text style={styles.cardUrl} numberOfLines={2} selectable>
                {url}
              </Text>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.cardActionBtn}
                  onPress={() => handleCopy(url)}
                  accessibilityRole="button"
                  accessibilityLabel="Copy care brief link"
                >
                  <Text style={styles.cardActionBtnText}>Copy link</Text>
                </TouchableOpacity>
                {isCoordinator && (
                  <TouchableOpacity
                    style={[styles.cardActionBtn, styles.revokeBtn]}
                    onPress={() => handleRevoke(brief.shareToken)}
                    accessibilityRole="button"
                    accessibilityLabel="Revoke care brief"
                  >
                    <Text
                      style={[styles.cardActionBtnText, styles.revokeBtnText]}
                    >
                      Revoke
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </Panel>
    </ScrollView>
  );
}
