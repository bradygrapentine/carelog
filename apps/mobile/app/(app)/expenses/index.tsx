import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "../../../utils/trpc";
import { useApp } from "../../../context/AppContext";
import {
  formatCurrency,
  canLogExpense,
  canDeleteExpense,
} from "../../../utils/wave5Utils";

type Expense = {
  id: string;
  amount: number;
  category: string;
  description: string;
  incurred_at: string;
};

function groupByMonth(
  expenses: Expense[],
): { title: string; data: Expense[] }[] {
  const groups = new Map<string, Expense[]>();
  for (const e of expenses) {
    const d = new Date(e.incurred_at);
    const key = d.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    const arr = groups.get(key) ?? [];
    arr.push(e);
    groups.set(key, arr);
  }
  return Array.from(groups, ([title, data]) => ({ title, data }));
}

const CATEGORY_LABELS: Record<string, string> = {
  medication: "Medication",
  supplies: "Supplies",
  equipment: "Equipment",
  home_modification: "Home mod",
  aide_hours: "Aide hours",
  transport: "Transport",
  food: "Food",
  other: "Other",
};

export default function ExpensesScreen() {
  const router = useRouter();
  const { orgId, recipientId, currentRole } = useApp();

  const { data, isLoading, refetch } = trpc.expenses.list.useQuery(
    { org_id: orgId ?? "", recipient_id: recipientId ?? "" },
    { enabled: !!orgId && !!recipientId },
  );

  const deleteMut = trpc.expenses.delete.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => Alert.alert("Error", err.message),
  });

  function confirmDelete(id: string) {
    Alert.alert("Delete expense?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteMut.mutate({ id, org_id: orgId ?? "" }),
      },
    ]);
  }

  const sections = groupByMonth((data as Expense[]) ?? []);

  return (
    <View style={styles.container}>
      {canLogExpense(currentRole) && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push("/expenses/add")}
          accessibilityRole="button"
          accessibilityLabel="Add expense"
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#0369a1" />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onLongPress={
                canDeleteExpense(currentRole)
                  ? () => confirmDelete(item.id)
                  : undefined
              }
              activeOpacity={canDeleteExpense(currentRole) ? 0.6 : 1}
              accessibilityRole="button"
              accessibilityLabel={
                formatCurrency(item.amount) +
                " " +
                item.description +
                (canDeleteExpense(currentRole) ? ", long press to delete" : "")
              }
            >
              <View style={styles.rowLeft}>
                <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
                <View style={styles.catBadge}>
                  <Text style={styles.catText}>
                    {CATEGORY_LABELS[item.category] ?? item.category}
                  </Text>
                </View>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.desc} numberOfLines={1}>
                  {item.description}
                </Text>
                <Text style={styles.date}>
                  {new Date(item.incurred_at).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No expenses logged yet.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  loader: { marginTop: 48 },
  list: { padding: 16, paddingBottom: 80 },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6b7280",
    marginTop: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  amount: { fontSize: 16, fontWeight: "700", color: "#111827" },
  catBadge: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  catText: { fontSize: 11, color: "#374151" },
  rowRight: { alignItems: "flex-end", flex: 1, marginLeft: 12 },
  desc: { fontSize: 13, color: "#374151" },
  date: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  empty: { color: "#9ca3af", textAlign: "center", marginTop: 48 },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#0369a1",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 10,
  },
  fabText: { color: "#fff", fontSize: 28, lineHeight: 30 },
});
