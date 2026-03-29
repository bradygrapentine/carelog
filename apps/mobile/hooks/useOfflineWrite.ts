import { useEffect, useCallback } from "react";
import NetInfo from "@react-native-community/netinfo";
import {
  enqueue,
  dequeue,
  incrementAttempts,
  getQueue,
} from "../store/offlineQueue";
import type { EventType } from "@carelog/types";

const MAX_ATTEMPTS = 5;

// Import your tRPC client here when it's set up
// import { trpc } from '../utils/trpc'

async function flushQueue() {
  const queue = await getQueue();
  if (queue.length === 0) return;

  for (const write of queue) {
    if (write.attempts >= MAX_ATTEMPTS) {
      // TODO: log to Sentry, show persistent UI warning
      await dequeue(write.id);
      continue;
    }

    try {
      // TODO: replace with actual tRPC call
      // await trpc.careEvents.insert.mutate({
      //   ...write,
      //   idempotency_key: write.id,
      // })
      console.log("[offline queue] would flush:", write.id);
      await dequeue(write.id);
    } catch {
      await incrementAttempts(write.id);
    }
  }
}

export function useOfflineWrite() {
  // Flush on reconnect
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        flushQueue().catch(console.error);
      }
    });
    return unsub;
  }, []);

  const write = useCallback(
    async (event: {
      event_type: EventType;
      entry_kind: "human" | "system";
      payload: unknown;
      recipient_id: string;
    }) => {
      const id = crypto.randomUUID();
      const occurred_at = new Date().toISOString();

      // Always enqueue first — captures occurred_at at the right moment
      await enqueue({ id, occurred_at, attempts: 0, ...event });

      // Attempt immediate flush if online
      const net = await NetInfo.fetch();
      if (net.isConnected) {
        await flushQueue();
      }
      // If offline: queue persists, UI should show "pending sync" indicator
    },
    [],
  );

  return { write };
}
