import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { trpc } from "../utils/trpc";

type PermissionStatus = Notifications.PermissionStatus;

export function usePushNotifications() {
  const [permissionStatus, setPermissionStatus] =
    useState<PermissionStatus | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const registerToken = trpc.notifications.registerToken.useMutation();

  useEffect(() => {
    async function register() {
      // Skip registration on simulators/emulators
      if (!Device.isDevice) {
        return;
      }

      try {
        // Request permissions
        const { status } = await Notifications.requestPermissionsAsync();
        setPermissionStatus(status);

        if (status !== "granted") {
          return;
        }

        // Android: set up default notification channel
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "Default",
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }

        // Get project ID from Expo config
        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.expoConfig?.slug;

        // Get Expo push token
        const pushTokenData = await Notifications.getExpoPushTokenAsync({
          projectId: projectId as string | undefined,
        });

        const expoPushToken = pushTokenData.data;
        setToken(expoPushToken);

        // Register token with backend (idempotent)
        await registerToken.mutateAsync({
          token: expoPushToken,
          platform: Platform.OS === "android" ? "android" : "ios",
        });
      } catch (err) {
        console.warn("[usePushNotifications] Registration failed:", err);
      }
    }

    register();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { permissionStatus, token };
}
