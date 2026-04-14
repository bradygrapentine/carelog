import { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getSession } from "../../../../utils/auth";
import { useAppTheme } from "../../../../hooks/useAppTheme";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

const DOC_TYPE_LABELS: Record<string, string> = {
  lab_result: "Lab Result",
  appointment_summary: "Appointment Summary",
  bill: "Bill",
  pharmacy_receipt: "Pharmacy Receipt",
};

type OcrField = {
  label: string;
  value: string;
  type: "text" | "number" | "date" | "currency";
  confidence: number;
};

type ParsedData = {
  document_type: string;
  fields: OcrField[];
};

type OcrJob = {
  id: string;
  status: string;
  parsed_data: ParsedData | null;
};

export default function OcrReviewScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const [job, setJob] = useState<OcrJob | null>(null);
  const [fields, setFields] = useState<OcrField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { colors, spacing, radii } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.surfaceRaised },
        content: { padding: spacing.xl, paddingBottom: 40 },
        center: { flex: 1, alignItems: "center", justifyContent: "center" },
        header: { marginBottom: 24 },
        badge: {
          alignSelf: "flex-start",
          paddingHorizontal: spacing.md,
          paddingVertical: 4,
          borderRadius: radii.md,
          backgroundColor: colors.primarySubtle,
        },
        badgeText: { fontSize: 13, fontWeight: "600", color: colors.primary },
        fieldRow: { marginBottom: spacing.lg },
        labelRow: {
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 6,
          gap: 6,
        },
        label: { fontSize: 13, color: colors.muted, fontWeight: "500" },
        lowConfidenceDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.warning,
        },
        input: {
          borderWidth: 1,
          borderColor: colors.borderNeutral,
          borderRadius: radii.md,
          padding: 10,
          fontSize: 15,
          color: colors.textPrimary,
        },
        saveButton: {
          marginTop: 24,
          padding: spacing.lg,
          borderRadius: radii.lg,
          backgroundColor: colors.primary,
          alignItems: "center",
        },
        saveButtonDisabled: { backgroundColor: colors.primaryLight },
        saveButtonText: {
          color: colors.white,
          fontWeight: "600",
          fontSize: 16,
        },
      }),
    [colors, spacing, radii],
  );

  useEffect(() => {
    loadJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  async function loadJob() {
    try {
      const session = await getSession();
      const res = await fetch(API_URL + "/api/ocr/job/" + jobId, {
        headers: { Authorization: "Bearer " + session?.access_token },
      });
      if (!res.ok) throw new Error("Failed to load job");
      const data = await res.json();
      setJob(data.job);
      setFields(data.job.parsed_data?.fields ?? []);
    } catch (e: unknown) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Could not load scan",
      );
    } finally {
      setLoading(false);
    }
  }

  function updateField(index: number, value: string) {
    setFields((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], value };
      return next;
    });
  }

  async function save() {
    if (!jobId || fields.length === 0) return;
    setSaving(true);
    try {
      const session = await getSession();
      const res = await fetch(API_URL + "/api/ocr/save-fields", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + session?.access_token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobId, fields }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Save failed" }));
        throw new Error(err.error ?? "Save failed");
      }
      Alert.alert("Saved", "Document fields have been saved.", [
        { text: "OK", onPress: () => router.replace("/(app)/documents") },
      ]);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const docType = job?.parsed_data?.document_type ?? "bill";
  const badgeLabel = DOC_TYPE_LABELS[docType] ?? docType;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeLabel}</Text>
        </View>
      </View>

      {fields.map((field, i) => (
        <View key={field.label + i} style={styles.fieldRow}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{field.label}</Text>
            {field.confidence < 0.8 && (
              <View
                testID={"low-confidence-" + field.label}
                style={styles.lowConfidenceDot}
              />
            )}
          </View>
          <TextInput
            style={styles.input}
            value={field.value}
            onChangeText={(v) => updateField(i, v)}
            keyboardType={
              field.type === "number" || field.type === "currency"
                ? "decimal-pad"
                : "default"
            }
          />
        </View>
      ))}

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={save}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel={saving ? "Saving" : "Save document fields"}
      >
        {saving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.saveButtonText}>Save</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}
