import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

const ITEMS = [
  { title: "Symptoms", route: "/symptoms" as const, icon: "🩺" },
  { title: "Burnout", route: "/burnout" as const, icon: "🔋" },
  { title: "Expenses", route: "/expenses" as const, icon: "💰" },
  { title: "Documents", route: "/documents" as const, icon: "📄" },
  { title: "Volunteer Requests", route: "/outer-circle" as const, icon: "🤝" },
  { title: "Care Brief", route: "/care-brief" as const, icon: "📋" },
  { title: "Benefits", route: "/benefits" as const, icon: "🏥" },
  { title: "End-of-Life", route: "/eol-planner" as const, icon: "📝" },
];

export default function MoreScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>More</Text>
      <View style={styles.grid}>
        {ITEMS.map((item) => (
          <TouchableOpacity
            key={item.route}
            style={styles.card}
            onPress={() => router.push(item.route)}
            accessibilityRole="button"
            accessibilityLabel={item.title}
          >
            <Text style={styles.icon}>{item.icon}</Text>
            <Text style={styles.label}>{item.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 20,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: "47%",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  icon: { fontSize: 28 },
  label: { fontSize: 15, fontWeight: "600", color: "#111827" },
});
