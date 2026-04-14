import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// Centralized haptic feedback helpers. Use for meaningful mutations
// (submit, log, flag, claim). Do NOT fire on passive interactions like
// scroll, navigation, or opening menus — it feels noisy.
//
// Web is a hard no-op so react-native-web builds don't crash on import.

function safe(fn: () => Promise<unknown>): void {
  if (Platform.OS === "web") return;
  fn().catch(() => {
    // Haptic failures are never user-visible — intentionally swallow.
  });
}

export const haptics = {
  // Mutation fired (journal entry, med log, symptom log, expense add, shift create).
  tap(): void {
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },

  // Success confirmation (save completed, flag applied, slot claimed).
  success(): void {
    safe(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    );
  },

  // Warning confirmation (destructive action preview — not used today).
  warning(): void {
    safe(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
    );
  },

  // Error feedback (mutation rejected, validation failed).
  error(): void {
    safe(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    );
  },

  // Selection change (tab switch, filter toggle) — use sparingly.
  selection(): void {
    safe(() => Haptics.selectionAsync());
  },
};
