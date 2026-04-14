import { useState, useEffect, useMemo } from "react";
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
import { useAppTheme } from "../../hooks/useAppTheme";

export default function VerifyScreen() {
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { colors, spacing, radii } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
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
          fontSize: 24,
          letterSpacing: 8,
          textAlign: "center",
          marginBottom: spacing.lg,
        },
        button: {
          backgroundColor: colors.primary,
          borderRadius: radii.md,
          padding: 14,
          alignItems: "center",
        },
        buttonText: { color: colors.white, fontSize: 16, fontWeight: "600" },
        back: { marginTop: spacing.lg, alignItems: "center" },
        backText: { color: colors.muted, fontSize: 14 },
      }),
    [colors, spacing, radii],
  );

  useEffect(() => {
    SecureStore.getItemAsync("pending_email").then((e) => {
      if (e) setEmail(e);
    });
  }, []);

  async function handleVerify() {
    if (code.length !== 6) return;

    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    setLoading(false);

    if (error) {
      Alert.alert("Invalid code", "Please check the code and try again.");
      return;
    }

    await SecureStore.deleteItemAsync("pending_email");

    const pendingInvite = await SecureStore.getItemAsync(
      "pending_invite_token",
    );
    if (pendingInvite) {
      router.replace({
        pathname: "/(app)/invite/[token]",
        params: { token: pendingInvite },
      });
    } else {
      router.replace("/(app)");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Check your email</Text>
      <Text style={styles.subtitle}>
        Enter the 6-digit code sent to {email}
      </Text>
      <TextInput
        style={styles.input}
        placeholder="123456"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
      />
      <TouchableOpacity
        style={styles.button}
        onPress={handleVerify}
        disabled={loading || code.length !== 6}
        accessibilityRole="button"
        accessibilityLabel={loading ? "Verifying" : "Verify code"}
      >
        <Text style={styles.buttonText}>
          {loading ? "Verifying…" : "Verify"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.back}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Use a different email"
      >
        <Text style={styles.backText}>← Use a different email</Text>
      </TouchableOpacity>
    </View>
  );
}
