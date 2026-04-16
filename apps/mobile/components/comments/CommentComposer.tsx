// apps/mobile/components/comments/CommentComposer.tsx
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { scaledFont } from "../../lib/typography";

type Props = { onSubmit: (body: string) => Promise<void> };

export function CommentComposer({ onSubmit }: Props) {
  const { colors } = useAppTheme();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const trimmed = body.trim();
  const canSubmit = !busy && trimmed.length > 0 && body.length <= 4000;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          borderTopWidth: 1,
          borderTopColor: colors.border,
          padding: 8,
          gap: 6,
          backgroundColor: colors.white,
        },
        input: {
          minHeight: 40,
          padding: 8,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 6,
          fontSize: scaledFont(14),
          color: colors.textPrimary,
        },
        footer: {
          flexDirection: "row",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 8,
        },
        counterOk: { fontSize: scaledFont(12), color: colors.muted },
        counterOver: { fontSize: scaledFont(12), color: colors.danger },
        postBtn: {
          color: colors.primary,
          fontWeight: "600",
          paddingHorizontal: 4,
        },
        postBtnDisabled: { color: colors.textSecondary },
      }),
    [colors],
  );

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
        placeholderTextColor={colors.textSecondary}
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
