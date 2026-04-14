import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { haptics } from "../../../utils/haptics";
import { useRouter } from "expo-router";
import { trpc } from "../../../utils/trpc";
import { useApp } from "../../../context/AppContext";
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
} from "../../../utils/wave5Utils";
import { useAppTheme } from "../../../hooks/useAppTheme";

export default function ExpenseAddScreen() {
  const router = useRouter();
  const { orgId, recipientId } = useApp();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("medication");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { colors, spacing, radii } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.surfaceRaised },
        content: { padding: spacing.lg },
        backBtn: { marginBottom: spacing.sm },
        backText: { fontSize: 15, color: colors.primary },
        heading: {
          fontSize: 22,
          fontWeight: "700",
          color: colors.textPrimary,
          marginBottom: spacing.xl,
        },
        label: {
          fontSize: 13,
          fontWeight: "600",
          color: colors.muted,
          marginBottom: 6,
          marginTop: spacing.lg,
        },
        amountInput: {
          fontSize: 32,
          fontWeight: "700",
          color: colors.textPrimary,
          borderBottomWidth: 2,
          borderBottomColor: colors.borderNeutral,
          paddingVertical: spacing.sm,
        },
        chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
        chip: {
          paddingHorizontal: 14,
          paddingVertical: spacing.sm,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.borderNeutral,
        },
        chipActive: {
          borderColor: colors.primary,
          backgroundColor: colors.primarySubtle,
        },
        chipText: { fontSize: 13, color: colors.textSecondary },
        chipTextActive: { color: colors.primary, fontWeight: "600" },
        input: {
          borderWidth: 1,
          borderColor: colors.borderNeutral,
          borderRadius: radii.md,
          padding: spacing.md,
          fontSize: 15,
        },
        dateBtn: {
          borderWidth: 1,
          borderColor: colors.borderNeutral,
          borderRadius: radii.md,
          padding: spacing.md,
        },
        dateText: { fontSize: 15, color: colors.textPrimary },
        submitBtn: {
          backgroundColor: colors.primary,
          borderRadius: radii.md,
          padding: 14,
          alignItems: "center",
          marginTop: 24,
        },
        submitDisabled: { opacity: 0.4 },
        submitText: { color: colors.white, fontWeight: "600", fontSize: 15 },
      }),
    [colors, spacing, radii],
  );

  const createMut = trpc.expenses.create.useMutation({
    onSuccess: () => router.back(),
    onError: (err) => Alert.alert("Error", err.message),
  });

  const numericAmount = parseFloat(amount.replace(/[^0-9.]/g, ""));
  const valid =
    !isNaN(numericAmount) && numericAmount > 0 && description.trim();

  async function handleSubmit() {
    haptics.tap();
    if (!valid || !orgId || !recipientId) return;
    setSubmitting(true);
    try {
      await createMut.mutateAsync({
        org_id: orgId,
        recipient_id: recipientId,
        amount: numericAmount,
        category,
        description: description.trim(),
        incurred_at: date.toISOString().split("T")[0],
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
      >
        <Text style={styles.backText}>← Cancel</Text>
      </TouchableOpacity>

      <Text style={styles.heading}>Log expense</Text>

      <Text style={styles.label}>Amount</Text>
      <TextInput
        style={styles.amountInput}
        placeholder="$0.00"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>Category</Text>
      <View style={styles.chipRow}>
        {EXPENSE_CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c.key}
            style={[styles.chip, category === c.key && styles.chipActive]}
            onPress={() => setCategory(c.key)}
            accessibilityRole="button"
            accessibilityLabel={c.label + " category"}
          >
            <Text
              style={[
                styles.chipText,
                category === c.key && styles.chipTextActive,
              ]}
            >
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={styles.input}
        placeholder="What was this for?"
        value={description}
        onChangeText={setDescription}
        maxLength={200}
      />

      <Text style={styles.label}>Date</Text>
      <TouchableOpacity
        style={styles.dateBtn}
        onPress={() => setShowDatePicker(true)}
        accessibilityRole="button"
        accessibilityLabel="Select date"
      >
        <Text style={styles.dateText}>
          {date.toLocaleDateString([], {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </Text>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          maximumDate={new Date()}
          onChange={(_, d) => {
            setShowDatePicker(Platform.OS === "ios");
            if (d) setDate(d);
          }}
        />
      )}

      <TouchableOpacity
        style={[
          styles.submitBtn,
          (!valid || submitting) && styles.submitDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!valid || submitting}
        accessibilityRole="button"
        accessibilityLabel={submitting ? "Saving" : "Save expense"}
      >
        <Text style={styles.submitText}>
          {submitting ? "Saving…" : "Save expense"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
