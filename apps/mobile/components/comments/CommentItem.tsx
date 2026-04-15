import { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { CareEventComment } from "@carelog/schemas";

type Props = {
  comment: CareEventComment;
  currentUserId: string;
  onEdit: (id: string, body: string) => void;
  onDelete: (id: string) => void;
};

export function CommentItem({
  comment,
  currentUserId,
  onEdit,
  onDelete,
}: Props) {
  const isAuthor = comment.authorId === currentUserId;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);

  const showActions = () => {
    if (!isAuthor) return;
    Alert.alert("Comment options", undefined, [
      { text: "Edit", onPress: () => setEditing(true) },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => onDelete(comment.id),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <Pressable
      onLongPress={showActions}
      accessibilityRole="button"
      accessibilityLabel={`Comment by ${comment.authorName}${isAuthor ? ". Long press for options." : ""}`}
      style={styles.container}
    >
      <View style={styles.meta}>
        <Text style={styles.author}>{comment.authorName}</Text>
        <Text style={styles.timestamp}>
          {new Date(comment.createdAt).toLocaleString()}
        </Text>
        {comment.editedAt && <Text style={styles.edited}>· edited</Text>}
      </View>
      {editing ? (
        <View style={styles.editContainer}>
          <TextInput
            accessibilityLabel="Edit comment body"
            multiline
            value={draft}
            onChangeText={setDraft}
            maxLength={4000}
            style={styles.editInput}
          />
          <View style={styles.editActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setEditing(false);
                setDraft(comment.body);
              }}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (!draft.trim()) return;
                onEdit(comment.id, draft.trim());
                setEditing(false);
              }}
              style={styles.saveBtn}
            >
              <Text style={styles.saveText}>Save</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Text style={styles.body}>{comment.body}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 8, paddingHorizontal: 12 },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 2 },
  author: { fontWeight: "600", color: "#1e0a3c" },
  timestamp: { color: "#6b7280", fontSize: 12 },
  edited: { color: "#6b7280", fontSize: 12 },
  body: { fontSize: 14, color: "#374151" },
  editContainer: { marginTop: 4 },
  editInput: {
    borderWidth: 1,
    borderColor: "#ede9fe",
    borderRadius: 6,
    padding: 8,
    minHeight: 60,
    fontSize: 14,
    color: "#374151",
  },
  editActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
    justifyContent: "flex-end",
  },
  cancelBtn: { padding: 4 },
  cancelText: { color: "#6b7280" },
  saveBtn: { padding: 4 },
  saveText: { color: "#7c3aed", fontWeight: "600" },
});
