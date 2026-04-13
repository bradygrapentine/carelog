import { useEffect } from "react";
import { Platform } from "react-native";
import { useOfflineWrite } from "./useOfflineWrite";
import { useApp } from "../context/AppContext";
import type { OfflineEntryKind } from "../store/offlineQueue";
import type { EventType } from "@carelog/types";

/**
 * Listens for quick-log messages from the Apple Watch and enqueues them
 * into the shared offline queue. No-op on Android.
 */
export function useWatchMessages() {
  const { orgId, recipientId } = useApp();
  const { write } = useOfflineWrite(orgId ?? "");

  useEffect(() => {
    if (Platform.OS !== "ios" || !orgId || !recipientId) return;

    let subscription: { remove: () => void } | null = null;
    try {
      const { requireNativeModule } = require("expo-modules-core");
      const mod = requireNativeModule("CarelogWatch");

      subscription = mod.addListener(
        "onWatchMessage",
        (message: Record<string, unknown>) => {
          const type = message.type as string;
          const payload = message.payload as Record<string, unknown>;

          const entryKindMap: Record<string, OfflineEntryKind> = {
            medication_log: "medication_log",
            journal_entry: "journal_entry",
          };

          const eventTypeMap: Record<string, EventType> = {
            medication_log: "medication",
            journal_entry: "journal",
          };

          const entryKind = entryKindMap[type];
          const eventType = eventTypeMap[type];

          if (entryKind && eventType) {
            write({
              event_type: eventType,
              entry_kind: entryKind,
              payload,
              recipient_id: recipientId,
            }).catch(console.error);
          }
        },
      );
    } catch {
      // Native module not available (Expo Go, Android, etc.)
    }

    return () => subscription?.remove();
  }, [orgId, recipientId]);
}
