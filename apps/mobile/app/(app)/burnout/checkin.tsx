import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "../../../utils/trpc";
import { useApp } from "../../../context/AppContext";
import { getSession } from "../../../utils/auth";

const QUESTIONS = [
  "How's your sleep?",
  "How's your stress?",
  "Do you feel supported?",
];

function currentWeekStamp(): string {
  const d = new Date();
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const dayOfYear = Math.ceil(
    (d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000,
  );
  const weekNum = Math.ceil((dayOfYear + (jan4.getDay() || 7) - 1) / 7);
  const padded = String(weekNum).padStart(2, "0");
  return d.getFullYear() + "-W" + padded;
}

export default function BurnoutCheckinScreen() {
  const router = useRouter();
  const { orgId } = useApp();
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<(number | null)[]>([null, null, null]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const checkInMut = trpc.burnout.checkIn.useMutation({
    onSuccess: () => router.back(),
    onError: (err) => Alert.alert("Error", err.message),
  });

  function selectScore(value: number) {
    const next = [...scores];
    next[step] = value;
    setScores(next);
    if (step < 2) setStep(step + 1);
    else setStep(3);
  }

  async function handleSubmit() {
    if (!orgId) return;
    const session = await getSession();
    if (!session) return;
    setSubmitting(true);
    try {
      await checkInMut.mutateAsync({
        org_id: orgId,
        user_id: session.user.id,
        sleep_score: scores[0] ?? 3,
        stress_score: scores[1] ?? 3,
        support_score: scores[2] ?? 3,
        notes: notes.trim() || undefined,
        week_stamp: currentWeekStamp(),
      });
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

      <Text style={styles.stepLabel}>Step {Math.min(step + 1, 4)} of 4</Text>

      {step < 3 && (
        <View style={styles.stepContent}>
          <Text style={styles.question}>{QUESTIONS[step]}</Text>
          <View style={styles.scaleRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity
                key={n}
                style={[
                  styles.scaleBtn,
                  scores[step] === n && styles.scaleActive,
                ]}
                onPress={() => selectScore(n)}
                accessibilityRole="button"
                accessibilityLabel={"Score " + n + " of 5"}
              >
                <Text
                  style={[
                    styles.scaleText,
                    scores[step] === n && styles.scaleTextActive,
                  ]}
                >
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.scaleLabels}>
            <Text style={styles.scaleLabelText}>Struggling</Text>
            <Text style={styles.scaleLabelText}>Great</Text>
          </View>
        </View>
      )}

      {step === 3 && (
        <View style={styles.stepContent}>
          <Text style={styles.question}>Anything else? (optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="How you're really doing…"
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel={submitting ? "Saving" : "Submit check-in"}
          >
            <Text style={styles.submitText}>
              {submitting ? "Saving…" : "Submit"}
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
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 32,
  },
  scaleRow: { flexDirection: "row", justifyContent: "center", gap: 12 },
  scaleBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    justifyContent: "center",
    alignItems: "center",
  },
  scaleActive: { borderColor: "#0369a1", backgroundColor: "#eff6ff" },
  scaleText: { fontSize: 20, color: "#374151", fontWeight: "600" },
  scaleTextActive: { color: "#0369a1" },
  scaleLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingHorizontal: 4,
  },
  scaleLabelText: { fontSize: 12, color: "#9ca3af" },
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
