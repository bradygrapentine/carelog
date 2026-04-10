import { View, Text, StyleSheet } from "react-native";

export default function TeamScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Team — loading…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  text: { color: "#9ca3af", fontSize: 15 },
});
