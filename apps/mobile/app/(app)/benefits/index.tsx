import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
} from "react-native";
import { trpc } from "../../../utils/trpc";
import { useApp } from "../../../context/AppContext";

type Answers = {
  age65plus: boolean;
  veteran: boolean;
  lowIncome: boolean;
  medicareEnrolled: boolean;
  medicaidEnrolled: boolean;
};

type Program = {
  key: string;
  name: string;
  description: string;
  applyUrl: string;
};

const ALL_PROGRAMS: Program[] = [
  {
    key: "medicaid_waiver",
    name: "Medicaid HCBS Waiver",
    description:
      "Home and community-based services for low-income individuals not on Medicaid.",
    applyUrl:
      "https://www.medicaid.gov/medicaid/home-community-based-services/index.html",
  },
  {
    key: "snap",
    name: "SNAP Food Benefits",
    description: "Supplemental nutrition assistance for low-income households.",
    applyUrl: "https://www.fns.usda.gov/snap/apply",
  },
  {
    key: "medicare_savings",
    name: "Medicare Savings Program",
    description: "Helps pay Medicare premiums, deductibles, and copayments.",
    applyUrl:
      "https://www.medicare.gov/basics/costs/help/medicare-savings-programs",
  },
  {
    key: "va_caregiver",
    name: "VA Caregiver Support",
    description: "Support services for veterans and their family caregivers.",
    applyUrl: "https://www.caregiver.va.gov/",
  },
  {
    key: "pace",
    name: "PACE Program",
    description: "All-inclusive care for elderly Medicare/Medicaid enrollees.",
    applyUrl: "https://www.medicaid.gov/medicaid/ltss/pace/index.html",
  },
];

function computeEligible(answers: Answers): Program[] {
  return ALL_PROGRAMS.filter((p) => {
    if (p.key === "medicaid_waiver")
      return answers.lowIncome && !answers.medicaidEnrolled;
    if (p.key === "snap") return answers.lowIncome;
    if (p.key === "medicare_savings")
      return answers.age65plus && answers.medicareEnrolled && answers.lowIncome;
    if (p.key === "va_caregiver") return answers.veteran;
    if (p.key === "pace") return answers.age65plus && answers.medicareEnrolled;
    return false;
  });
}

const QUESTIONS: { key: keyof Answers; label: string }[] = [
  { key: "age65plus", label: "Age 65 or older" },
  { key: "veteran", label: "Veteran or surviving spouse" },
  { key: "lowIncome", label: "Low income household" },
  { key: "medicareEnrolled", label: "Currently enrolled in Medicare" },
  { key: "medicaidEnrolled", label: "Currently enrolled in Medicaid" },
];

export default function BenefitsScreen() {
  const { orgId, recipientId, currentRole } = useApp();

  const [answers, setAnswers] = useState<Answers>({
    age65plus: false,
    veteran: false,
    lowIncome: false,
    medicareEnrolled: false,
    medicaidEnrolled: false,
  });
  const [results, setResults] = useState<Program[] | null>(null);

  const screenMut = trpc.benefits.screen.useMutation();
  trpc.benefits.latest.useQuery(
    { org_id: orgId ?? "", recipient_id: recipientId ?? "" },
    { enabled: !!orgId && !!recipientId },
  );

  if (currentRole !== "coordinator") {
    return (
      <View style={styles.locked}>
        <Text style={styles.lockedText}>
          Benefits screening is available to coordinators only.
        </Text>
      </View>
    );
  }

  function toggle(key: keyof Answers) {
    setAnswers((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSubmit() {
    const eligible = computeEligible(answers);
    const orgIdVal = orgId ?? "";
    const recipientIdVal = recipientId ?? "";
    const answersSnapshot = { ...answers };
    const resultsSnapshot = [...eligible];
    setResults(eligible);
    screenMut.mutate({
      org_id: orgIdVal,
      recipient_id: recipientIdVal,
      answers: answersSnapshot,
      results: resultsSnapshot,
    });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Benefits Eligibility Screener</Text>
      <Text style={styles.subheading}>
        Answer the questions below to find programs your care recipient may
        qualify for.
      </Text>

      {QUESTIONS.map(({ key, label }) => (
        <TouchableOpacity
          key={key}
          style={styles.checkRow}
          onPress={() => toggle(key)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: answers[key] }}
        >
          <View
            style={[styles.checkbox, answers[key] && styles.checkboxChecked]}
          >
            {answers[key] && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkLabel}>{label}</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        style={styles.submitBtn}
        onPress={handleSubmit}
        disabled={screenMut.isPending}
        accessibilityRole="button"
      >
        {screenMut.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitBtnText}>Check Eligibility</Text>
        )}
      </TouchableOpacity>

      {results !== null && (
        <View style={styles.results}>
          <Text style={styles.resultsHeading}>
            {results.length === 0
              ? "No programs matched"
              : `${results.length} program${results.length === 1 ? "" : "s"} matched`}
          </Text>
          {results.map((program) => (
            <View key={program.key} style={styles.card}>
              <Text style={styles.cardName}>{program.name}</Text>
              <Text style={styles.cardDesc}>{program.description}</Text>
              <TouchableOpacity
                onPress={() => Linking.openURL(program.applyUrl)}
                accessibilityRole="link"
              >
                <Text style={styles.cardLink}>Learn more →</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16 },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  subheading: { fontSize: 14, color: "#6b7280", marginBottom: 20 },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: "#d1d5db",
    borderRadius: 4,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: "#0369a1", borderColor: "#0369a1" },
  checkmark: { color: "#fff", fontSize: 14, fontWeight: "700" },
  checkLabel: { fontSize: 15, color: "#374151" },
  submitBtn: {
    marginTop: 24,
    backgroundColor: "#0369a1",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  submitBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  results: { marginTop: 28 },
  resultsHeading: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  cardDesc: { fontSize: 13, color: "#6b7280", marginBottom: 8 },
  cardLink: { fontSize: 13, color: "#0369a1", fontWeight: "500" },
  locked: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  lockedText: { fontSize: 15, color: "#6b7280", textAlign: "center" },
});
