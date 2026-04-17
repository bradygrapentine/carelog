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
import { initSentry, Sentry } from "../utils/sentry";
import { initPostHog, identifyUser, resetUser } from "../utils/posthog";
import { supabase } from "../utils/supabase";
import { useAppTheme } from "../hooks/useAppTheme";
import { isOnboardingComplete } from "../lib/onboarding";
import { usePushNotifications } from "../hooks/usePushNotifications";

SplashScreen.preventAutoHideAsync().catch(() => {});
initSentry();
initPostHog().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } },
});

function RootLayoutInner({ onSplashReady }: { onSplashReady: () => void }) {
  useWatchMessages();
  usePushNotifications();
  const router = useRouter();
  const { scheme } = useAppTheme();
  const notifListenerRef = useRef<Notifications.Subscription | null>(null);
  // Guard: only run the onboarding check once per mount, not on every token refresh.
  const onboardingCheckedRef = useRef(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user?.id) {
        identifyUser(session.user.id);
        // Check if the user needs onboarding (client-side AsyncStorage flag).
        // schema flag (is_onboarded column) is tracked as a separate TD-*.
        if (!onboardingCheckedRef.current) {
          onboardingCheckedRef.current = true;
          isOnboardingComplete().then((complete) => {
            if (!complete) {
              router.replace("/(auth)/onboarding/welcome");
            }
            // Hide splash only after the onboarding decision resolves,
            // so the splash covers the transition on first launch.
            onSplashReady();
          });
        }
      } else if (event === "SIGNED_OUT") {
        resetUser();
        // Unauthenticated — safe to hide splash immediately.
        onSplashReady();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [onSplashReady]);

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

function RootLayout() {
  const [trpcClient] = useState(() => createTrpcClient(getAccessToken));
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  // Ensure hideAsync fires at most once regardless of which path triggers it.
  const splashHiddenRef = useRef(false);

  const hideSplash = useRef(() => {
    if (!splashHiddenRef.current) {
      splashHiddenRef.current = true;
      SplashScreen.hideAsync().catch(() => {});
    }
  }).current;

  // Fonts not yet loaded — keep splash visible.
  if (!fontsLoaded) return null;

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <RootLayoutInner onSplashReady={hideSplash} />
        </AppProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

// ts-prune-ignore-next // Expo Router root layout page component
export default Sentry.wrap(RootLayout);
