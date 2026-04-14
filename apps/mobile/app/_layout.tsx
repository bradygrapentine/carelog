import { useEffect, useRef, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { trpc, createTrpcClient } from "../utils/trpc";
import { getAccessToken } from "../utils/auth";
import { AppProvider } from "../context/AppContext";
import { useWatchMessages } from "../hooks/useWatchMessages";
import { useAppTheme } from "../hooks/useAppTheme";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } },
});

function RootLayoutInner() {
  useWatchMessages();
  const router = useRouter();
  const { scheme } = useAppTheme();
  const notifListenerRef = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    notifListenerRef.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as {
          jobId?: string;
          screen?: string;
        };
        if (data?.screen === "ocr-review" && data?.jobId) {
          router.push("/(app)/documents/ocr-review/" + data.jobId);
        }
      });
    return () => {
      notifListenerRef.current?.remove();
    };
  }, [router]);

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  const [trpcClient] = useState(() => createTrpcClient(getAccessToken));
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <RootLayoutInner />
        </AppProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
