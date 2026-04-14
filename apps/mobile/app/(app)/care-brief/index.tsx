import { useState } from "react";
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
import { colors, spacing, radii } from "../../../constants/tokens";

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

  const isCoordinator = currentRole === "coordinator";

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Care Brief</Text>
      <Text style={styles.subtitle}>
        Generate a shareable summary for doctors and care providers.
      </Text>

      {isCoordinator && (
        <TouchableOpacity
          style={[styles.generateBtn, loading && styles.generateBtnDisabled]}
          onPress={handleGenerate}
          disabled={loading}
          accessibilityRole="button"
        >
          <Text style={styles.generateBtnText}>
            {loading ? "Generating…" : "Generate Care Brief"}
          </Text>
        </TouchableOpacity>
      )}

      {error != null && <Text style={styles.error}>{error}</Text>}

      {briefs.length === 0 && !error && (
        <Text style={styles.empty}>No briefs generated yet.</Text>
      )}

      {briefs.map((brief) => {
        const url = `${API_URL}/brief/${brief.shareToken}`;
        return (
          <View key={brief.shareToken} style={styles.card}>
            <Text style={styles.cardDate}>{formatDate(brief.generatedAt)}</Text>
            <Text style={styles.cardUrl} numberOfLines={2} selectable>
              {url}
            </Text>
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleCopy(url)}
                accessibilityRole="button"
              >
                <Text style={styles.actionBtnText}>Copy link</Text>
              </TouchableOpacity>
              {isCoordinator && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.revokeBtn]}
                  onPress={() => handleRevoke(brief.shareToken)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.actionBtnText, styles.revokeBtnText]}>
                    Revoke
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceRaised },
  content: { padding: spacing.lg },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: 20 },
  generateBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: 14,
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  generateBtnDisabled: { opacity: 0.6 },
  generateBtnText: { color: colors.white, fontWeight: "600", fontSize: 15 },
  error: { color: colors.danger, marginBottom: 12, fontSize: 14 },
  empty: { color: colors.mutedLight, textAlign: "center", marginTop: 48 },
  card: {
    borderWidth: 1,
    borderColor: colors.borderNeutral,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 12,
  },
  cardDate: { fontSize: 12, color: colors.mutedLight, marginBottom: 6 },
  cardUrl: { fontSize: 13, color: colors.textSecondary, marginBottom: 10 },
  cardActions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.sm,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  actionBtnText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  revokeBtn: { backgroundColor: colors.dangerPanel },
  revokeBtnText: { color: colors.danger },
});
