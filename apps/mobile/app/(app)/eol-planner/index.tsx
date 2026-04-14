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
import { colors, spacing, radii } from "../../../constants/tokens";
import { Panel } from "../../../components/Panel";

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

  const saveAction = (
    <TouchableOpacity
      onPress={handleSave}
      disabled={upsertMut.isPending}
      accessibilityRole="button"
    >
      <Text
        style={[
          styles.actionBtnText,
          upsertMut.isPending && styles.actionBtnDisabled,
        ]}
      >
        {upsertMut.isPending ? "Saving…" : "Save"}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Panel title="End-of-Life Planner" action={saveAction}>
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
      </Panel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, paddingBottom: 40 },
  actionBtnText: { fontSize: 13, color: colors.primary, fontWeight: "600" },
  actionBtnDisabled: { color: colors.mutedLight },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 4,
    marginTop: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceSubtle,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
  },
  lockedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  lockedText: {
    fontSize: 16,
    color: colors.muted,
    textAlign: "center",
  },
});
