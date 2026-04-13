import { useEffect, useRef, useState } from "react";
import { Stack, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, createTrpcClient } from "../utils/trpc";
import { getAccessToken } from "../utils/auth";
import { AppProvider } from "../context/AppContext";
import { useWatchMessages } from "../hooks/useWatchMessages";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } },
});

function RootLayoutInner() {
  useWatchMessages();
  const router = useRouter();
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

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  const [trpcClient] = useState(() => createTrpcClient(getAccessToken));

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
