import { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useApp } from "../../../context/AppContext";
import { trpc } from "../../../utils/trpc";

export default function EolPlannerScreen() {
  const { orgId, recipientId, currentRole } = useApp();

  const [healthcareProxy, setHealthcareProxy] = useState("");
  const [resuscitationPref, setResuscitationPref] = useState("");
  const [funeralPref, setFuneralPref] = useState("");
  const [legacyMessage, setLegacyMessage] = useState("");
  const [attorneyName, setAttorneyName] = useState("");
  const [attorneyContact, setAttorneyContact] = useState("");
  const [organDonation, setOrganDonation] = useState(false);

  const { data: existing } = trpc.eolPlan.get.useQuery(
    { org_id: orgId ?? "", recipient_id: recipientId ?? "" },
    { enabled: !!orgId && !!recipientId && currentRole === "coordinator" },
  );

  const upsertMut = trpc.eolPlan.upsert.useMutation({
    onSuccess: () => Alert.alert("Saved"),
    onError: (err) => Alert.alert("Error", err.message),
  });

  useEffect(() => {
    if (existing) {
      setHealthcareProxy(existing.healthcare_proxy ?? "");
      setResuscitationPref(existing.resuscitation_pref ?? "");
      setFuneralPref(existing.funeral_pref ?? "");
      setLegacyMessage(existing.legacy_message ?? "");
      setAttorneyName(existing.attorney_name ?? "");
      setAttorneyContact(existing.attorney_contact ?? "");
    }
  }, [existing]);

  if (currentRole !== "coordinator") {
    return (
      <View style={styles.lockedContainer}>
        <Text style={styles.lockedText}>
          End-of-life planning is only accessible to coordinators.
        </Text>
      </View>
    );
  }

  function handleSave() {
    const hp = healthcareProxy;
    const rp = resuscitationPref;
    const fp = funeralPref;
    const lm = legacyMessage;
    const an = attorneyName;
    const ac = attorneyContact;

    upsertMut.mutate({
      org_id: orgId ?? "",
      recipient_id: recipientId ?? "",
      healthcare_proxy: hp || undefined,
      resuscitation_pref:
        (rp as "full" | "dnr" | "dnr_comfort_only") || undefined,
      funeral_pref: fp || undefined,
      legacy_message: lm || undefined,
      attorney_name: an || undefined,
      attorney_contact: ac || undefined,
    });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>End-of-Life Planner</Text>

      <Text style={styles.label}>Healthcare Proxy Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Healthcare proxy name"
        value={healthcareProxy}
        onChangeText={setHealthcareProxy}
      />

      <Text style={styles.label}>Resuscitation Preference</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. full, dnr, dnr_comfort_only"
        value={resuscitationPref}
        onChangeText={setResuscitationPref}
      />

      <Text style={styles.label}>Funeral Preferences</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Funeral preferences"
        value={funeralPref}
        onChangeText={setFuneralPref}
        multiline
      />

      <Text style={styles.label}>Legacy Message</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Legacy message"
        value={legacyMessage}
        onChangeText={setLegacyMessage}
        multiline
      />

      <Text style={styles.label}>Attorney Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Attorney name"
        value={attorneyName}
        onChangeText={setAttorneyName}
      />

      <Text style={styles.label}>Attorney Contact</Text>
      <TextInput
        style={styles.input}
        placeholder="Attorney contact"
        value={attorneyContact}
        onChangeText={setAttorneyContact}
      />

      <View style={styles.switchRow}>
        <Text style={styles.label}>Organ Donation</Text>
        <Switch value={organDonation} onValueChange={setOrganDonation} />
      </View>

      <TouchableOpacity
        style={styles.saveBtn}
        onPress={handleSave}
        disabled={upsertMut.isPending}
        accessibilityRole="button"
      >
        <Text style={styles.saveBtnText}>Save</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 20,
    color: "#111827",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#f9fafb",
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
  saveBtn: {
    marginTop: 28,
    backgroundColor: "#4f46e5",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  lockedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  lockedText: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
  },
});
