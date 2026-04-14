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
import * as SecureStore from "expo-secure-store";
import { supabase } from "../../utils/supabase";
import { colors, spacing, radii } from "../../constants/tokens";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email: trimmed });
    setLoading(false);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    await SecureStore.setItemAsync("pending_email", trimmed);
    router.push("/(auth)/verify");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in to Carelog</Text>
      <Text style={styles.subtitle}>
        We'll send a 6-digit code to your email.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="your@email.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoFocus
      />
      <TouchableOpacity
        style={styles.button}
        onPress={handleSubmit}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={loading ? "Sending code" : "Send code"}
      >
        <Text style={styles.buttonText}>
          {loading ? "Sending…" : "Send code"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xxl,
    backgroundColor: colors.surfaceRaised,
  },
  title: { fontSize: 24, fontWeight: "700", marginBottom: spacing.sm },
  subtitle: { fontSize: 15, color: colors.muted, marginBottom: 32 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: radii.md,
    padding: 14,
    fontSize: 16,
    marginBottom: spacing.lg,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: 14,
    alignItems: "center",
  },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: "600" },
});
