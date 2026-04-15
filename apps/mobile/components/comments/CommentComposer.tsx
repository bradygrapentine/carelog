// apps/mobile/components/comments/CommentComposer.tsx
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Props = { onSubmit: (body: string) => Promise<void> };

export function CommentComposer({ onSubmit }: Props) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const trimmed = body.trim();
  const canSubmit = !busy && trimmed.length > 0 && body.length <= 4000;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <TextInput
        accessibilityLabel="Add a comment"
        placeholder="Add a comment…"
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={4000}
        style={styles.input}
        placeholderTextColor="#9ca3af"
      />
      <View style={styles.footer}>
        {body.length >= 3500 && (
          <Text
            style={body.length > 4000 ? styles.counterOver : styles.counterOk}
          >
            {body.length}/4000
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
          disabled={!canSubmit}
          onPress={async () => {
            if (!canSubmit) return;
            setBusy(true);
            try {
              await onSubmit(trimmed);
              setBody("");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Text style={[styles.postBtn, !canSubmit && styles.postBtnDisabled]}>
            {busy ? "Posting…" : "Post"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: "#ede9fe",
    padding: 8,
    gap: 6,
    backgroundColor: "#fff",
  },
  input: {
    minHeight: 40,
    padding: 8,
    borderWidth: 1,
    borderColor: "#ede9fe",
    borderRadius: 6,
    fontSize: 14,
    color: "#374151",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
  },
  counterOk: { fontSize: 12, color: "#6b7280" },
  counterOver: { fontSize: 12, color: "#dc2626" },
  postBtn: { color: "#7c3aed", fontWeight: "600", paddingHorizontal: 4 },
  postBtnDisabled: { color: "#9ca3af" },
});
