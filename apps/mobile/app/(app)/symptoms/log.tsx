import { useState, useMemo } from "react";
import { haptics } from "../../../utils/haptics";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useApp } from "../../../context/AppContext";
import { useOfflineWrite } from "../../../hooks/useOfflineWrite";
import {
  APPETITE_OPTIONS,
  MOBILITY_OPTIONS,
  type Appetite,
  type Mobility,
} from "../../../utils/wave5Utils";
import { MOOD_COLORS, type Mood } from "../../../utils/journalUtils";
import { useAppTheme } from "../../../hooks/useAppTheme";

const MOODS: Mood[] = ["good", "okay", "difficult", "crisis"];

export default function SymptomLogScreen() {
  const router = useRouter();
  const { orgId, recipientId } = useApp();
  const { write } = useOfflineWrite(orgId ?? "");
  const [step, setStep] = useState(0);
  const [pain, setPain] = useState<number | null>(null);
  const [mood, setMood] = useState<Mood | null>(null);
  const [appetite, setAppetite] = useState<Appetite | null>(null);
  const [mobility, setMobility] = useState<Mobility | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { colors, spacing, radii } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.surfaceRaised },
        backBtn: { padding: spacing.lg, paddingBottom: 0 },
        backText: { fontSize: 15, color: colors.primary },
        stepLabel: {
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          fontSize: 12,
          color: colors.mutedLight,
        },
        stepContent: { padding: spacing.lg, flex: 1 },
        question: {
          fontSize: 20,
          fontWeight: "700",
          color: colors.textPrimary,
          marginBottom: 20,
        },
        numberRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
        numberBtn: {
          width: 44,
          height: 44,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: colors.borderNeutral,
          justifyContent: "center",
          alignItems: "center",
        },
        numberActive: {
          borderColor: colors.primary,
          backgroundColor: colors.primarySubtle,
        },
        numberText: { fontSize: 16, color: colors.textSecondary },
        numberTextActive: { color: colors.primary, fontWeight: "700" },
        optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
        optionBtn: {
          paddingHorizontal: 18,
          paddingVertical: 10,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.borderNeutral,
        },
        optionActive: {
          borderColor: colors.primary,
          backgroundColor: colors.primarySubtle,
        },
        optionText: { fontSize: 15, color: colors.textSecondary },
        optionTextActive: { color: colors.primary, fontWeight: "600" },
        skipBtn: { marginTop: 20, alignSelf: "flex-start" },
        skipText: { fontSize: 14, color: colors.mutedLight },
        nextBtn: {
          backgroundColor: colors.primary,
          borderRadius: radii.md,
          padding: 14,
          alignItems: "center",
        },
        nextText: { color: colors.white, fontWeight: "600", fontSize: 15 },
        notesInput: {
          borderWidth: 1,
          borderColor: colors.borderNeutral,
          borderRadius: radii.md,
          padding: spacing.md,
          fontSize: 15,
          minHeight: 100,
          textAlignVertical: "top",
          marginBottom: 20,
        },
        submitBtn: {
          backgroundColor: colors.primary,
          borderRadius: radii.md,
          padding: 14,
          alignItems: "center",
        },
        submitDisabled: { opacity: 0.4 },
        submitText: { color: colors.white, fontWeight: "600", fontSize: 15 },
      }),
    [colors, spacing, radii],
  );

  async function handleSubmit() {
    haptics.tap();
    if (!orgId || !recipientId) return;
    setSubmitting(true);
    try {
      await write({
        event_type: "symptom",
        entry_kind: "symptom_reading",
        payload: {
          pain_level: pain ?? undefined,
          mood: mood ?? undefined,
          appetite: appetite ?? undefined,
          mobility: mobility ?? undefined,
          notes: notes.trim() || undefined,
        },
        recipient_id: recipientId,
      });
      router.back();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
    }
  }

  function goBack() {
    if (step === 0) router.back();
    else setStep(step - 1);
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={goBack}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel={step === 0 ? "Cancel" : "Previous step"}
      >
        <Text style={styles.backText}>← {step === 0 ? "Cancel" : "Back"}</Text>
      </TouchableOpacity>

      <Text style={styles.stepLabel}>Step {step + 1} of 4</Text>

      {step === 0 && (
        <View style={styles.stepContent}>
          <Text style={styles.question}>Pain level (0-10)</Text>
          <View style={styles.numberRow}>
            {Array.from({ length: 11 }, (_, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.numberBtn, pain === i && styles.numberActive]}
                onPress={() => {
                  setPain(i);
                  setStep(1);
                }}
                accessibilityRole="button"
                accessibilityLabel={"Pain level " + i}
              >
                <Text
                  style={[
                    styles.numberText,
                    pain === i && styles.numberTextActive,
                  ]}
                >
                  {i}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => setStep(1)}
            accessibilityRole="button"
            accessibilityLabel="Skip pain level"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 1 && (
        <View style={styles.stepContent}>
          <Text style={styles.question}>How are they feeling?</Text>
          <View style={styles.optionRow}>
            {MOODS.map((m) => {
              const moodColors = MOOD_COLORS[m];
              const active = mood === m;
              return (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.optionBtn,
                    {
                      borderColor: active
                        ? moodColors.text
                        : colors.borderNeutral,
                    },
                    active && { backgroundColor: moodColors.bg },
                  ]}
                  onPress={() => {
                    setMood(m);
                    setStep(2);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={m + " mood"}
                >
                  <Text
                    style={[
                      styles.optionText,
                      active && { color: moodColors.text },
                    ]}
                  >
                    {m}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => setStep(2)}
            accessibilityRole="button"
            accessibilityLabel="Skip mood"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 2 && (
        <ScrollView style={styles.stepContent}>
          <Text style={styles.question}>Appetite</Text>
          <View style={styles.optionRow}>
            {APPETITE_OPTIONS.map((o) => (
              <TouchableOpacity
                key={o.key}
                style={[
                  styles.optionBtn,
                  appetite === o.key && styles.optionActive,
                ]}
                onPress={() => setAppetite(o.key)}
                accessibilityRole="button"
                accessibilityLabel={o.label + " appetite"}
              >
                <Text
                  style={[
                    styles.optionText,
                    appetite === o.key && styles.optionTextActive,
                  ]}
                >
                  {o.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.question, { marginTop: 24 }]}>Mobility</Text>
          <View style={styles.optionRow}>
            {MOBILITY_OPTIONS.map((o) => (
              <TouchableOpacity
                key={o.key}
                style={[
                  styles.optionBtn,
                  mobility === o.key && styles.optionActive,
                ]}
                onPress={() => setMobility(o.key)}
                accessibilityRole="button"
                accessibilityLabel={o.label + " mobility"}
              >
                <Text
                  style={[
                    styles.optionText,
                    mobility === o.key && styles.optionTextActive,
                  ]}
                >
                  {o.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.nextBtn, { marginTop: 24 }]}
            onPress={() => setStep(3)}
            accessibilityRole="button"
            accessibilityLabel="Next step"
          >
            <Text style={styles.nextText}>Next</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {step === 3 && (
        <View style={styles.stepContent}>
          <Text style={styles.question}>Notes (optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Any additional observations…"
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel={submitting ? "Saving" : "Save symptoms"}
          >
            <Text style={styles.submitText}>
              {submitting ? "Saving…" : "Save"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
