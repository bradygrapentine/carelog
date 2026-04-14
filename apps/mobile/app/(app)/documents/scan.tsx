import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useApp } from "../../../context/AppContext";
import { getSession } from "../../../utils/auth";
import { colors, spacing, radii } from "../../../constants/tokens";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export default function ScanScreen() {
  const router = useRouter();
  const { orgId, recipientId } = useApp();
  const [photo, setPhoto] = useState<{
    uri: string;
    name: string;
    mimeType: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);

  async function pickCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission required",
        "Camera access is needed to scan documents.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhoto({
        uri: asset.uri,
        name: "scan.jpg",
        mimeType: asset.mimeType ?? "image/jpeg",
      });
    }
  }

  async function pickLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhoto({
        uri: asset.uri,
        name: asset.fileName ?? "document.jpg",
        mimeType: asset.mimeType ?? "image/jpeg",
      });
    }
  }

  async function upload() {
    if (!photo || !orgId || !recipientId) return;
    setUploading(true);
    try {
      const session = await getSession();
      const form = new FormData();
      form.append("orgId", orgId);
      form.append("recipientId", recipientId);
      form.append("category", "document");
      form.append("file", {
        uri: photo.uri,
        name: photo.name,
        type: photo.mimeType,
      } as unknown as Blob);

      const res = await fetch(API_URL + "/api/ocr/upload", {
        method: "POST",
        headers: { Authorization: "Bearer " + session?.access_token },
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error ?? "Upload failed");
      }

      Alert.alert(
        "Scan processing",
        "We'll notify you when your document is ready to review.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (e: unknown) {
      Alert.alert(
        "Upload failed",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Scan Document</Text>

      {photo ? (
        <Image
          source={{ uri: photo.uri }}
          style={styles.preview}
          resizeMode="contain"
        />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>No photo selected</Text>
        </View>
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.button}
          onPress={pickCamera}
          disabled={uploading}
          accessibilityRole="button"
          accessibilityLabel="Take photo"
        >
          <Text style={styles.buttonText}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={pickLibrary}
          disabled={uploading}
          accessibilityRole="button"
          accessibilityLabel="Choose from library"
        >
          <Text style={styles.buttonText}>Choose from Library</Text>
        </TouchableOpacity>
      </View>

      {photo && (
        <TouchableOpacity
          style={[
            styles.uploadButton,
            uploading && styles.uploadButtonDisabled,
          ]}
          onPress={upload}
          disabled={uploading}
          accessibilityRole="button"
          accessibilityLabel={uploading ? "Uploading" : "Upload and process"}
        >
          {uploading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.uploadButtonText}>Upload & Process</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
    backgroundColor: colors.surfaceRaised,
  },
  title: { fontSize: 22, fontWeight: "600", marginBottom: spacing.xl },
  preview: {
    width: "100%",
    height: 300,
    borderRadius: radii.lg,
    marginBottom: spacing.xl,
  },
  placeholder: {
    width: "100%",
    height: 300,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  placeholderText: { color: colors.mutedLight, fontSize: 16 },
  buttonRow: { flexDirection: "row", gap: 12, marginBottom: spacing.lg },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderNeutral,
    alignItems: "center",
  },
  buttonText: { fontSize: 15, color: colors.textSecondary },
  uploadButton: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  uploadButtonDisabled: { backgroundColor: colors.primaryLight },
  uploadButtonText: { color: colors.white, fontWeight: "600", fontSize: 16 },
});
