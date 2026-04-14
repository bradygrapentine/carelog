import { createTRPCReact, type TRPCLink } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import superjson from "superjson";
import * as Sentry from "@sentry/react-native";
import type { AppRouter } from "../../web/server/trpc/router";

export const trpc = createTRPCReact<AppRouter>();

export const sentryBreadcrumbLink: TRPCLink<AppRouter> =
  () =>
  ({ next, op }) =>
    observable((observer) => {
      const sub = next(op).subscribe({
        next: observer.next,
        error: (err: { data?: { code?: string } }) => {
          Sentry.addBreadcrumb({
            category: "trpc",
            message: op.path,
            data: { path: op.path, type: op.type, code: err?.data?.code },
            level: "error",
          });
          observer.error(err);
        },
        complete: observer.complete,
      });
      return () => sub.unsubscribe();
    });

export function createTrpcClient(getToken: () => Promise<string | null>) {
  return trpc.createClient({
    links: [
      sentryBreadcrumbLink,
      httpBatchLink({
        transformer: superjson,
        url: `${process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000"}/api/trpc`,
        async headers() {
          const token = await getToken();
          return token ? { authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}
