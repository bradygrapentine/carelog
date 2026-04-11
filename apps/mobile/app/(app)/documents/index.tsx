import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  ActionSheetIOS,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { trpc } from "../../../utils/trpc";
import { useApp } from "../../../context/AppContext";
import { getSession } from "../../../utils/auth";
import {
  DOC_TYPES,
  formatFileSize,
  canUploadDocument,
  type DocType,
} from "../../../utils/wave5Utils";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

const DOC_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  DOC_TYPES.map((d) => [d.key, d.label]),
);

export default function DocumentsScreen() {
  const router = useRouter();
  const { orgId, recipientId, currentRole } = useApp();
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pickedFile, setPickedFile] = useState<{
    uri: string;
    name: string;
    mimeType: string;
  } | null>(null);
  const [docType, setDocType] = useState<DocType>("other");

  const { data, isLoading, refetch } = trpc.documents.list.useQuery(
    { org_id: orgId ?? "", recipient_id: recipientId ?? "" },
    { enabled: !!orgId && !!recipientId },
  );

  const deleteMut = trpc.documents.delete.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => Alert.alert("Error", err.message),
  });

  function confirmDelete(id: string) {
    Alert.alert("Delete document?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteMut.mutate({ id, org_id: orgId ?? "" }),
      },
    ]);
  }

  async function handleView(id: string) {
    const session = await getSession();
    if (!session) return;
    try {
      const res = await fetch(API_URL + "/api/documents/" + id + "/download", {
        headers: { authorization: "Bearer " + session.access_token },
        redirect: "manual",
      });
      const location = res.headers.get("location");
      if (location) {
        await Linking.openURL(location);
      } else {
        Alert.alert("Error", "Could not get download URL");
      }
    } catch {
      Alert.alert("Error", "Failed to open document");
    }
  }

  function showPickerOptions() {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Take photo", "Choose file"],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) pickFromCamera();
          else if (idx === 2) pickFromFiles();
        },
      );
    } else {
      Alert.alert("Upload document", "", [
        { text: "Take photo", onPress: pickFromCamera },
        { text: "Choose file", onPress: pickFromFiles },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera permission required");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPickedFile({
        uri: asset.uri,
        name: asset.fileName ?? "photo.jpg",
        mimeType: asset.mimeType ?? "image/jpeg",
      });
      setShowUploadModal(true);
    }
  }

  async function pickFromFiles() {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/heic",
        "image/heif",
      ],
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPickedFile({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? "application/pdf",
      });
      setShowUploadModal(true);
    }
  }

  async function handleUpload() {
    if (!pickedFile || !orgId || !recipientId) return;
    const session = await getSession();
    if (!session) return;

    setUploading(true);
    try {
      const form = new FormData();
      form.append("orgId", orgId);
      form.append("recipientId", recipientId);
      form.append("displayName", pickedFile.name);
      form.append("docType", docType);
      form.append("file", {
        uri: pickedFile.uri,
        name: pickedFile.name,
        type: pickedFile.mimeType,
      } as unknown as Blob);

      const res = await fetch(API_URL + "/api/documents/upload", {
        method: "POST",
        headers: { authorization: "Bearer " + session.access_token },
        body: form,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Upload failed");
      }

      setShowUploadModal(false);
      setPickedFile(null);
      setDocType("other");
      refetch();
      Alert.alert("Document uploaded");
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Upload failed",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#0369a1" />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => handleView(item.id)}
              onLongPress={
                canUploadDocument(currentRole)
                  ? () => confirmDelete(item.id)
                  : undefined
              }
              accessibilityRole="button"
              accessibilityLabel={
                item.display_name +
                (canUploadDocument(currentRole) ? ", long press to delete" : "")
              }
            >
              <View style={styles.rowMain}>
                <Text style={styles.docName} numberOfLines={1}>
                  {item.display_name}
                </Text>
                <View style={styles.docTypeBadge}>
                  <Text style={styles.docTypeText}>
                    {DOC_TYPE_LABELS[item.doc_type] ?? item.doc_type}
                  </Text>
                </View>
              </View>
              <View style={styles.rowMeta}>
                <Text style={styles.metaText}>
                  {formatFileSize(item.file_size)}
                </Text>
                <Text style={styles.metaText}>
                  {new Date(item.created_at).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No documents yet.</Text>
          }
        />
      )}

      {canUploadDocument(currentRole) && (
        <TouchableOpacity
          style={styles.fab}
          onPress={showPickerOptions}
          accessibilityRole="button"
          accessibilityLabel="Upload document"
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      <Modal visible={showUploadModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Upload document</Text>
            {pickedFile && (
              <Text style={styles.fileName} numberOfLines={1}>
                {pickedFile.name}
              </Text>
            )}

            <Text style={styles.fieldLabel}>Document type</Text>
            <View style={styles.chipRow}>
              {DOC_TYPES.map((d) => (
                <TouchableOpacity
                  key={d.key}
                  style={[styles.chip, docType === d.key && styles.chipActive]}
                  onPress={() => setDocType(d.key)}
                  accessibilityRole="button"
                  accessibilityLabel={d.label + " document type"}
                >
                  <Text
                    style={[
                      styles.chipText,
                      docType === d.key && styles.chipTextActive,
                    ]}
                  >
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.uploadBtn, uploading && styles.uploadDisabled]}
              onPress={handleUpload}
              disabled={uploading}
              accessibilityRole="button"
              accessibilityLabel={uploading ? "Uploading" : "Upload"}
            >
              <Text style={styles.uploadText}>
                {uploading ? "Uploading…" : "Upload"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                setShowUploadModal(false);
                setPickedFile(null);
              }}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  loader: { marginTop: 48 },
  list: { padding: 16, paddingBottom: 80 },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  rowMain: { flexDirection: "row", alignItems: "center", gap: 8 },
  docName: { fontSize: 15, fontWeight: "600", color: "#111827", flex: 1 },
  docTypeBadge: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  docTypeText: { fontSize: 11, color: "#374151" },
  rowMeta: { flexDirection: "row", gap: 12, marginTop: 4 },
  metaText: { fontSize: 12, color: "#9ca3af" },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  fileName: { fontSize: 14, color: "#6b7280", marginBottom: 16 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 8,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  chipActive: { borderColor: "#0369a1", backgroundColor: "#eff6ff" },
  chipText: { fontSize: 12, color: "#374151" },
  chipTextActive: { color: "#0369a1", fontWeight: "600" },
  uploadBtn: {
    backgroundColor: "#0369a1",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginBottom: 8,
  },
  uploadDisabled: { opacity: 0.4 },
  uploadText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  cancelBtn: { alignItems: "center", padding: 10 },
  cancelText: { color: "#6b7280", fontSize: 15 },
});
