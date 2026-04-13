import { useState } from "react";
import { Stack } from "expo-router";
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
