import { useState } from "react";
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

  async function handleSubmit() {
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
              const colors = MOOD_COLORS[m];
              const active = mood === m;
              return (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.optionBtn,
                    { borderColor: active ? colors.text : "#e5e7eb" },
                    active && { backgroundColor: colors.bg },
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
                      active && { color: colors.text },
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  backBtn: { padding: 16, paddingBottom: 0 },
  backText: { fontSize: 15, color: "#0369a1" },
  stepLabel: {
    paddingHorizontal: 16,
    paddingTop: 8,
    fontSize: 12,
    color: "#9ca3af",
  },
  stepContent: { padding: 16, flex: 1 },
  question: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 20,
  },
  numberRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  numberBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    justifyContent: "center",
    alignItems: "center",
  },
  numberActive: { borderColor: "#0369a1", backgroundColor: "#eff6ff" },
  numberText: { fontSize: 16, color: "#374151" },
  numberTextActive: { color: "#0369a1", fontWeight: "700" },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  optionBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  optionActive: { borderColor: "#0369a1", backgroundColor: "#eff6ff" },
  optionText: { fontSize: 15, color: "#374151" },
  optionTextActive: { color: "#0369a1", fontWeight: "600" },
  skipBtn: { marginTop: 20, alignSelf: "flex-start" },
  skipText: { fontSize: 14, color: "#9ca3af" },
  nextBtn: {
    backgroundColor: "#0369a1",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  nextText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  notesInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  submitBtn: {
    backgroundColor: "#0369a1",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
