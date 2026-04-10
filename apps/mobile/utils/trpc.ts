import { createTRPCReact } from '@trpc/react-query'
import { httpBatchLink } from '@trpc/client'
import superjson from 'superjson'
import type { AppRouter } from '../../web/server/trpc/router'

export const trpc = createTRPCReact<AppRouter>()

export function createTrpcClient(getToken: () => Promise<string | null>) {
  return trpc.createClient({
    links: [
      httpBatchLink({
        transformer: superjson,
        url: `${process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'}/api/trpc`,
        async headers() {
          const token = await getToken()
          return token ? { authorization: `Bearer ${token}` } : {}
        },
      }),
    ],
  })
}
