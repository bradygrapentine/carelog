import { useState } from 'react'
import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { trpc, createTrpcClient } from '../utils/trpc'
import { getAccessToken } from '../utils/auth'
import { AppProvider } from '../context/AppContext'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } },
})

export default function RootLayout() {
  const [trpcClient] = useState(() => createTrpcClient(getAccessToken))

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </AppProvider>
      </QueryClientProvider>
    </trpc.Provider>
  )
}
